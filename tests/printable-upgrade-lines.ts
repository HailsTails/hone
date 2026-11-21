import type { LoadFailure } from "../src/infrastructure/command-line/load-failure.ts";
import { loadFailureDetail } from "../src/infrastructure/printed-report/load-failures/load-failure-text.ts";
import { createPathPort } from "../src/infrastructure/node/path-port.ts";
import { ALREADY_ON_VERSION_TWO, upgradeSuccessOutcomeOf } from "../src/infrastructure/printed-report/upgrade/upgrade-success-text.ts";
import { type UpgradeFailure, UPGRADE_ISSUES_URL, upgradeFailureOutcomeOf } from "../src/infrastructure/printed-report/upgrade/upgrade-refusal-text.ts";
import type { PlanRefusal } from "../src/application/upgrade/proof/upgrade-plan.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema, TOOL_RULE_SET } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../src/infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../src/infrastructure/hone-records-folder/repo-path.ts";
import type { Fills, PrintedLine } from "./output-contract.ts";

const REPO = absolutePathSchema.parse("/repo");

const SETTINGS = absolutePathSchema.parse("/repo/hone.config.json");

const OLD_FILE = absolutePathSchema.parse("/repo/disciplines.eslint.mjs");

const CLAUSE = "CD-15#loops";

const MARKED_CHECK = "claimed-type#claimed-type";

const FILE = repoPathSchema.parse("src/a.ts");

const MECHANISM = mechanismIdSchema.parse("eslint");

const CONFIG = repoPathSchema.parse("eslint.config.mjs");

const PROJECTION = repoPathSchema.parse("disciplines.eslint.mjs");

const SLICE = repoPathSchema.parse("packages/a/disciplines.eslint.mjs");

const SLICE_CONFIG = repoPathSchema.parse("packages/a/eslint.config.mjs");

const UNREADABLE: LoadFailure = { kind: "git-failed", detail: "git ls-files: not a git repository" };

type Sample = { readonly failure: UpgradeFailure; readonly fills: Fills };

const BASE_FILLS: Fills = {
  "issues page": UPGRADE_ISSUES_URL,
  clause: CLAUSE,
  file: FILE,
  "config file": CONFIG,
  projection: PROJECTION,
  detail: "the detail",
  path: SETTINGS,
  specifier: "./disciplines.eslint.mjs",
};

const planRefused = (request: { readonly refusal: PlanRefusal }): UpgradeFailure => ({ kind: "plan-refused", refusal: request.refusal, removedByVersionOne: [] });

const SAMPLES: readonly Sample[] = [
  { failure: { kind: "oracle-failed", failure: { kind: "version-one-run-failed", detail: "the detail" } }, fills: {} },
  { failure: { kind: "oracle-failed", failure: { kind: "finding-not-attributable", clause: CLAUSE, file: FILE, check: undefined } }, fills: {} },
  { failure: { kind: "oracle-failed", failure: { kind: "record-doubly-held", clause: CLAUSE, file: FILE } }, fills: {} },
  { failure: { kind: "oracle-failed", failure: { kind: "projection-not-current", file: SLICE, state: "out-of-date" } }, fills: { projection: SLICE, state: "out-of-date" } },
  { failure: { kind: "oracle-failed", failure: { kind: "projection-not-current", file: SLICE, state: "missing" } }, fills: { projection: SLICE, state: "missing" } },
  { failure: { kind: "oracle-failed", failure: { kind: "projection-not-current", file: SLICE, state: "not-applied" } }, fills: { projection: SLICE, state: "not-applied" } },
  { failure: planRefused({ refusal: { kind: "carve-out-unanswered", clause: CLAUSE, file: FILE } }), fills: {} },
  { failure: planRefused({ refusal: { kind: "location-unanswered", clause: CLAUSE, file: FILE } }), fills: {} },
  {
    failure: planRefused({
      refusal: {
        kind: "mapping-refused",
        refusals: [
          { kind: "clause-without-check", clause: CLAUSE },
          { kind: "no-engine-on-mechanism", check: "loop-keyword#loops", mechanism: MECHANISM },
          { kind: "two-engines-on-mechanism", check: "loop-keyword#loops", mechanism: MECHANISM, engines: ["eslint", "oxlint"] },
          { kind: "record-answers-nothing", clause: CLAUSE, file: FILE, credited: "nothing" },
          { kind: "record-answers-nothing", clause: CLAUSE, file: FILE, credited: "suppression-only" },
          { kind: "clause-wide-carve-out", clause: CLAUSE },
          { kind: "records-name-refused", name: "Not A Name" },
        ],
      },
    }),
    fills: { check: "loop-keyword#loops", mechanism: "eslint", engines: "eslint or oxlint", name: "Not A Name" },
  },
  { failure: planRefused({ refusal: { kind: "projection-failed", failure: { kind: "unknown-check", check: "names#names" } } }), fills: { detail: "load failure: unknown-check names#names" } },
  {
    failure: planRefused({ refusal: { kind: "projection-failed", failure: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["vendor/lib"] } } } }),
    fills: {
      detail:
        "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: vendor/lib; move them out of this repository, and run each on its own with --repo",
    },
  },
  {
    failure: planRefused({
      refusal: { kind: "projections-unpaired", refusal: { kind: "version-one-projection-unpaired", projection: SLICE, config: SLICE_CONFIG, folder: "packages/a" } },
    }),
    fills: { projection: SLICE, folder: "packages/a", "config file": SLICE_CONFIG },
  },
  {
    failure: planRefused({ refusal: { kind: "projections-unpaired", refusal: { kind: "version-two-projection-unpaired", file: repoPathSchema.parse("packages/a/hone.eslint.mjs"), folder: "packages/a" } } }),
    fills: { file: "packages/a/hone.eslint.mjs", folder: "packages/a" },
  },
  { failure: planRefused({ refusal: { kind: "slice-left-in-place", files: [SLICE] } }), fills: { projection: SLICE } },
  { failure: planRefused({ refusal: { kind: "reach-beyond-entries", records: [{ symptom: "loop-keyword#loops", file: "src/b.ts" }] } }), fills: { records: "loop-keyword#loops in src/b.ts" } },
  { failure: planRefused({ refusal: { kind: "config-import-refused", refusal: { kind: "no-projection-import", file: SLICE_CONFIG, projection: SLICE } } }), fills: { "config file": SLICE_CONFIG, projection: SLICE } },
  { failure: planRefused({ refusal: { kind: "config-import-refused", refusal: { kind: "several-projection-imports", file: CONFIG, count: 2 } } }), fills: { count: "2" } },
  { failure: planRefused({ refusal: { kind: "config-import-refused", refusal: { kind: "projection-named-elsewhere", file: CONFIG } } }), fills: {} },
  { failure: planRefused({ refusal: { kind: "team-config-refused", refusal: { kind: "no-file-imports-projection", projection: PROJECTION } } }), fills: {} },
  { failure: planRefused({ refusal: { kind: "team-config-refused", refusal: { kind: "config-candidate-unreadable", file: CONFIG, detail: "the detail" } } }), fills: {} },
  {
    failure: {
      kind: "plan-refused",
      refusal: { kind: "slice-left-in-place", files: [SLICE] },
      removedByVersionOne: [repoPathSchema.parse("old/disciplines.eslint.mjs")],
    },
    fills: { projection: SLICE, "removed path": "/repo/old/disciplines.eslint.mjs" },
  },
  { failure: { kind: "version-one-run-failed", failure: { kind: "run-failed", detail: "the detail" }, removedByVersionOne: [] }, fills: {} },
  {
    failure: { kind: "version-one-uncovered", clauses: [clauseAddressSchema.parse(CLAUSE), clauseAddressSchema.parse("CD-2#claimed-type")], removedByVersionOne: [] },
    fills: { clauses: "CD-15#loops, CD-2#claimed-type" },
  },
  { failure: { kind: "version-one-project-failed", detail: "the detail", removedByVersionOne: [] }, fills: {} },
  { failure: { kind: "version-one-project-rewrote", files: [PROJECTION, SLICE], removedByVersionOne: [] }, fills: { files: "disciplines.eslint.mjs, packages/a/disciplines.eslint.mjs" } },
  {
    failure: { kind: "version-one-project-rewrote", files: [PROJECTION], removedByVersionOne: [repoPathSchema.parse("old/disciplines.eslint.mjs")] },
    fills: { files: "disciplines.eslint.mjs", "removed path": "/repo/old/disciplines.eslint.mjs" },
  },
  { failure: { kind: "unplaceable-path", file: FILE, removedByVersionOne: [] }, fills: {} },
  { failure: { kind: "unplaceable-path", file: FILE, removedByVersionOne: [repoPathSchema.parse("old/disciplines.eslint.mjs")] }, fills: { "removed path": "/repo/old/disciplines.eslint.mjs" } },
  { failure: { kind: "removal-refused", failure: { kind: "records-file-outside-root", path: OLD_FILE, root: REPO }, removedByVersionOne: [] }, fills: { root: REPO, path: OLD_FILE } },
  { failure: { kind: "write-refused", refusal: { failure: { kind: "path-already-exists", path: SETTINGS }, unrestored: [] }, removedByVersionOne: [] }, fills: {} },
  { failure: { kind: "write-refused", refusal: { failure: { kind: "replaced-file-unreadable", path: SETTINGS, detail: "the detail" }, unrestored: [] }, removedByVersionOne: [] }, fills: {} },
  { failure: { kind: "write-refused", refusal: { failure: { kind: "directory-uncreatable", path: SETTINGS, detail: "the detail" }, unrestored: [] }, removedByVersionOne: [] }, fills: {} },
  {
    failure: { kind: "write-refused", refusal: { failure: { kind: "unwritable", path: SETTINGS, detail: "the detail" }, unrestored: [{ written: "file-created", path: OLD_FILE, detail: "EBUSY" }] }, removedByVersionOne: [] },
    fills: { "unrestored path": OLD_FILE, "unrestored detail": "EBUSY" },
  },
  {
    failure: { kind: "write-refused", refusal: { failure: { kind: "unwritable", path: SETTINGS, detail: "the detail" }, unrestored: [{ written: "directory-created", path: OLD_FILE, detail: "EACCES" }] }, removedByVersionOne: [] },
    fills: { "unrestored path": OLD_FILE, "unrestored detail": "EACCES" },
  },
  {
    failure: { kind: "write-refused", refusal: { failure: { kind: "unwritable", path: SETTINGS, detail: "the detail" }, unrestored: [{ written: "file-replaced", path: OLD_FILE, detail: "EPERM" }] }, removedByVersionOne: [] },
    fills: { "unrestored path": OLD_FILE, "unrestored detail": "EPERM" },
  },
  { failure: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "the detail" }, unrestored: [], removedByVersionOne: [] }, fills: {} },
  {
    failure: {
      kind: "differences",
      differences: [{ section: "findings", onlyBefore: ["CD-15#loops src/a.ts 3:1"], onlyAfter: ["CD-15#loops src/a.ts 4:1"] }],
      unrestored: [],
      removedByVersionOne: [],
    },
    fills: { section: "findings", before: "CD-15#loops src/a.ts 3:1", after: "CD-15#loops src/a.ts 4:1" },
  },
  {
    failure: {
      kind: "directives-name-no-check",
      directives: [{ kind: "names-no-check", ruleId: "hone/no-such-check", file: FILE, line: 3, text: "the text" }],
      unrestored: [],
      removedByVersionOne: [],
    },
    fills: { line: "3", "rule id": "hone/no-such-check" },
  },
  {
    failure: {
      kind: "directives-name-no-check",
      directives: [
        { kind: "version-1-id", ruleId: "hone/no-class-authoring", file: FILE, line: 3, text: "the text", replacedBy: ["hone/authored-class-or-this#class-keyword"] },
      ],
      unrestored: [],
      removedByVersionOne: [],
    },
    fills: { line: "3", "rule id": "hone/no-class-authoring", "version 2 rule id": "hone/authored-class-or-this#class-keyword" },
  },
  {
    failure: {
      kind: "directives-name-no-check",
      directives: [{ kind: "version-1-id", ruleId: "hone/no-class-authoring", file: FILE, line: 3, text: "the text", replacedBy: ["hone/a#first", "hone/a#second"] }],
      unrestored: [],
      removedByVersionOne: [],
    },
    fills: { line: "3", "rule id": "hone/no-class-authoring", "version 2 rule ids": "hone/a#first, hone/a#second" },
  },
  {
    failure: {
      kind: "records-refused",
      refusal: { kind: "invalid-records", invalid: [{ place: { layout: "split", file: repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-15.json"), index: 1 }, problem: { kind: "clause-unparseable", detail: "the detail" } }] },
    },
    fills: { "records file": "discipline-exceptions/file-carve-outs/cd-15.json", index: "1", problem: "clause-unparseable" },
  },
  {
    failure: { kind: "records-refused", refusal: { kind: "entry-not-json", place: { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 0 } } },
    fills: { "records file": "discipline-exceptions.json" },
  },
  { failure: { kind: "version-one-unreadable", failure: UNREADABLE }, fills: { detail: loadFailureDetail({ failure: UNREADABLE }) } },
  {
    failure: {
      kind: "removal-failed",
      failure: { kind: "unremovable", path: OLD_FILE, detail: "the detail", removed: { files: [], folders: [] } },
      written: [repoPathSchema.parse("hone.config.json"), repoPathSchema.parse("hone.eslint.mjs")],
      replaced: [CONFIG, SLICE_CONFIG],
      remaining: [OLD_FILE],
    },
    fills: { written: "hone.config.json, hone.eslint.mjs", replaced: "eslint.config.mjs, packages/a/eslint.config.mjs", "removal path": OLD_FILE, "remaining path": OLD_FILE },
  },
  {
    failure: {
      kind: "removal-failed",
      failure: { kind: "records-file-outside-root", path: OLD_FILE, root: REPO },
      written: [repoPathSchema.parse("hone.config.json")],
      replaced: [],
      remaining: [OLD_FILE],
    },
    fills: { written: "hone.config.json", "removal path": OLD_FILE, root: REPO, "remaining path": OLD_FILE },
  },
];

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const linesOf = (request: { readonly text: string; readonly fills: Fills }): readonly PrintedLine[] =>
  request.text
    .trimEnd()
    .split("\n")
    .map((text) => ({ label: "upgrade", text, fills: request.fills }));

const SUCCESS_TEXT = upgradeSuccessOutcomeOf({
  repoRoot: REPO,
  path: PATH,
  carried: {
    markedNotAdopted: [{ check: { ruleSet: TOOL_RULE_SET, check: MARKED_CHECK }, clause: clauseAddressSchema.parse("CD-2#cast-expressions"), reason: "discipline-not-selected" }],
    written: [repoPathSchema.parse("hone.config.json")],
    replaced: [CONFIG],
    removed: { files: [absolutePathSchema.parse("/repo/disciplines.json")], folders: [absolutePathSchema.parse("/repo/discipline-exceptions")] },
  },
}).text;

export const UPGRADE_LINES: readonly PrintedLine[] = [
  ...SAMPLES.flatMap(({ failure, fills }) => linesOf({ text: upgradeFailureOutcomeOf({ failure, placement: { repoRoot: REPO, path: PATH } }).text, fills: { ...BASE_FILLS, ...fills } })),
  ...SUCCESS_TEXT.trimEnd()
    .split("\n")
    .map((text): PrintedLine => ({ label: "upgrade", text, fills: { path: text.slice(text.indexOf(" ") + 1), check: MARKED_CHECK } })),
  ...linesOf({ text: ALREADY_ON_VERSION_TWO.text, fills: {} }),
];
