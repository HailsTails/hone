import {
  checkAddressTextOf,
  checkNamesOf,
  type AddressedCheck,
} from "../../../domain/language-layer/check-address-text.ts";
import type {
  Check,
  Recipe,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import type { ClauseEditions } from "../../../domain/rule-set/edition-types.ts";
import type { ClauseExceptions } from "../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import {
  type CheckChoiceRefusal,
  type ChosenCheck,
  namedCheckChoicesOf,
  type RuleSetCatalogue,
  sameRuleSet,
} from "../../../domain/settings/check-choices.ts";
import { settledCheckSettings } from "../../../domain/settings/clause-settings/check-settings.ts";
import type { Conventions } from "../../../domain/settings/conventions.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type { ListedAddress } from "../../../domain/settings/listed-address.ts";
import type { VersionTwoReportOutput } from "../../../domain/settings/report-output.ts";
import type { RunSettings } from "../../../domain/settings/run-settings.ts";
import type {
  EslintConfigLookupChoice,
  SettingsFile,
} from "../../../domain/settings/settings-file.ts";
import type { SettingsNote } from "../../../domain/settings/settings-note.ts";
import type {
  CheckPieceSource,
  SettingsDocument,
  SettingsSources,
} from "../../ports/settings-sources.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";

export type SettingsFailure = VersionTwoLoadFailure | CheckChoiceRefusal;

type SourcesRequest = { readonly sources: SettingsSources; readonly file: SettingsFile };

const ruleSetsListed = (request: {
  readonly file: SettingsFile;
}): readonly ClauseAddress["ruleSet"][] => {
  const ruleSets = [
    ...request.file.checks.map((listed) => listed.address),
    ...request.file.checkSettings.map((given) => given.address),
  ].map((address) => address.ruleSet);
  return ruleSets.filter(
    (ruleSet, index) =>
      ruleSets.findIndex((earlier) => sameRuleSet({ left: earlier, right: ruleSet }) === "same") ===
      index,
  );
};

const cataloguesHeld = (
  request: SourcesRequest,
): Result<readonly RuleSetCatalogue[], VersionTwoLoadFailure> => {
  const held = everyOk({
    entries: ruleSetsListed(request),
    resolve: (ruleSet): Result<readonly RuleSetCatalogue[], VersionTwoLoadFailure> => {
      const ruleSetRoot = request.sources.ruleSetRoot({ ruleSet, ruleSets: request.file.ruleSets });
      if (ruleSetRoot.outcome === "failed") {
        return ruleSetRoot;
      }
      const catalogue = request.sources.catalogue({ ruleSetRoot: ruleSetRoot.value, ruleSet });
      if (catalogue.outcome === "failed") {
        return catalogue;
      }
      return {
        outcome: "ok",
        value:
          catalogue.value.held === "catalogue"
            ? [{ ruleSet, catalogue: catalogue.value.catalogue }]
            : [],
      };
    },
  });
  return held.outcome === "failed" ? held : { outcome: "ok", value: held.value.flat() };
};

const parsedSettingsFile = (
  request: Pick<NamedSettingsRequest, "sources" | "settingsFormat">,
): Result<SettingsDocument & { readonly file: SettingsFile }, VersionTwoLoadFailure> => {
  const document = request.sources.settingsFile({});
  if (document.outcome === "failed") {
    return document;
  }
  const file = request.settingsFormat.fileOf({ document: document.value.document });
  if (file.outcome === "ok") {
    return { outcome: "ok", value: { ...document.value, file: file.value } };
  }
  return file.error.kind === "malformed"
    ? {
        outcome: "failed",
        error: { kind: "file-malformed", path: document.value.path, detail: file.error.detail },
      }
    : { outcome: "failed", error: file.error };
};

type SelectedCheck = {
  readonly address: ListedAddress;
  readonly check: Check;
  readonly exceptions: ClauseExceptions;
  readonly binding: CheckBinding;
  readonly editions: ClauseEditions;
};

export type NamedSettingsReading = {
  readonly externalCatalogues?: readonly RuleSetCatalogue[];
  readonly runSettings: RunSettings<VersionTwoReportOutput>;
  readonly eslintConfigLookup: EslintConfigLookupChoice;
  readonly conventions: Conventions;
  readonly notes: readonly SettingsNote[];
  readonly available: readonly Check[];
  readonly selection: {
    readonly selected: readonly SelectedCheck[];
    readonly notRun: readonly ChosenCheck[];
    readonly notAdopted: readonly ChosenCheck[];
    readonly excluded: SettingsFile["exclude"];
    readonly eslintConfigRoots: SettingsFile["eslintConfigRoots"];
  };
};

export const catalogueWithExternalChecks = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly settings: NamedSettingsReading;
}): SymptomCatalogue => {
  const external = request.settings.externalCatalogues ?? [];
  return external.length === 0
    ? request.catalogue
    : {
        ...request.catalogue,
        checks: [
          ...request.catalogue.checks,
          ...external.flatMap(({ catalogue }) => catalogue.checks),
        ],
        symptoms: [
          ...request.catalogue.symptoms,
          ...external.flatMap(({ catalogue }) => catalogue.symptoms),
        ],
        recipes: [
          ...request.catalogue.recipes,
          ...external.flatMap(({ catalogue }) => catalogue.recipes),
        ],
      };
};

const withNamedSource = (request: {
  readonly held: RuleSetCatalogue;
  readonly ruleSets: SettingsFile["ruleSets"];
}): RuleSetCatalogue => {
  const { ruleSet, catalogue } = request.held;
  if (ruleSet === TOOL_RULE_SET) return request.held;
  const location = request.ruleSets.find(({ name }) => name === ruleSet.name)?.location;
  const folder = location?.location === "folder" ? location.path : undefined;
  const symptoms = catalogue.symptoms.map((symptom): Symptom =>
    folder !== undefined && symptom.sourceFile !== undefined
      ? { ...symptom, sourceFile: `${folder}/${symptom.sourceFile}` }
      : symptom,
  );
  const recipes = catalogue.recipes.map((recipe): Recipe =>
    folder !== undefined && recipe.sourceFile !== undefined
      ? { ...recipe, sourceFile: `${folder}/${recipe.sourceFile}` }
      : recipe,
  );
  const checks = catalogue.checks.map((check) => ({
    ...check,
    page: folder === undefined ? check.page : `${folder}/${check.page}`,
  }));
  return { ruleSet, catalogue: { ...catalogue, symptoms, recipes, checks } };
};

type NamedSettingsRequest = {
  readonly sources: SettingsSources;
  readonly readPiece: CheckPieceSource;
  readonly settingsFormat: Pick<SettingsFileFormat, "fileOf">;
};

const selectedCheckOf = (
  request: SourcesRequest & {
    readonly chosen: ChosenCheck;
    readonly readPiece: CheckPieceSource;
    readonly settingsPath: string;
  },
): Result<readonly SelectedCheck[], SettingsFailure> => {
  const { chosen } = request;
  if (chosen.choice.state !== "run") {
    return { outcome: "ok", value: [] };
  }
  const { mechanism, settings } = chosen.choice;
  const names = checkNamesOf({ text: chosen.address.check });
  if (names === undefined) {
    return {
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: request.settingsPath,
        detail: `invalid check address ${chosen.address.check}`,
      },
    };
  }
  const ruleSetRoot = request.sources.ruleSetRoot({
    ruleSet: chosen.address.ruleSet,
    ruleSets: request.file.ruleSets,
  });
  if (ruleSetRoot.outcome === "failed") return ruleSetRoot;
  const piece = request.readPiece({ names, ruleSetRoot: ruleSetRoot.value, mechanism });
  if (piece.outcome === "failed") return piece;
  const settled = settledCheckSettings({
    given: settings,
    declarations: piece.value.declarations,
    editions: piece.value.editions,
    checkEditions: request.file.checkEditions,
  });
  if (settled.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-malformed", path: request.settingsPath, detail: settled.error },
    };
  }
  return {
    outcome: "ok",
    value: [
      {
        address: chosen.address,
        check: chosen.check,
        exceptions: piece.value.exceptions,
        editions: piece.value.editions,
        binding: {
          address: chosen.address.check,
          ruleSet: chosen.address.ruleSet,
          engine: mechanism,
          anchor: piece.value.anchor,
          pieceRoot: piece.value.pieceRoot,
          settings: piece.value.settings,
          forms: piece.value.forms,
          checkSettings: settled.value.clauseSettings,
          edition: settled.value.edition,
        },
      },
    ],
  };
};

const checkSharedAcrossRuleSetsOf = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
}): VersionTwoLoadFailure | undefined => {
  const held = request.catalogues.flatMap(({ ruleSet, catalogue }) =>
    catalogue.checks.map((check) => ({
      address: checkAddressTextOf({ check }),
      owner: ruleSet === TOOL_RULE_SET ? TOOL_RULE_SET : ruleSet.name,
    })),
  );
  const [shared] = held.flatMap((each) =>
    held
      .filter((other) => other.address === each.address && other.owner !== each.owner)
      .map((other): VersionTwoLoadFailure => ({
        kind: "rule-sets-share-a-check",
        check: each.address,
        ruleSets: [each.owner, other.owner],
      })),
  );
  return shared;
};

export const readNamedSettingsFile = (
  request: SourcesRequest & {
    readonly readPiece: CheckPieceSource;
    readonly path: string;
  },
): Result<NamedSettingsReading, SettingsFailure> => {
  const { file, path } = request;
  const catalogues = cataloguesHeld({ sources: request.sources, file });
  if (catalogues.outcome === "failed") return catalogues;
  const shared = checkSharedAcrossRuleSetsOf({ catalogues: catalogues.value });
  if (shared !== undefined) {
    return { outcome: "failed", error: shared };
  }
  const named = catalogues.value.map((held) => withNamedSource({ held, ruleSets: file.ruleSets }));
  const choices = namedCheckChoicesOf({
    catalogues: named,
    checks: file.checks,
    checkSettings: file.checkSettings,
  });
  if (choices.outcome === "failed") return choices;
  const selected = everyOk({
    entries: choices.value.checks,
    resolve: (chosen) => selectedCheckOf({ ...request, file, chosen, settingsPath: path }),
  });
  if (selected.outcome === "failed") return selected;
  const externalCatalogues = named.filter(({ ruleSet }) => ruleSet !== TOOL_RULE_SET);
  return {
    outcome: "ok",
    value: {
      selection: {
        selected: selected.value.flat(),
        notRun: choices.value.checks.filter(({ choice }) => choice.state === "not-run"),
        notAdopted: choices.value.checks.filter(({ choice }) => choice.state === "not-adopted"),
        excluded: file.exclude,
        eslintConfigRoots: file.eslintConfigRoots,
      },
      runSettings: { reportOutput: file.reportOutput, assessment: { forfeiture: file.forfeiture } },
      eslintConfigLookup: file.eslintConfigLookup,
      conventions: file.conventions.conventions,
      notes: file.conventions.declared.flatMap((key): readonly SettingsNote[] =>
        key === "testFiles" ? [] : [{ kind: "declared-not-read", key }],
      ),
      available: choices.value.available,
      ...(externalCatalogues.length === 0 ? {} : { externalCatalogues }),
    },
  };
};

export const readNamedSettings = (
  request: NamedSettingsRequest,
): Result<NamedSettingsReading, SettingsFailure> => {
  const parsed = parsedSettingsFile(request);
  return parsed.outcome === "failed"
    ? parsed
    : readNamedSettingsFile({ ...request, file: parsed.value.file, path: parsed.value.path });
};
