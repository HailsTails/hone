import { z } from "zod";

import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type {
  ClauseNaming,
  VersionOnePiece,
  VersionOneTeamClause,
  VersionOneTeamLayout,
} from "../../../application/ports/upgrade/version-one-team-layout.ts";
import { checkAddressOfNames } from "../../../domain/language-layer/check-address-text.ts";
import { SYMPTOM_CATALOGUE_SEGMENTS } from "../../../domain/language-layer/symptom-catalogue-location.ts";
import type { RecordKind } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { LoadFailure, VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { isRepoPath } from "../../../domain/repository/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import { clauseAddressText, TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { versionOneEngineNameOf } from "../../../domain/rule-set/engine-id.ts";
import type {
  DisciplineId,
  EngineId,
  RuleSetName,
} from "../../../domain/rule-set/identifier-types.ts";
import type { DisciplineFile, PieceFile } from "../../../domain/rule-set/rule-set-types.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type {
  ConsumerSelectionFile,
  RuleSetLocation,
} from "../../../domain/settings/selection/selection-file.ts";
import {
  pieceFilePath,
  readPieceFile,
  readSummarisedDisciplineFile,
  type SummarisedDiscipline,
} from "../../content-files/rule-sets/rule-set-reader.ts";
import { readBoundCatalogue } from "../../content-files/symptom-catalogues/bound-catalogue.ts";
import { versionOneRuleFilesOf } from "../../content-files/symptom-catalogues/read-symptom-catalogue.ts";
import {
  versionOneNamesOf,
  type VersionOneNames,
} from "../../disciplines-file/version-one-names.ts";
import { disciplineIdSchema } from "../../hone-config-file/identifiers.ts";
import { ruleSetRootOf } from "../../hone-config-file/rule-set-root.ts";
import { readVersionTwoNames, VERSION_TWO_NAMES_FILE } from "./version-two-names.ts";

export type TeamLayoutSources = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly toolRecordKinds: readonly RecordKind[];
};

export type TeamRuleSet = { readonly name: RuleSetName; readonly location: RuleSetLocation };

type PlacedTeamRuleSet = TeamLayoutSources & {
  readonly ruleSet: TeamRuleSet;
  readonly root: AbsolutePath;
};

type HeldPiece = { readonly mechanism: EngineId; readonly file: PieceFile };

type FolderFile = VersionOnePiece["files"][number];

type MechanicalDefinition = Extract<
  DisciplineFile["clauses"][number],
  { readonly kind: "mechanical" }
>;

type Read<Value> = Result<Value, VersionTwoLoadFailure>;

const RULES_FOLDER = "rules";

const VERSION_ONE_RULE_FILE = "discipline.json";

const VERSION_ONE_ENGINES_FOLDER = "mechanisms";

const PIECE_FILE = "piece.json";

const PATH_SEPARATOR = "/";

const CLAUSE_SEPARATOR = "#";

const invalid = (request: { readonly path: string; readonly detail: string }): Read<never> => ({
  outcome: "failed",
  error: { kind: "rule-set-invalid", path: request.path, detail: request.detail },
});

const repoPathIn = (
  request: PlacedTeamRuleSet & { readonly segments: readonly string[] },
): Read<RepoPath> => {
  const { location } = request.ruleSet;
  const path = [
    ...(location.location === "repo-root" ? [] : [location.path]),
    ...request.segments,
  ].join(PATH_SEPARATOR);
  return isRepoPath(path)
    ? { outcome: "ok", value: path }
    : invalid({ path: request.root, detail: `${path} is not a path inside the repository` });
};

const disciplineIdsOf = (request: PlacedTeamRuleSet): Read<readonly DisciplineId[]> => {
  const rules = request.path.join({ segments: [request.root, RULES_FOLDER] });
  if (!isAbsolutePath(rules) || request.fileText.exists({ path: rules }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const entries = request.directory.list({ path: rules });
  if (entries.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: entries.error.path, detail: entries.error.detail },
    };
  }
  return {
    outcome: "ok",
    value: entries.value.flatMap((entry) => {
      const id = disciplineIdSchema.safeParse(entry.name);
      return entry.kind === "directory" &&
        id.success &&
        request.fileText.exists({
          path: request.path.join({ segments: [rules, entry.name, VERSION_ONE_RULE_FILE] }),
        }) === "present"
        ? [id.data]
        : [];
    }),
  };
};

const heldPiecesOf = (
  request: PlacedTeamRuleSet & { readonly discipline: DisciplineFile },
): Read<readonly HeldPiece[]> => {
  const mechanisms = [
    ...new Set(
      request.discipline.clauses.flatMap((clause) =>
        clause.kind === "mechanical" ? clause.mechanisms : [],
      ),
    ),
  ];
  const held = everyOk({
    entries: mechanisms,
    resolve: (mechanism): Read<readonly HeldPiece[]> => {
      const place = { ...request, ruleSetRoot: request.root, mechanism };
      if (
        request.fileText.exists({
          path: pieceFilePath({ ...place, discipline: request.discipline.id }),
        }) === "absent"
      ) {
        return { outcome: "ok", value: [] };
      }
      const file = readPieceFile(place);
      return file.outcome === "failed"
        ? file
        : { outcome: "ok", value: [{ mechanism, file: file.value }] };
    },
  });
  return held.outcome === "failed" ? held : { outcome: "ok", value: held.value.flat() };
};

const folderFileOf = (
  request: PlacedTeamRuleSet & {
    readonly folder: AbsolutePath;
    readonly within: readonly string[];
  },
): Read<readonly FolderFile[]> => {
  const path = request.path.join({ segments: [request.folder, ...request.within] });
  const file = request.within.join(PATH_SEPARATOR);
  if (!isRepoPath(file)) {
    return invalid({ path, detail: `${file} is not a path inside the piece folder` });
  }
  const text = request.fileText.read({ path });
  return text.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unreadable", path, detail: text.error.detail } }
    : { outcome: "ok", value: [{ file, text: text.value }] };
};

const folderFilesOf = (
  request: PlacedTeamRuleSet & {
    readonly folder: AbsolutePath;
    readonly within: readonly string[];
  },
): Read<readonly FolderFile[]> => {
  const path = request.path.join({ segments: [request.folder, ...request.within] });
  if (!isAbsolutePath(path)) {
    return invalid({ path, detail: `${path} is not an absolute path` });
  }
  const entries = request.directory.list({ path });
  if (entries.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: entries.error.path, detail: entries.error.detail },
    };
  }
  const files = everyOk({
    entries: entries.value.filter(
      (entry) => request.within.length > 0 || entry.name !== PIECE_FILE,
    ),
    resolve: (entry): Read<readonly FolderFile[]> =>
      entry.kind === "directory"
        ? folderFilesOf({ ...request, within: [...request.within, entry.name] })
        : folderFileOf({ ...request, within: [...request.within, entry.name] }),
  });
  return files.outcome === "failed" ? files : { outcome: "ok", value: files.value.flat() };
};

const PIECE_MODULE_SETTINGS: Readonly<Record<EngineId, z.ZodType<string>>> = {
  walker: z.looseObject({ module: z.string() }).transform(({ module }) => module),
  eslint: z.looseObject({ pluginModule: z.string() }).transform(({ pluginModule }) => pluginModule),
};

const moduleOf = (request: {
  readonly mechanism: EngineId;
  readonly settings: unknown;
}): RepoPath | undefined => {
  const module = PIECE_MODULE_SETTINGS[request.mechanism].safeParse(request.settings).data;
  return module !== undefined && isRepoPath(module) ? module : undefined;
};

const versionOnePieceOf = (
  request: PlacedTeamRuleSet & {
    readonly discipline: DisciplineId;
    readonly held: HeldPiece;
    readonly entry: PieceFile["clauses"][number];
  },
): Read<VersionOnePiece> => {
  const { held, entry } = request;
  const segments = [
    VERSION_ONE_ENGINES_FOLDER,
    versionOneEngineNameOf(held.mechanism),
    request.discipline,
  ];
  const folder = repoPathIn({ ...request, segments });
  if (folder.outcome === "failed") return folder;
  const absolute = request.path.join({ segments: [request.root, ...segments] });
  if (!isAbsolutePath(absolute)) {
    return invalid({ path: absolute, detail: `${absolute} is not an absolute path` });
  }
  const module = moduleOf({ mechanism: held.mechanism, settings: entry.settings });
  if (module === undefined) {
    return invalid({
      path: request.path.join({ segments: [absolute, PIECE_FILE] }),
      detail: `the settings of ${entry.clause} name no piece module`,
    });
  }
  const files = folderFilesOf({ ...request, folder: absolute, within: [] });
  return files.outcome === "failed"
    ? files
    : {
        outcome: "ok",
        value: {
          mechanism: held.mechanism,
          settings: entry.settings,
          checkSettings: entry.clauseSettings,
          editions: entry.editions,
          folder: folder.value,
          module,
          files: files.value,
        },
      };
};

const teamClauseOf = (
  request: PlacedTeamRuleSet & {
    readonly summarised: SummarisedDiscipline;
    readonly pieces: readonly HeldPiece[];
    readonly names: ReadonlyMap<string, ClauseNaming>;
    readonly definition: MechanicalDefinition;
  },
): Read<VersionOneTeamClause> => {
  const { definition, summarised } = request;
  const discipline = summarised.file.id;
  const pieces = everyOk({
    entries: request.pieces.flatMap((held) => {
      const entry = held.file.clauses.find(({ clause }) => clause === definition.id);
      return entry === undefined ? [] : [{ held, entry }];
    }),
    resolve: ({ held, entry }) => versionOnePieceOf({ ...request, discipline, held, entry }),
  });
  return pieces.outcome === "failed"
    ? pieces
    : {
        outcome: "ok",
        value: {
          clause: { ruleSet: { name: request.ruleSet.name }, discipline, clause: definition.id },
          naming: request.names.get(`${discipline}${CLAUSE_SEPARATOR}${definition.id}`) ?? {
            naming: "unnamed",
          },
          summary: summarised.summaries.get(definition.id) ?? definition.id,
          anchor: definition.anchor,
          exceptions: definition.exceptions,
          cases: definition.cases,
          pieces: pieces.value,
        },
      };
};

type DisciplineLayout = {
  readonly clauses: readonly VersionOneTeamClause[];
  readonly files: readonly RepoPath[];
};

const disciplineLayoutOf = (
  request: PlacedTeamRuleSet & {
    readonly discipline: DisciplineId;
    readonly names: ReadonlyMap<string, ClauseNaming>;
  },
): Read<DisciplineLayout> => {
  const summarised = readSummarisedDisciplineFile({
    fileText: request.fileText,
    path: request.path.join({
      segments: [request.root, RULES_FOLDER, request.discipline, VERSION_ONE_RULE_FILE],
    }),
    discipline: request.discipline,
  });
  if (summarised.outcome === "failed") return summarised;
  const pieces = heldPiecesOf({ ...request, discipline: summarised.value.file });
  if (pieces.outcome === "failed") return pieces;
  const clauses = everyOk({
    entries: summarised.value.file.clauses.flatMap((definition) =>
      definition.kind === "mechanical" ? [definition] : [],
    ),
    resolve: (definition) =>
      teamClauseOf({
        ...request,
        summarised: summarised.value,
        pieces: pieces.value,
        definition,
      }),
  });
  const files = everyOk({
    entries: [
      [RULES_FOLDER, request.discipline, VERSION_ONE_RULE_FILE],
      ...pieces.value.map(({ mechanism }) => [
        VERSION_ONE_ENGINES_FOLDER,
        versionOneEngineNameOf(mechanism),
        request.discipline,
        PIECE_FILE,
      ]),
    ],
    resolve: (segments) => repoPathIn({ ...request, segments }),
  });
  if (clauses.outcome === "failed") return clauses;
  if (files.outcome === "failed") return files;
  return { outcome: "ok", value: { clauses: clauses.value, files: files.value } };
};

const unclaimedNameOf = (request: {
  readonly names: ReadonlyMap<string, unknown>;
  readonly clauses: readonly VersionOneTeamClause[];
}): string | undefined => {
  const claimed = new Set(
    request.clauses.map(({ clause }) => `${clause.discipline}${CLAUSE_SEPARATOR}${clause.clause}`),
  );
  return [...request.names.keys()].find((name) => !claimed.has(name));
};

export const readVersionOneTeamLayout = (
  request: PlacedTeamRuleSet,
): Read<VersionOneTeamLayout> => {
  const namesPath = request.path.join({ segments: [request.root, VERSION_TWO_NAMES_FILE] });
  const namesFile = repoPathIn({ ...request, segments: [VERSION_TWO_NAMES_FILE] });
  if (namesFile.outcome === "failed") return namesFile;
  const read = readVersionTwoNames({ fileText: request.fileText, path: namesPath });
  if (read.outcome === "failed") return read;
  const names = new Map(
    [...read.value.clauses].map(([clause, { check, title }]): readonly [string, ClauseNaming] => [
      clause,
      { naming: "named", check, title },
    ]),
  );
  const disciplines = disciplineIdsOf(request);
  if (disciplines.outcome === "failed") return disciplines;
  const layouts = everyOk({
    entries: disciplines.value,
    resolve: (discipline) => disciplineLayoutOf({ ...request, discipline, names }),
  });
  if (layouts.outcome === "failed") return layouts;
  const clauses = layouts.value.flatMap((layout) => layout.clauses);
  const unclaimed = unclaimedNameOf({ names, clauses });
  return unclaimed === undefined
    ? {
        outcome: "ok",
        value: {
          ruleSet: { name: request.ruleSet.name },
          location: request.ruleSet.location,
          namesFile: namesFile.value,
          clauses,
          definitions: read.value.definitions,
          versionOneFiles: layouts.value.flatMap((layout) => layout.files),
        },
      }
    : invalid({
        path: namesPath,
        detail: `${unclaimed} names no mechanical clause of rule set ${request.ruleSet.name}`,
      });
};

export const teamUpgradeNamesOf = (request: {
  readonly layout: VersionOneTeamLayout;
  readonly namesPath: string;
}): Read<VersionOneNames> => {
  const names = versionOneNamesOf({
    document: {
      version: 1,
      clauses: request.layout.clauses.flatMap(({ clause, naming, anchor }) =>
        naming.naming === "named"
          ? [
              {
                clause: clauseAddressText({ address: clause }),
                sight: { kind: "one-symptom", symptom: naming.check.symptom },
                checks: [checkAddressOfNames(naming.check)],
                anchor,
              },
            ]
          : [],
      ),
      recordKinds: {},
    },
  });
  return names.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "file-malformed", path: request.namesPath, detail: names.error },
      }
    : names;
};

export const usedTeamRuleSetsOf = (selection: ConsumerSelectionFile): readonly TeamRuleSet[] => {
  const used = new Set(
    selection.clauses.flatMap(([{ ruleSet }]) => (ruleSet === TOOL_RULE_SET ? [] : [ruleSet.name])),
  );
  return selection.ruleSets.flatMap(([name, location]) =>
    used.has(name) ? [{ name, location }] : [],
  );
};

const placedOf = (
  request: TeamLayoutSources & { readonly ruleSet: TeamRuleSet },
): Read<PlacedTeamRuleSet> => {
  const root = ruleSetRootOf({
    ...request,
    ruleSet: { name: request.ruleSet.name },
    ruleSets: [request.ruleSet],
  });
  return root.outcome === "failed"
    ? root
    : { outcome: "ok", value: { ...request, root: root.value } };
};

const refusedWhenHalfUpgraded = (
  request: PlacedTeamRuleSet,
): Read<readonly VersionOneTeamLayout[]> => {
  const itemRoot = request.path.join({ segments: [request.root, ...SYMPTOM_CATALOGUE_SEGMENTS] });
  if (!isAbsolutePath(itemRoot)) {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: itemRoot, detail: "is not an absolute path" },
    };
  }
  const files = versionOneRuleFilesOf({ ...request, itemRoot });
  if (files.outcome === "failed") {
    return files;
  }
  return files.value.length > 0
    ? {
        outcome: "failed",
        error: { kind: "rule-set-half-upgraded", path: request.root, files: files.value },
      }
    : { outcome: "ok", value: [] };
};

const layoutsNeededOf = (request: PlacedTeamRuleSet): Read<readonly VersionOneTeamLayout[]> => {
  const held = readBoundCatalogue({
    ...request,
    ruleSetRoot: request.root,
    ruleSet: { name: request.ruleSet.name },
    inheritedRecordKinds: request.toolRecordKinds,
  });
  if (held.outcome === "ok") {
    return held.value.held === "catalogue"
      ? refusedWhenHalfUpgraded(request)
      : { outcome: "ok", value: [] };
  }
  if (held.error.kind !== "rule-set-not-upgraded") {
    return held;
  }
  const layout = readVersionOneTeamLayout(request);
  return layout.outcome === "failed" ? layout : { outcome: "ok", value: [layout.value] };
};

export const versionOneTeamLayoutsOf = (
  request: TeamLayoutSources & { readonly selection: ConsumerSelectionFile },
): Result<readonly VersionOneTeamLayout[], LoadFailure> => {
  const layouts = everyOk({
    entries: usedTeamRuleSetsOf(request.selection),
    resolve: (ruleSet): Read<readonly VersionOneTeamLayout[]> => {
      const placed = placedOf({ ...request, ruleSet });
      return placed.outcome === "failed" ? placed : layoutsNeededOf(placed.value);
    },
  });
  return layouts.outcome === "failed" ? layouts : { outcome: "ok", value: layouts.value.flat() };
};

export const teamUpgradeNamesAt = (
  request: TeamLayoutSources & { readonly ruleSet: TeamRuleSet; readonly root: AbsolutePath },
): Read<VersionOneNames> => {
  const layout = readVersionOneTeamLayout(request);
  return layout.outcome === "failed"
    ? layout
    : teamUpgradeNamesOf({
        layout: layout.value,
        namesPath: request.path.join({ segments: [request.root, VERSION_TWO_NAMES_FILE] }),
      });
};
