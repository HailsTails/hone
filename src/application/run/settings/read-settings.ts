import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { VersionTwoReportOutput } from "../../../domain/settings/report-output.ts";
import type { RunSettings } from "../../../domain/settings/run-settings.ts";
import type { ClauseBinding, ClauseEditionReading, ClauseRoot, SelectedClause, SelectionReading } from "../../../domain/settings/selection/selection.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import type { ClauseEditions } from "../../../domain/rule-set/edition-types.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import { type CheckChoiceRefusal, type ChosenClause, checkChoicesOf, type RuleSetCatalogue, sameRuleSet } from "../../../domain/settings/check-choices.ts";
import { settledCheckSettings } from "../../../domain/settings/clause-settings/check-settings.ts";
import type { Conventions } from "../../../domain/settings/conventions.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type { SettingsNote } from "../../../domain/settings/settings-note.ts";
import type { EslintConfigLookupChoice, SettingsFile } from "../../../domain/settings/settings-file.ts";
import type { SettingsDocument, SettingsSources } from "../../ports/settings-sources.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";

export type SettingsFailure = VersionTwoLoadFailure | CheckChoiceRefusal;

export type SettingsReading = {
  readonly selection: SelectionReading;
  readonly runSettings: RunSettings<VersionTwoReportOutput>;
  readonly eslintConfigLookup: EslintConfigLookupChoice;
  readonly conventions: Conventions;
  readonly notes: readonly SettingsNote[];
  readonly available: readonly Check[];
};

export type SettingsRepository = {
  readonly read: (request: Record<string, never>) => Result<SettingsReading, SettingsFailure>;
};

export const settingsRepositoryHolding = (request: { readonly reading: SettingsReading }): SettingsRepository => ({
  read: (_request) => ({ outcome: "ok", value: request.reading }),
});

export type SettingsReadRequest = { readonly sources: SettingsSources; readonly settingsFormat: Pick<SettingsFileFormat, "fileOf"> };

export const createSettingsRepository = (options: SettingsReadRequest): SettingsRepository => ({
  read: (_request) => readSettings(options),
});

type BoundClause = {
  readonly selected: SelectedClause;
  readonly binding: ClauseBinding;
  readonly root: ClauseRoot;
  readonly editions: ClauseEditions;
};

type SourcesRequest = { readonly sources: SettingsSources; readonly file: SettingsFile };

const ruleSetsListed = (request: { readonly file: SettingsFile }): readonly ClauseAddress["ruleSet"][] => {
  const ruleSets = [...request.file.checks.map((listed) => listed.address), ...request.file.checkSettings.map((given) => given.address)].map(
    (address) => address.ruleSet,
  );
  return ruleSets.filter(
    (ruleSet, index) => ruleSets.findIndex((earlier) => sameRuleSet({ left: earlier, right: ruleSet }) === "same") === index,
  );
};

const cataloguesHeld = (request: SourcesRequest): Result<readonly RuleSetCatalogue[], VersionTwoLoadFailure> => {
  const held = everyOk({
    entries: ruleSetsListed(request),
    resolve: (ruleSet): Result<readonly RuleSetCatalogue[], VersionTwoLoadFailure> => {
      const ruleSetRoot = request.sources.ruleSetRoot({ ruleSet, ruleSets: request.file.ruleSets });
      if (ruleSetRoot.outcome === "failed") {
        return ruleSetRoot;
      }
      const catalogue = request.sources.catalogue({ ruleSetRoot: ruleSetRoot.value });
      if (catalogue.outcome === "failed") {
        return catalogue;
      }
      return { outcome: "ok", value: catalogue.value.held === "catalogue" ? [{ ruleSet, catalogue: catalogue.value.catalogue }] : [] };
    },
  });
  return held.outcome === "failed" ? held : { outcome: "ok", value: held.value.flat() };
};

const boundClauseOf = (
  request: SourcesRequest & { readonly chosen: ChosenClause; readonly mechanism: EngineId; readonly settingsPath: string },
): Result<BoundClause, VersionTwoLoadFailure> => {
  const { chosen, mechanism } = request;
  const ruleSetRoot = request.sources.ruleSetRoot({ ruleSet: chosen.clause.ruleSet, ruleSets: request.file.ruleSets });
  if (ruleSetRoot.outcome === "failed") {
    return ruleSetRoot;
  }
  const piece = request.sources.pieceClause({ ruleSetRoot: ruleSetRoot.value, clause: chosen.clause, mechanism });
  if (piece.outcome === "failed") {
    return piece;
  }
  const settled = settledCheckSettings({
    given: chosen.choice.state === "run" ? chosen.choice.settings : undefined,
    declarations: piece.value.declarations,
    editions: piece.value.editions,
    checkEditions: request.file.checkEditions,
  });
  if (settled.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-malformed", path: request.settingsPath, detail: settled.error } };
  }
  return {
    outcome: "ok",
    value: {
      selected: { address: chosen.clause, mechanism, exceptions: piece.value.exceptions },
      binding: {
        mechanism,
        clause: {
          address: chosen.clause,
          anchor: piece.value.anchor,
          pieceRoot: piece.value.pieceRoot,
          settings: piece.value.settings,
          clauseSettings: settled.value.clauseSettings,
          edition: settled.value.edition,
        },
      },
      root: { clause: chosen.clause, ruleSetRoot: ruleSetRoot.value },
      editions: piece.value.editions,
    },
  };
};

const runClauses = (request: { readonly clauses: readonly ChosenClause[] }): readonly (readonly [ChosenClause, EngineId])[] =>
  request.clauses.flatMap((chosen): readonly (readonly [ChosenClause, EngineId])[] =>
    chosen.choice.state === "run" ? [[chosen, chosen.choice.mechanism]] : [],
  );

const clausesIn = (request: { readonly clauses: readonly ChosenClause[]; readonly state: "not-run" | "not-adopted" }): readonly ClauseAddress[] =>
  request.clauses.filter((chosen) => chosen.choice.state === request.state).map((chosen) => chosen.clause);

const editionReadingsOf = (request: { readonly bound: readonly BoundClause[] }): readonly ClauseEditionReading[] =>
  request.bound
    .filter((bound) => bound.editions.declared.length > 1)
    .map((bound) => ({
      address: bound.selected.address,
      mechanism: bound.selected.mechanism,
      edition: bound.binding.clause.edition,
      latest: bound.editions.latest,
    }));

const settingsReadingOf = (request: {
  readonly file: SettingsFile;
  readonly clauses: readonly ChosenClause[];
  readonly available: readonly Check[];
  readonly bound: readonly BoundClause[];
}): SettingsReading => ({
  selection: {
    selection: {
      selected: request.bound.map((bound) => bound.selected),
      uncovered: [],
      notAdopted: clausesIn({ clauses: request.clauses, state: "not-adopted" }),
      notRun: clausesIn({ clauses: request.clauses, state: "not-run" }),
      editions: editionReadingsOf({ bound: request.bound }),
    },
    bindings: request.bound.map((bound) => bound.binding),
    clauseRoots: request.bound.map((bound) => bound.root),
    excluded: request.file.exclude,
    eslintConfigRoots: request.file.eslintConfigRoots,
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: request.file.reportOutput, assessment: { forfeiture: request.file.forfeiture } },
  eslintConfigLookup: request.file.eslintConfigLookup,
  conventions: request.file.conventions.conventions,
  notes: request.file.conventions.declared.map((key) => ({ kind: "declared-not-read", key })),
  available: request.available,
});

const parsedSettingsFile = (request: SettingsReadRequest): Result<SettingsDocument & { readonly file: SettingsFile }, VersionTwoLoadFailure> => {
  const document = request.sources.settingsFile({});
  if (document.outcome === "failed") {
    return document;
  }
  const file = request.settingsFormat.fileOf({ document: document.value.document });
  if (file.outcome === "ok") {
    return { outcome: "ok", value: { ...document.value, file: file.value } };
  }
  return file.error.kind === "malformed"
    ? { outcome: "failed", error: { kind: "file-malformed", path: document.value.path, detail: file.error.detail } }
    : { outcome: "failed", error: file.error };
};

export const readSettings = (request: SettingsReadRequest): Result<SettingsReading, SettingsFailure> => {
  const parsed = parsedSettingsFile(request);
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const { file, path } = parsed.value;
  const catalogues = cataloguesHeld({ sources: request.sources, file });
  if (catalogues.outcome === "failed") {
    return catalogues;
  }
  const choices = checkChoicesOf({ catalogues: catalogues.value, checks: file.checks, checkSettings: file.checkSettings });
  if (choices.outcome === "failed") {
    return choices;
  }
  const bound = everyOk({
    entries: runClauses({ clauses: choices.value.clauses }),
    resolve: ([chosen, mechanism]) => boundClauseOf({ sources: request.sources, file, chosen, mechanism, settingsPath: path }),
  });
  if (bound.outcome === "failed") {
    return bound;
  }
  return { outcome: "ok", value: settingsReadingOf({ file, clauses: choices.value.clauses, available: choices.value.available, bound: bound.value }) };
};
