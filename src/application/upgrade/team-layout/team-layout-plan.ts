import type { CheckNames } from "../../../domain/language-layer/check-address-text.ts";
import type { RecordKind } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { isRepoPath } from "../../../domain/repository/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetLocation } from "../../../domain/settings/selection/selection-file.ts";
import type { PlanRefusal, TeamNameMissing } from "../../ports/upgrade/plan-refusal.ts";
import type {
  ItemTextOf,
  TeamDefinition,
  TeamDefinitionAddress,
  TeamDefinitionKind,
  VersionOnePiece,
  VersionOneTeamClause,
  VersionOneTeamLayout,
} from "../../ports/upgrade/version-one-team-layout.ts";
import type { PlannedRepoFile } from "../proof/planned-repo-file.ts";

export type TeamLayoutPlan = {
  readonly files: readonly PlannedRepoFile[];
  readonly removed: readonly RepoPath[];
  readonly folders: readonly RepoPath[];
};

export type TeamLayoutPlanRequest = {
  readonly layouts: readonly VersionOneTeamLayout[];
  readonly recordKinds: readonly RecordKind[];
  readonly itemTextOf: ItemTextOf;
};

type NamedClause = VersionOneTeamClause & { readonly check: CheckNames; readonly title: string };

type PlannedText = { readonly segments: readonly string[]; readonly text: string };

type LayoutTexts = {
  readonly layout: VersionOneTeamLayout;
  readonly clauses: readonly NamedClause[];
  readonly recordKinds: readonly RecordKind[];
  readonly itemTextOf: ItemTextOf;
};

const RULES_FOLDER = "rules";

const LANGUAGE_FOLDER = "typescript";

const SYMPTOMS_FOLDER = "symptoms";

const ENGINES_FOLDER = "engines";

const ITEM_EXTENSION = ".md";

const SUMMARY_SEPARATOR = "; ";

const PIECE_VERSION = 2;

const JSON_INDENT = 2;

const PATH_SEPARATOR = "/";

const DEFINITION_FOLDERS: Readonly<Record<Exclude<TeamDefinitionKind, "symptom">, string>> = {
  principle: "principles",
  rule: "rules",
  case: "cases",
};

const documentTextOf = (document: unknown): string =>
  `${JSON.stringify(document, null, JSON_INDENT)}\n`;

const definitionKeyOf = (address: TeamDefinitionAddress): string =>
  `${address.kind}${PATH_SEPARATOR}${address.name}`;

const namedClausesOf = (request: {
  readonly layout: VersionOneTeamLayout;
}): readonly NamedClause[] =>
  request.layout.clauses.flatMap((clause) =>
    clause.naming.naming === "named"
      ? [{ ...clause, check: clause.naming.check, title: clause.naming.title }]
      : [],
  );

const reachedDefinitionsOf = (request: {
  readonly held: ReadonlyMap<string, TeamDefinition>;
  readonly pending: readonly TeamDefinitionAddress[];
  readonly reached: ReadonlyMap<string, TeamDefinitionAddress>;
}): ReadonlyMap<string, TeamDefinitionAddress> => {
  const fresh = request.pending.filter((address) => !request.reached.has(definitionKeyOf(address)));
  if (fresh.length === 0) return request.reached;
  return reachedDefinitionsOf({
    held: request.held,
    pending: fresh.flatMap((address) => request.held.get(definitionKeyOf(address))?.refers ?? []),
    reached: new Map([
      ...request.reached,
      ...fresh.map((address): [string, TeamDefinitionAddress] => [
        definitionKeyOf(address),
        address,
      ]),
    ]),
  });
};

const neededDefinitionsOf = (request: {
  readonly layout: VersionOneTeamLayout;
}): readonly TeamDefinitionAddress[] => [
  ...reachedDefinitionsOf({
    held: new Map(
      request.layout.definitions.map((definition) => [definitionKeyOf(definition), definition]),
    ),
    pending: namedClausesOf(request).map(({ check }): TeamDefinitionAddress => ({
      kind: "symptom",
      name: check.symptom,
    })),
    reached: new Map(),
  }).values(),
];

const missingNamesOf = (request: {
  readonly layouts: readonly VersionOneTeamLayout[];
}): readonly TeamNameMissing[] =>
  request.layouts.flatMap((layout) => {
    const { namesFile } = layout;
    const held = new Set(layout.definitions.map(definitionKeyOf));
    return [
      ...layout.clauses.flatMap(({ clause, naming }): readonly TeamNameMissing[] =>
        naming.naming === "unnamed" ? [{ missing: "clause", clause, namesFile }] : [],
      ),
      ...neededDefinitionsOf({ layout }).flatMap((definition): readonly TeamNameMissing[] =>
        held.has(definitionKeyOf(definition))
          ? []
          : [{ missing: "definition", definition, namesFile }],
      ),
    ];
  });

const itemSegmentsOf = (request: { readonly definition: TeamDefinition }): readonly string[] =>
  request.definition.kind === "symptom"
    ? [
        RULES_FOLDER,
        LANGUAGE_FOLDER,
        SYMPTOMS_FOLDER,
        `${request.definition.name}${ITEM_EXTENSION}`,
      ]
    : [
        RULES_FOLDER,
        DEFINITION_FOLDERS[request.definition.kind],
        `${request.definition.name}${ITEM_EXTENSION}`,
      ];

const seenOf = (request: {
  readonly clauses: readonly NamedClause[];
  readonly symptom: string;
}): string =>
  [
    ...new Set(
      request.clauses
        .filter(({ check }) => check.symptom === request.symptom)
        .map(({ summary }) => summary),
    ),
  ].join(SUMMARY_SEPARATOR);

const definitionTextsOf = (request: LayoutTexts): readonly PlannedText[] => [
  ...request.layout.definitions.map((definition): PlannedText => ({
    segments: itemSegmentsOf({ definition }),
    text: request.itemTextOf({
      title: definition.title,
      facts:
        definition.kind === "symptom"
          ? {
              ...definition.facts,
              seen: seenOf({ clauses: request.clauses, symptom: definition.name }),
            }
          : definition.facts,
    }),
  })),
  ...request.recordKinds.map((kind): PlannedText => ({
    segments: [RULES_FOLDER, "record-kinds", `${kind.name}${ITEM_EXTENSION}`],
    text: request.itemTextOf({ title: kind.title, facts: { phrase: kind.phrase } }),
  })),
];

const checkTextsOf = (request: LayoutTexts): readonly PlannedText[] =>
  request.clauses.map(({ check, title }) => ({
    segments: [
      RULES_FOLDER,
      LANGUAGE_FOLDER,
      SYMPTOMS_FOLDER,
      check.symptom,
      `${check.check}${ITEM_EXTENSION}`,
    ],
    text: request.itemTextOf({ title, facts: {} }),
  }));

const pieceDeclarationOf = (request: {
  readonly clause: NamedClause;
  readonly piece: VersionOnePiece;
}): unknown => ({
  version: PIECE_VERSION,
  exceptions: request.clause.exceptions,
  checkSettings: request.piece.checkSettings,
  anchor: request.clause.anchor,
  settings: request.piece.settings,
  editions: request.piece.editions.declared,
});

const pieceTextsOf = (request: { readonly clause: NamedClause }): readonly PlannedText[] =>
  request.clause.pieces.flatMap((piece) => {
    const { check } = request.clause;
    const folder = [ENGINES_FOLDER, piece.mechanism, check.symptom, check.check];
    return [
      {
        segments: [...folder, "piece.json"],
        text: documentTextOf(pieceDeclarationOf({ clause: request.clause, piece })),
      },
      {
        segments: [...folder, `${check.check}.examples.json`],
        text: documentTextOf(request.clause.cases),
      },
      ...piece.files.map(({ file, text }) => ({
        segments: [...folder, ...file.split(PATH_SEPARATOR)],
        text,
      })),
    ];
  });

const layoutTextsOf = (request: LayoutTexts): readonly PlannedText[] => [
  ...definitionTextsOf(request),
  ...checkTextsOf(request),
  ...request.clauses.flatMap((clause) => pieceTextsOf({ clause })),
];

const rootSegmentsOf = (request: { readonly location: RuleSetLocation }): readonly string[] =>
  request.location.location === "repo-root" ? [] : request.location.path.split(PATH_SEPARATOR);

const placedFileOf = (request: {
  readonly location: RuleSetLocation;
  readonly segments: readonly string[];
}): Result<RepoPath, PlanRefusal> => {
  const path = [...rootSegmentsOf(request), ...request.segments].join(PATH_SEPARATOR);
  return isRepoPath(path)
    ? { outcome: "ok", value: path }
    : { outcome: "failed", error: { kind: "rule-set-path-unplaceable", path } };
};

const placedTextOf = (request: {
  readonly location: RuleSetLocation;
  readonly planned: PlannedText;
}): Result<PlannedRepoFile, PlanRefusal> => {
  const placed = placedFileOf({ location: request.location, segments: request.planned.segments });
  return placed.outcome === "failed"
    ? placed
    : { outcome: "ok", value: { file: placed.value, text: request.planned.text } };
};

const pieceFileRemovedOf = (request: {
  readonly folder: RepoPath;
  readonly file: RepoPath;
}): Result<RepoPath, PlanRefusal> => {
  const path = `${request.folder}${PATH_SEPARATOR}${request.file}`;
  return isRepoPath(path)
    ? { outcome: "ok", value: path }
    : { outcome: "failed", error: { kind: "rule-set-path-unplaceable", path } };
};

const pieceFilesRemovedOf = (request: {
  readonly layout: VersionOneTeamLayout;
}): readonly Result<RepoPath, PlanRefusal>[] =>
  request.layout.clauses.flatMap(({ pieces }) =>
    pieces.flatMap(({ folder, files }) =>
      files.map(({ file }) => pieceFileRemovedOf({ folder, file })),
    ),
  );

const foldersOf = (request: {
  readonly layout: VersionOneTeamLayout;
  readonly removed: readonly RepoPath[];
}): readonly string[] => {
  const rootDepth = rootSegmentsOf(request.layout).length;
  return request.removed.flatMap((file) => {
    const segments = file.split(PATH_SEPARATOR);
    return segments
      .slice(0, -1)
      .map((_, index) => segments.slice(0, index + 1).join(PATH_SEPARATOR))
      .slice(rootDepth);
  });
};

const firstRefusalOf = <Value>(
  results: readonly Result<Value, PlanRefusal>[],
): Result<readonly Value[], PlanRefusal> => {
  const refused = results.find((each) => each.outcome === "failed");
  return refused?.outcome === "failed"
    ? refused
    : {
        outcome: "ok",
        value: results.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
      };
};

const plannedLayoutOf = (request: {
  readonly layout: VersionOneTeamLayout;
  readonly recordKinds: readonly RecordKind[];
  readonly itemTextOf: ItemTextOf;
}): Result<TeamLayoutPlan, PlanRefusal> => {
  const { location } = request.layout;
  const files = firstRefusalOf(
    layoutTextsOf({ ...request, clauses: namedClausesOf(request) }).map((planned) =>
      placedTextOf({ location, planned }),
    ),
  );
  if (files.outcome === "failed") return files;
  const pieceFiles = firstRefusalOf(pieceFilesRemovedOf(request));
  if (pieceFiles.outcome === "failed") return pieceFiles;
  const removed = [
    ...request.layout.versionOneFiles,
    ...pieceFiles.value,
    request.layout.namesFile,
  ];
  return {
    outcome: "ok",
    value: {
      files: files.value,
      removed,
      folders: foldersOf({ layout: request.layout, removed }).filter(isRepoPath),
    },
  };
};

const byDepthDeepestFirst = (left: string, right: string): number =>
  right.split(PATH_SEPARATOR).length - left.split(PATH_SEPARATOR).length;

export const teamLayoutPlanOf = (
  request: TeamLayoutPlanRequest,
): Result<TeamLayoutPlan, PlanRefusal> => {
  const missing = missingNamesOf(request);
  if (missing.length > 0) {
    return { outcome: "failed", error: { kind: "team-names-missing", missing } };
  }
  const planned = firstRefusalOf(
    request.layouts.map((layout) => plannedLayoutOf({ ...request, layout })),
  );
  if (planned.outcome === "failed") return planned;
  return {
    outcome: "ok",
    value: {
      files: planned.value.flatMap(({ files }) => files),
      removed: [...new Set(planned.value.flatMap(({ removed }) => removed))],
      folders: [...new Set(planned.value.flatMap(({ folders }) => folders))].toSorted(
        byDepthDeepestFirst,
      ),
    },
  };
};
