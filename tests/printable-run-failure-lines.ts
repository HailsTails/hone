import type { RecordsDocumentRefusal } from "../src/infrastructure/hone-records-folder/hone-record.ts";
import { runLoadFailureLine } from "../src/infrastructure/printed-report/load-failures/load-failure-lines.ts";
import { RUN_SUBCOMMANDS, RUN_SYNOPSIS, type RunHelpTopic, runHelpText } from "../src/operations/help/run-help.ts";
import type { RunLoadFailure } from "../src/domain/report/run-load-failure.ts";
import { mechanismIdSchema } from "../src/infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../src/infrastructure/hone-records-folder/repo-path.ts";
import type { Fills, PrintedLine } from "./output-contract.ts";
import { RUNNER_FAILURE_SAMPLES } from "./printable-lines.ts";
import { ESLINT_ENGINE, WALKER } from "./report-catalogue.ts";

type Filled<Entry> = { readonly entry: Entry; readonly fills: Fills };

type FailureSamples = { readonly [Kind in RunLoadFailure["kind"]]: readonly Filled<Extract<RunLoadFailure, { readonly kind: Kind }>>[] };

const UPGRADE_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js upgrade --repo /work/shop";

const CATALOGUE_PATH = "node_modules/@hailstails/hone/rules/typescript/symptoms.json";

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const DEBT_FOLDER = repoPathSchema.parse("hone-records/debt");

const STRAY_FILE = repoPathSchema.parse("hone-records/notes.md");

const CAST_CHECK = "claimed-type#cast-expressions";

const ENGINE_FILLS: Fills = { engine: "eslint" };

const DOCUMENT_REFUSED: RecordsDocumentRefusal = {
  kind: "document-refused",
  file: DEBT_FILE,
  issues: [{ code: "custom", path: ["records", 0, "file"], message: "expected a repository path", input: 1 }],
};

const STRAY_REFUSED: RecordsDocumentRefusal = { kind: "not-a-records-file", file: STRAY_FILE };

const ISSUES = "records.0.file: expected a repository path";

const FAILURE_SAMPLES: FailureSamples = {
  "arguments-invalid": [{ entry: { kind: "arguments-invalid", detail: "--repo needs a value" }, fills: { detail: "--repo needs a value" } }],
  "install-root-unresolvable": [
    { entry: { kind: "install-root-unresolvable", url: "https://example.invalid/tool.js", detail: "not a file URL" }, fills: { url: "https://example.invalid/tool.js", detail: "not a file URL" } },
  ],
  "file-unreadable": [{ entry: { kind: "file-unreadable", path: "hone.config.json", detail: "EACCES" }, fills: { path: "hone.config.json", detail: "EACCES" } }],
  "file-malformed": [{ entry: { kind: "file-malformed", path: "hone.config.json", detail: "checks: expected an array" }, fills: { path: "hone.config.json", detail: "checks: expected an array" } }],
  "file-unwritable": [{ entry: { kind: "file-unwritable", path: "hone.eslint.mjs", detail: "EACCES" }, fills: { path: "hone.eslint.mjs", detail: "EACCES" } }],
  "unsupported-version": [{ entry: { kind: "unsupported-version", path: "rules/CD-1/discipline.json", found: 3 }, fills: { path: "rules/CD-1/discipline.json", "version found": "3" } }],
  "reserved-rule-set-name": [{ entry: { kind: "reserved-rule-set-name", name: "hone" }, fills: { "rule set": "hone" } }],
  "rule-set-name-collision": [{ entry: { kind: "rule-set-name-collision", name: "team", other: "Team" }, fills: { "rule set": "team", "other rule set": "Team" } }],
  "unknown-rule-set": [{ entry: { kind: "unknown-rule-set", name: "team" }, fills: { "rule set": "team" } }],
  "rule-set-invalid": [{ entry: { kind: "rule-set-invalid", path: "team/rules", detail: "no clauses" }, fills: { path: "team/rules", detail: "no clauses" } }],
  "git-failed": [{ entry: { kind: "git-failed", detail: "not a git repository" }, fills: { detail: "not a git repository" } }],
  "config-root-untracked": [{ entry: { kind: "config-root-untracked", root: repoPathSchema.parse("packages/gone") }, fills: { "config root": "packages/gone" } }],
  "unexpected-error": [{ entry: { kind: "unexpected-error", detail: "boom" }, fills: { detail: "boom" } }],
  "config-absent": [{ entry: { kind: "config-absent", repo: "/work/shop" }, fills: { dir: "/work/shop" } }],
  "settings-in-both-versions": [{ entry: { kind: "settings-in-both-versions", repo: "/work/shop" }, fills: { dir: "/work/shop" } }],
  "not-ready-yet": [
    { entry: { kind: "not-ready-yet", what: { thing: "command", command: "record-debt" } }, fills: { command: "record-debt" } },
    { entry: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["vendor/lib", "vendor/tool"] } }, fills: { folders: "vendor/lib, vendor/tool" } },
  ],
  "unknown-check": [{ entry: { kind: "unknown-check", check: "claimed-type#casts" }, fills: { check: "claimed-type#casts" } }, { entry: { kind: "unknown-check", check: "my check#x y" }, fills: { check: "my check#x y" } }],
  "review-only-listed": [{ entry: { kind: "review-only-listed", check: "names#names" }, fills: { check: "names#names" } }],
  "duplicate-check": [
    {
      entry: { kind: "duplicate-check", key: "checkSettings", check: CAST_CHECK, prefixedCheck: "hone/claimed-type#cast-expressions" },
      fills: { "settings key": "checkSettings", check: CAST_CHECK, "check with its rule set": "hone/claimed-type#cast-expressions" },
    },
  ],
  "engine-not-allowed": [
    {
      entry: { kind: "engine-not-allowed", check: CAST_CHECK, engine: "walker", allowed: { stated: "by-catalogue", engines: ["eslint"] } },
      fills: { check: CAST_CHECK, engine: "walker", engines: "eslint" },
    },
    {
      entry: { kind: "engine-not-allowed", check: CAST_CHECK, engine: "walker", allowed: { stated: "by-catalogue", engines: ["eslint", "oxlint"] } },
      fills: { check: CAST_CHECK, engine: "walker", engines: "eslint or oxlint" },
    },
    { entry: { kind: "engine-not-allowed", check: CAST_CHECK, engine: "walker", allowed: { stated: "by-rule-set" } }, fills: { check: CAST_CHECK, engine: "walker" } },
  ],
  "engine-missing": [
    { entry: { kind: "engine-missing", engine: { named: "engine", engine: ESLINT_ENGINE } }, fills: ENGINE_FILLS },
    { entry: { kind: "engine-missing", engine: { named: "mechanism", mechanism: mechanismIdSchema.parse("stylelint") } }, fills: { engine: "stylelint" } },
  ],
  "engine-invalid": [{ entry: { kind: "engine-invalid", engine: { named: "engine", engine: WALKER }, detail: "no runner export" }, fills: { engine: "walker", detail: "no runner export" } }],
  "engine-failed": RUNNER_FAILURE_SAMPLES.map((sample) => ({
    entry: { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: sample.entry },
    fills: { file: "src/basket.ts", ...sample.fills, ...ENGINE_FILLS },
  })),
  "check-missing": [{ entry: { kind: "check-missing", check: CAST_CHECK, engine: { named: "engine", engine: ESLINT_ENGINE } }, fills: { check: CAST_CHECK, ...ENGINE_FILLS } }],
  "checks-run-together": [
    {
      entry: { kind: "checks-run-together", check: "branch-in-a-test#conditionals", others: ["branch-in-a-test#loops", "branch-in-a-test#ternaries"] },
      fills: { check: "branch-in-a-test#conditionals", "other checks": "branch-in-a-test#loops branch-in-a-test#ternaries" },
    },
  ],
  "check-settings-refused": [
    { entry: { kind: "check-settings-refused", check: CAST_CHECK, listing: "unlisted" }, fills: { check: CAST_CHECK } },
    { entry: { kind: "check-settings-refused", check: CAST_CHECK, listing: "not-run" }, fills: { check: CAST_CHECK, state: "not-run" } },
    { entry: { kind: "check-settings-refused", check: CAST_CHECK, listing: "not-adopted" }, fills: { check: CAST_CHECK, state: "not-adopted" } },
  ],
  "check-settings-differ": [
    {
      entry: { kind: "check-settings-differ", check: "branch-in-a-test#loops", other: "branch-in-a-test#conditionals" },
      fills: { check: "branch-in-a-test#loops", "other check": "branch-in-a-test#conditionals" },
    },
  ],
  "records-folder-unreadable": [{ entry: { kind: "records-folder-unreadable", folder: DEBT_FOLDER, detail: "EACCES" }, fills: { "records folder": "hone-records/debt", detail: "EACCES" } }],
  "records-file-unreadable": [{ entry: { kind: "records-file-unreadable", file: DEBT_FILE, detail: "EACCES" }, fills: { "records file": "hone-records/debt/claimed-type.json", detail: "EACCES" } }],
  "records-file-not-json": [
    {
      entry: { kind: "records-file-not-json", file: repoPathSchema.parse("hone-records/debt/claimed type.json"), detail: "Unexpected token" },
      fills: { "records file": '"hone-records/debt/claimed type.json"', detail: "Unexpected token" },
    },
  ],
  "not-a-records-file": [{ entry: { kind: "not-a-records-file", file: STRAY_FILE }, fills: { "records file": "hone-records/notes.md" } }],
  "not-a-records-name": [
    { entry: { kind: "not-a-records-name", folder: DEBT_FOLDER, name: "a\\b.json" }, fills: { "records folder": "hone-records/debt", name: '"a\\\\b.json"' } },
  ],
  "records-refused": [
    { entry: { kind: "records-refused", refusals: [DOCUMENT_REFUSED] }, fills: { "records file": "hone-records/debt/claimed-type.json", "document issues": ISSUES } },
    { entry: { kind: "records-refused", refusals: [STRAY_REFUSED] }, fills: { "records file": "hone-records/notes.md" } },
    {
      entry: { kind: "records-refused", refusals: [DOCUMENT_REFUSED, STRAY_REFUSED] },
      fills: { "records file": "hone-records/debt/claimed-type.json", "document issues": ISSUES, "other records file": "hone-records/notes.md" },
    },
  ],
  "catalogue-not-read": [
    { entry: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "absent" } }, fills: { path: CATALOGUE_PATH } },
    { entry: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "unreadable", detail: "symptoms: expected an array" } }, fills: { path: CATALOGUE_PATH, detail: "symptoms: expected an array" } },
  ],
  "upgrade-needed": [
    { entry: { kind: "upgrade-needed", path: "disciplines.json" }, fills: { path: "disciplines.json", "upgrade command": UPGRADE_COMMAND } },
    { entry: { kind: "upgrade-needed", path: "disciplines.json" }, fills: { path: "disciplines.json" } },
  ],
};

const failureLineOf = (request: { readonly sample: Filled<RunLoadFailure> }): PrintedLine => ({
  label: request.sample.entry.kind,
  text: runLoadFailureLine({ failure: request.sample.entry, upgradeCommand: request.sample.fills["upgrade command"] }),
  fills: request.sample.fills,
});

export const RUN_FAILURE_LINES: readonly PrintedLine[] = Object.values(FAILURE_SAMPLES)
  .flat()
  .map((sample) => failureLineOf({ sample }));

const HELP_TOPICS: readonly RunHelpTopic[] = ["tool", ...RUN_SUBCOMMANDS];

const FENCE = "```";

export const RUN_PRINTED_BLOCKS: readonly string[] = [RUN_SYNOPSIS, ...HELP_TOPICS.map((topic) => runHelpText({ topic }))].map((text) => `${FENCE}text\n${text}${FENCE}`);
