import {
  type CheckAddressText,
  checkAddressOfNames,
  type CheckNames,
} from "../../../domain/language-layer/check-address-text.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { isRepoPath } from "../../../domain/repository/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetLocation } from "../../../domain/settings/selection/selection-file.ts";
import type { PlanRefusal, TeamNameMissing } from "../../ports/upgrade/plan-refusal.ts";
import type {
  ImportsRewrittenOf,
  ItemTextOf,
  TeamDefinition,
  TeamDefinitionAddress,
  TeamDefinitionKind,
  VersionOnePiece,
  VersionOneTeamClause,
  VersionOneTeamLayout,
} from "../../ports/upgrade/version-one-team-layout.ts";
import type { PlannedRepoFile } from "../proof/planned-repo-file.ts";
import { pieceFolderFilesOf } from "./piece-folders.ts";

export type TeamLayoutPlan = {
  readonly files: readonly PlannedRepoFile[];
  readonly removed: readonly RepoPath[];
  readonly folders: readonly RepoPath[];
};

export type TeamLayoutPlanRequest = {
  readonly layouts: readonly VersionOneTeamLayout[];
  readonly toolChecks: readonly CheckAddressText[];
  readonly itemTextOf: ItemTextOf;
  readonly importsRewrittenOf: ImportsRewrittenOf;
};

type NamedClause = VersionOneTeamClause & { readonly check: CheckNames; readonly title: string };

type PlannedText = { readonly segments: readonly string[]; readonly text: string };

type LayoutTexts = {
  readonly layout: VersionOneTeamLayout;
  readonly clauses: readonly NamedClause[];
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

const takenChecksOf = (request: {
  readonly layout: VersionOneTeamLayout;
  readonly toolChecks: readonly CheckAddressText[];
}): readonly TeamNameMissing[] =>
  namedClausesOf(request).flatMap(({ clause, check }): readonly TeamNameMissing[] =>
    request.toolChecks.includes(checkAddressOfNames(check))
      ? [{ missing: "own-check-name", clause, check, namesFile: request.layout.namesFile }]
      : [],
  );

const missingNamesOf = (request: {
  readonly layouts: readonly VersionOneTeamLayout[];
  readonly toolChecks: readonly CheckAddressText[];
}): readonly TeamNameMissing[] =>
  request.layouts.flatMap((layout) => {
    const { namesFile } = layout;
    const held = new Set(layout.definitions.map(definitionKeyOf));
    return [
      ...takenChecksOf({ layout, toolChecks: request.toolChecks }),
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

const pieceFilesRemovedOf = (request: {
  readonly layout: VersionOneTeamLayout;
}): readonly RepoPath[] =>
  request.layout.clauses.flatMap(({ pieces }) =>
    pieces.flatMap(({ folder, files }) =>
      files.flatMap(({ file }) => {
        const path = `${folder}${PATH_SEPARATOR}${file}`;
        return isRepoPath(path) ? [path] : [];
      }),
    ),
  );

const plannedLayoutOf = (request: {
  readonly layout: VersionOneTeamLayout;
  readonly itemTextOf: ItemTextOf;
  readonly importsRewrittenOf: ImportsRewrittenOf;
}): Result<TeamLayoutPlan, PlanRefusal> => {
  const { location } = request.layout;
  const clauses = namedClausesOf(request);
  const texts = firstRefusalOf(
    layoutTextsOf({ ...request, clauses }).map((planned) => placedTextOf({ location, planned })),
  );
  if (texts.outcome === "failed") return texts;
  const folderFiles = pieceFolderFilesOf({
    rootSegments: rootSegmentsOf(request.layout),
    members: clauses.flatMap(({ clause, check, pieces }) =>
      pieces.map((piece) => ({ clause: clause.clause, check, piece })),
    ),
    importsRewrittenOf: request.importsRewrittenOf,
  });
  if (folderFiles.outcome === "failed") return folderFiles;
  const removed = [
    ...request.layout.versionOneFiles,
    ...pieceFilesRemovedOf(request),
    request.layout.namesFile,
  ];
  return {
    outcome: "ok",
    value: {
      files: [...texts.value, ...folderFiles.value],
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
