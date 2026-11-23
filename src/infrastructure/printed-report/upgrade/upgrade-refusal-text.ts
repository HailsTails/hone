import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { VersionOneReadFailure } from "../../../application/ports/records/version-one-reading.ts";
import type {
  ConfigImportRefusal,
  PairingRefusal,
  PieceFolderSplitFault,
  PlanRefusal,
  TeamConfigRefusal,
  TeamNameMissing,
} from "../../../application/ports/upgrade/plan-refusal.ts";
import type {
  ProofRefusal,
  ProofWriteFailure,
  Unrestored,
} from "../../../application/ports/upgrade/proof-outcome.ts";
import type { OracleFailure } from "../../../application/ports/upgrade/record-answer-oracle.ts";
import type { UpgradeFailure } from "../../../application/ports/upgrade/upgrade-stop.ts";
import type { TeamDefinitionKind } from "../../../application/ports/upgrade/version-one-team-layout.ts";
import { checkAddressOfNames } from "../../../domain/language-layer/check-address-text.ts";
import type { InvalidRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { UpgradeRefusal } from "../../../domain/records/upgrade/upgrade-refusal.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import { TOOL_IDENTITY } from "../../../domain/rule-set/tool-identity.ts";
import type { MisnamedRuleId } from "../../../domain/runner/checks-run-report.ts";
import { runLoadFailureLine } from "../load-failures/load-failure-lines.ts";
import { loadFailureDetail } from "../load-failures/load-failure-text.ts";
import { replacementText } from "../misnamed-lines.ts";

export const UPGRADE_ISSUES_URL = `${TOOL_IDENTITY.repository}/issues`;

export type UpgradeFailureCode = 1 | 2 | 3;

export type UpgradeFailureOutcome = { readonly code: UpgradeFailureCode; readonly text: string };

const NOTHING_CHANGED = "Nothing was changed.";

const VERSION_ONE_PROJECT_MAY_HAVE_CHANGED =
  "version 1's own project may have changed files before it failed; check version control for what it changed.";

const FAULT_IN_HONE = `This is a fault in hone, not in your repository. Report it at ${UPGRADE_ISSUES_URL}, with this output.`;

const unrestoredLineOf = (request: { readonly unrestored: Unrestored }): string => {
  const { written, path, detail } = request.unrestored;
  switch (written) {
    case "file-created":
      return `  delete ${path} (${detail})`;
    case "directory-created":
      return `  delete the empty folder ${path} (${detail})`;
    case "file-replaced":
      return `  restore ${path} from version control (${detail})`;
  }
};

type AfterVersionOne = { readonly removedByVersionOne: readonly RepoPath[] };

export type RepositoryPlacement = {
  readonly repoRoot: AbsolutePath;
  readonly path: Pick<PathPort, "join">;
};

type Placed = AfterVersionOne & { readonly placement: RepositoryPlacement };

const removedByVersionOneLinesOf = (request: Placed): readonly string[] =>
  request.removedByVersionOne.length === 0
    ? []
    : [
        "version 1's own project removed these files, and the upgrade does not put them back; restore them from version control:",
        ...request.removedByVersionOne.map(
          (file) =>
            `  ${request.placement.path.join({ segments: [request.placement.repoRoot, file] })}`,
        ),
      ];

const unrestoredLinesOf = (
  request: Placed & { readonly unrestored: readonly Unrestored[] },
): readonly string[] => {
  const removed = removedByVersionOneLinesOf(request);
  if (removed.length === 0 && request.unrestored.length === 0) {
    return [NOTHING_CHANGED];
  }
  return [
    ...removed,
    ...(request.unrestored.length === 0
      ? []
      : [
          "These files could not be put back; put them right by hand:",
          ...request.unrestored.map((unrestored) => unrestoredLineOf({ unrestored })),
        ]),
  ];
};

const oracleLineOf = (request: { readonly failure: OracleFailure }): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "version-one-run-failed":
      return `version 1's own run could not be made (${failure.detail}). Run hone check and fix its load failure first.`;
    case "finding-not-attributable":
      return `a finding of ${failure.clause} in ${failure.file} names no check of version 2. Report it at ${UPGRADE_ISSUES_URL}.`;
    case "record-doubly-held":
      return `${failure.clause} in ${failure.file} is held by both a file carve-out and an authorised location. Remove one of them first, then run the upgrade again.`;
    case "projection-not-current":
      return `the version 1 projection ${failure.file} is ${failure.state}. ${projectionActionOf({ state: failure.state })}`;
  }
};

const projectionActionOf = (request: {
  readonly state: Extract<OracleFailure, { readonly kind: "projection-not-current" }>["state"];
}): string => {
  switch (request.state) {
    case "out-of-date":
    case "missing":
      return "Run hone project with your version 1 release, commit what it writes, then run the upgrade again.";
    case "not-applied":
    case "not-included":
    case "unconfigured":
      return "Run hone check with your version 1 release, fix what it reports, then run the upgrade again.";
  }
};

const folderTextOf = (request: { readonly folder: string }): string =>
  request.folder === "" ? "the repository root" : request.folder;

const specifierOf = (request: { readonly projection: string }): string =>
  `./${request.projection.slice(request.projection.lastIndexOf("/") + 1)}`;

const mappingLineOf = (request: { readonly refusal: UpgradeRefusal }): string => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "clause-without-check":
      return `${refusal.clause} has no version 2 check to run it, and version 2 does not carry the clauses of a version 1 team rule set. Remove it from disciplines.json to upgrade without it, or stay on version 1.`;
    case "no-engine-on-mechanism":
      return `${refusal.check} has no engine on the ${refusal.mechanism} mechanism. ${FAULT_IN_HONE}`;
    case "two-engines-on-mechanism":
      return `${refusal.check} could run on ${refusal.engines.join(" or ")} through the ${refusal.mechanism} mechanism; the upgrade cannot choose. ${FAULT_IN_HONE}`;
    case "record-answers-nothing":
      return `the file carve-out for ${refusal.clause} in ${refusal.file} answers ${refusal.credited === "nothing" ? "no finding" : "only a suppression no version 2 record can hold"}. Remove it, or fix the file it names, then run the upgrade again.`;
    case "records-name-refused":
      return `${refusal.name} is not a name version 2 can file records under. ${FAULT_IN_HONE}`;
  }
};

const configLineOf = (request: { readonly refusal: ConfigImportRefusal }): string => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "no-projection-import":
      return `${refusal.file} holds no static default import of ${refusal.projection}. Change its import of it to the form import projection from "${specifierOf({ projection: refusal.projection })}", then run the upgrade again.`;
    case "several-projection-imports":
      return `${refusal.file} imports the version 1 projection ${refusal.count} times. Import it once.`;
    case "projection-named-elsewhere":
      return `${refusal.file} names a version 1 projection outside the imports the upgrade rewrites, or imports one version 1 did not write. Remove the other mention or import, then run the upgrade again.`;
  }
};

const projectionFailureLineOf = (request: { readonly failure: RunLoadFailure }): string => {
  const line = runLoadFailureLine({ failure: request.failure, upgradeCommand: undefined });
  return request.failure.kind === "not-ready-yet" &&
    request.failure.what.thing === "eslint-config-roots"
    ? `version 2 cannot run this repository yet (${line}). Do what it names, or stay on version 1 until version 2 runs it, then run the upgrade again.`
    : `version 2's projection could not be made (${line}). Fix what it names, then run the upgrade again.`;
};

const pairingLineOf = (request: { readonly refusal: PairingRefusal }): string => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "version-one-projection-unpaired":
      return `the version 1 projection ${refusal.projection} has no version 2 projection to take its place, since version 2 runs no lint config in ${folderTextOf({ folder: refusal.folder })}. Remove it and its import in ${refusal.config}, then run the upgrade again.`;
    case "version-two-projection-unpaired":
      return `version 2 would project ${refusal.file}, but version 1 has no projection in ${folderTextOf({ folder: refusal.folder })}. With your version 1 release, run hone project and import what it writes in the lint config of ${folderTextOf({ folder: refusal.folder })}, commit, then run the upgrade again.`;
  }
};

const DEFINITION_LISTINGS: Readonly<Record<TeamDefinitionKind, string>> = {
  principle: "principles",
  rule: "rules",
  case: "cases",
  symptom: "symptoms",
};

const teamNameMissingLineOf = (request: { readonly missing: TeamNameMissing }): string => {
  const { missing } = request;
  switch (missing.missing) {
    case "clause":
      return `${clauseAddressText({ address: missing.clause })} has no version 2 name: add ${missing.clause.discipline}#${missing.clause.clause} with its check and title under "clauses" in ${missing.namesFile}`;
    case "own-check-name":
      return `${clauseAddressText({ address: missing.clause })} is named ${checkAddressOfNames(missing.check)}, which is already one of Hone's checks: give it a check name of its own under "clauses" in ${missing.namesFile}`;
    case "definition":
      return `the ${missing.definition.kind} ${missing.definition.name} has no definition: add it under "${DEFINITION_LISTINGS[missing.definition.kind]}" in ${missing.namesFile}`;
  }
};

const pieceFolderSplitLineOf = (request: {
  readonly folder: RepoPath;
  readonly split: PieceFolderSplitFault;
}): string => {
  const { folder, split } = request;
  switch (split.fault) {
    case "module-shared":
      return `one module, ${folder}/${split.module}, serves ${split.clauses.map((address) => clauseAddressText({ address })).join(", ")}, which version 2 makes separate checks, and a module moves to one check only. Give each clause a module of its own, then run the upgrade again.`;
    case "specifier-not-literal":
      return `${split.file}:${split.line} names a module with an expression rather than a string, so the upgrade cannot point it at where the files of ${folder} move. Write the path as a string, then run the upgrade again.`;
    case "target-not-moved":
      return `${split.file}:${split.line} imports a file of ${folder} that is not there, so the upgrade cannot point it at where the folder's files move. Fix or remove the import, then run the upgrade again.`;
  }
};

const planLinesOf = (request: { readonly refusal: PlanRefusal }): readonly string[] => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "carve-out-unanswered":
      return [
        `the carve-out for ${refusal.clause} in ${refusal.file} was given no answer. ${FAULT_IN_HONE}`,
      ];
    case "location-unanswered":
      return [
        `the authorised location for ${refusal.clause} in ${refusal.file} was given no answer. ${FAULT_IN_HONE}`,
      ];
    case "projection-failed":
      return [projectionFailureLineOf({ failure: refusal.failure })];
    case "projections-unpaired":
      return [pairingLineOf({ refusal: refusal.refusal })];
    case "team-config-refused":
      return teamConfigLinesOf({ refusal: refusal.refusal });
    case "slice-left-in-place":
      return refusal.files.map(
        (file) =>
          `the version 1 projection ${file} belongs to no config root and is out of date. Delete it or restore its config root, commit, then run the upgrade again.`,
      );
    case "team-names-missing":
      return [
        "the version 2 layout needs names and definitions your team has not written, and these are judgements your team makes, so the upgrade does not write them:",
        ...refusal.missing.map((missing) => `  ${teamNameMissingLineOf({ missing })}`),
        `Write each in the names file, with the facts docs/extending.md gives each kind, then run the upgrade again.`,
      ];
    case "piece-folder-unsplittable":
      return [pieceFolderSplitLineOf({ folder: refusal.folder, split: refusal.split })];
    case "rule-set-path-unplaceable":
      return [
        `the upgrade would write ${refusal.path}, which is not a path inside the repository. ${FAULT_IN_HONE}`,
      ];
    case "mapping-refused":
      return refusal.refusals.map((each) => mappingLineOf({ refusal: each }));
    case "reach-beyond-entries":
      return [
        `the version 2 records would reach beyond the version 1 entries: ${refusal.records.map(({ symptom, file }) => `${symptom} in ${file}`).join(", ")}.`,
        FAULT_IN_HONE,
      ];
    case "config-import-refused":
      return [configLineOf({ refusal: refusal.refusal })];
  }
};

const writeLineOf = (request: { readonly failure: ProofWriteFailure }): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "path-already-exists":
      return `${failure.path} already exists. Move it aside, then run the upgrade again.`;
    case "replaced-file-unreadable":
      return `${failure.path} could not be read to be replaced (${failure.detail}). Make it readable, then run the upgrade again.`;
    case "directory-uncreatable":
      return `${failure.path} could not be created (${failure.detail}). Fix what the detail names, then run the upgrade again.`;
    case "unwritable":
      return `${failure.path} could not be written (${failure.detail}). Fix what the detail names, then run the upgrade again.`;
  }
};

const recordsRefusalLinesOf = (request: {
  readonly invalid: readonly InvalidRecord[];
}): readonly string[] =>
  request.invalid.map(
    ({ place, problem }) => `${place.file} entry ${place.index}: ${problem.kind}`,
  );

const readFailureLinesOf = (request: {
  readonly failure: VersionOneReadFailure;
}): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "version-one-unreadable":
      return [
        `version 1's files could not be read (${loadFailureDetail({ failure: failure.failure })}). Run hone check and fix its load failure first.`,
      ];
    case "records-refused":
      return failure.refusal.kind === "invalid-records"
        ? [
            "the version 1 records are invalid; fix them first:",
            ...recordsRefusalLinesOf({ invalid: failure.refusal.invalid }),
          ]
        : [`a version 1 record in ${failure.refusal.place.file} is not JSON. Fix it first.`];
  }
};

const teamConfigLinesOf = (request: { readonly refusal: TeamConfigRefusal }): readonly string[] => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "no-file-imports-projection":
      return [
        `no file imports ${refusal.projection} with a static default import. Change the ESLint config next to it to import it in the form import projection from "${specifierOf({ projection: refusal.projection })}", then run the upgrade again.`,
      ];
    case "config-candidate-unreadable":
      return [
        `${refusal.file} could not be read (${refusal.detail}). Make it readable, then run the upgrade again.`,
      ];
  }
};

const removalLineOf = (request: {
  readonly failure: Extract<ProofRefusal, { readonly kind: "removal-failed" }>["failure"];
}): string =>
  request.failure.kind === "unremovable"
    ? `${request.failure.path} could not be removed (${request.failure.detail})`
    : `${request.failure.path} is outside ${request.failure.root}`;

const differenceCauseLineOf = (request: {
  readonly failure: Extract<ProofRefusal, { readonly kind: "differences" }>;
}): string =>
  request.failure.writtenReported.length === 0
    ? `Nothing in the two runs shows the cause. Check whether something in your repository explains it; if nothing does, report it at ${UPGRADE_ISSUES_URL}, with this output.`
    : `version 2 reports files the upgrade writes: ${request.failure.writtenReported.join(", ")}. Something in your repository may treat them differently, such as an ESLint config that ignores them; let it check them, then run the upgrade again.`;

const differenceLinesOf = (request: {
  readonly failure: Extract<ProofRefusal, { readonly kind: "differences" }>;
}): readonly string[] =>
  request.failure.differences.flatMap(({ section, onlyBefore, onlyAfter }) => [
    `  ${section}:`,
    ...onlyBefore.map((line) => `    only before: ${line}`),
    ...onlyAfter.map((line) => `    only after: ${line}`),
  ]);

type DirectiveBlock<Directive> = {
  readonly directives: readonly Directive[];
  readonly header: string;
  readonly lineOf: (directive: Directive) => string;
  readonly action: string;
};

const blockOfDirectives = <Directive>(request: DirectiveBlock<Directive>): readonly string[] =>
  request.directives.length === 0
    ? []
    : [request.header, ...request.directives.map(request.lineOf), request.action];

const directiveLinesOf = (request: {
  readonly directives: readonly MisnamedRuleId[];
}): readonly string[] => [
  ...blockOfDirectives({
    directives: request.directives.flatMap((directive) =>
      directive.kind === "version-1-id" ? [directive] : [],
    ),
    header: "these inline directives name a version 1 rule id, which version 2 names differently:",
    lineOf: ({ file, line, ruleId, replacedBy }) =>
      `  ${file}:${line} ${ruleId}: write ${replacementText({ replacedBy })}`,
    action: "Replace each version 1 id with the version 2 id shown, then run the upgrade again.",
  }),
  ...blockOfDirectives({
    directives: request.directives.flatMap((directive) =>
      directive.kind === "names-no-check" ? [directive] : [],
    ),
    header: "these inline directives name a hone rule id that version 2 has no check under:",
    lineOf: ({ file, line, ruleId }) => `  ${file}:${line} ${ruleId}`,
    action: "Fix each one to name a check of version 2, or remove it, then run the upgrade again.",
  }),
];

const uncoveredLineOf = (request: { readonly clauses: readonly ClauseAddress[] }): string =>
  `version 1 already reports ${request.clauses.map((address) => clauseAddressText({ address })).join(", ")} as uncovered. Select or mark each of them in disciplines.json, then run the upgrade again.`;

const proofLinesOf = (request: {
  readonly failure: ProofRefusal;
  readonly placement: RepositoryPlacement;
}): { readonly code: UpgradeFailureCode; readonly lines: readonly string[] } => {
  const { failure, placement } = request;
  switch (failure.kind) {
    case "oracle-failed":
      return { code: 1, lines: [oracleLineOf({ failure: failure.failure }), NOTHING_CHANGED] };
    case "plan-refused":
      return {
        code: 1,
        lines: [
          ...planLinesOf({ refusal: failure.refusal }),
          ...unrestoredLinesOf({ ...failure, placement, unrestored: [] }),
        ],
      };
    case "version-one-run-failed":
      return {
        code: 1,
        lines: [
          `version 1's run failed (${failure.failure.detail}). Run hone check and fix its load failure first.`,
          ...unrestoredLinesOf({ ...failure, placement, unrestored: [] }),
        ],
      };
    case "version-one-uncovered":
      return {
        code: 1,
        lines: [
          uncoveredLineOf({ clauses: failure.clauses }),
          ...unrestoredLinesOf({ ...failure, placement, unrestored: [] }),
        ],
      };
    case "version-one-project-failed":
      return {
        code: 1,
        lines: [
          `version 1's own project failed (${failure.detail}). Run hone project with your version 1 release, fix what it reports, then run the upgrade again.`,
          VERSION_ONE_PROJECT_MAY_HAVE_CHANGED,
        ],
      };
    case "version-one-project-rewrote":
      return {
        code: 1,
        lines: [
          `version 1's own project rewrote ${failure.files.join(", ")}, which the upgrade had already measured. Commit what it wrote, then run the upgrade again.`,
          ...removedByVersionOneLinesOf({ ...failure, placement }),
        ],
      };
    case "unplaceable-path":
      return {
        code: 1,
        lines: [
          `${failure.file} cannot be placed in the repository. ${FAULT_IN_HONE}`,
          ...unrestoredLinesOf({ ...failure, placement, unrestored: [] }),
        ],
      };
    case "removal-refused":
      return {
        code: 1,
        lines: [
          `the version 1 records file ${failure.failure.path} is outside ${failure.failure.root}. ${FAULT_IN_HONE}`,
          ...unrestoredLinesOf({ ...failure, placement, unrestored: [] }),
        ],
      };
    case "write-refused":
      return {
        code: 1,
        lines: [
          writeLineOf({ failure: failure.refusal.failure }),
          ...unrestoredLinesOf({ ...failure, placement, unrestored: failure.refusal.unrestored }),
        ],
      };
    case "team-layout-unreadable":
      return {
        code: 1,
        lines: [
          `the rule set the upgrade wrote from your names file cannot be read (${loadFailureDetail({ failure: failure.failure })}). Correct what it names in the names file, then run the upgrade again.`,
          ...unrestoredLinesOf({ ...failure, placement }),
        ],
      };
    case "version-two-run-failed":
      return {
        code: 1,
        lines: [
          `version 2's run failed (${failure.failure.detail}). ${FAULT_IN_HONE}`,
          ...unrestoredLinesOf({ ...failure, placement }),
        ],
      };
    case "directives-name-no-check":
      return {
        code: 1,
        lines: [
          ...directiveLinesOf({ directives: failure.directives }),
          ...unrestoredLinesOf({ ...failure, placement }),
        ],
      };
    case "differences":
      return {
        code: 1,
        lines: [
          "version 2 does not report what version 1 reported:",
          ...differenceLinesOf({ failure }),
          differenceCauseLineOf({ failure }),
          ...unrestoredLinesOf({ ...failure, placement }),
        ],
      };
    case "removal-failed":
      return {
        code: 3,
        lines: [
          `version 2 is in place (written: ${failure.written.join(", ")}${failure.replaced.length === 0 ? "" : `; replaced: ${failure.replaced.join(", ")}`}), but ${removalLineOf({ failure: failure.failure })}.`,
          "Delete these version 1 files by hand, then commit:",
          ...failure.remaining.map((remaining) => `  ${remaining}`),
        ],
      };
  }
};

export const upgradeFailureOutcomeOf = (request: {
  readonly failure: UpgradeFailure;
  readonly placement: RepositoryPlacement;
}): UpgradeFailureOutcome => {
  const { failure, placement } = request;
  if (failure.kind === "version-one-unreadable" || failure.kind === "records-refused") {
    return {
      code: 1,
      text: `${["upgrade refused:", ...readFailureLinesOf({ failure }), NOTHING_CHANGED].join("\n")}\n`,
    };
  }
  const proof = proofLinesOf({ failure, placement });
  return {
    code: proof.code,
    text: `${[proof.code === 3 ? "upgrade incomplete:" : "upgrade refused:", ...proof.lines].join("\n")}\n`,
  };
};
