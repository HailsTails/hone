import { describe, expect, it } from "vitest";
import type { Engine } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { RecordsDocumentRefusal } from "../../hone-records-folder/hone-record.ts";
import { mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { runLoadFailureLine } from "./load-failure-lines.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";

const WALKER: Engine = { name: "walker", mechanism: mechanismIdSchema.parse("audit") };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

type LineRow = { readonly failure: RunLoadFailure; readonly line: string };

const UPGRADE_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js upgrade --repo /work/shop";

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const SPACED_FILE = repoPathSchema.parse("hone-records/debt/claimed type.json");

const DOCUMENT_REFUSED: RecordsDocumentRefusal = {
  kind: "document-refused",
  file: DEBT_FILE,
  issues: [
    { code: "custom", path: ["records", 0, "file"], message: "expected a repository path", input: 1 },
    { code: "custom", path: [], message: "expected version 2", input: 1 },
  ],
};

const MISPLACED_FILE: RecordsDocumentRefusal = { kind: "not-a-records-file", file: SPACED_FILE };

describe("runLoadFailureLine, a failure version 2 renames", () => {
  it.each<LineRow>([
    {
      failure: { kind: "config-absent", repo: "/work/shop" },
      line: "load failure: config-absent /work/shop holds no hone.config.json; give the folder that holds it, usually the repository root",
    },
    { failure: { kind: "unknown-check", check: "claimed-type#casts" }, line: "load failure: unknown-check claimed-type#casts" },
    { failure: { kind: "unknown-check", check: "my check#x y" }, line: "load failure: unknown-check my check#x y" },
    {
      failure: { kind: "review-only-listed", check: "names#names" },
      line: "load failure: review-only-listed names#names: a check enforced by review has no engine and is left out of checks; remove it",
    },
    {
      failure: { kind: "duplicate-check", key: "checks", check: "claimed-type#cast-expressions", prefixedCheck: "hone/claimed-type#cast-expressions" },
      line: "load failure: duplicate-check checks claimed-type#cast-expressions hone/claimed-type#cast-expressions",
    },
    {
      failure: { kind: "engine-not-allowed", check: "date-used-directly#clock-sources", engine: "eslint", allowed: { stated: "by-catalogue", engines: ["walker"] } },
      line: "load failure: engine-not-allowed date-used-directly#clock-sources eslint: it runs on walker; list it with one of those",
    },
    {
      failure: { kind: "engine-not-allowed", check: "claimed-type#cast-expressions", engine: "eslint", allowed: { stated: "by-catalogue", engines: ["eslint", "walker"] } },
      line: "load failure: engine-not-allowed claimed-type#cast-expressions eslint: it runs on eslint or walker; list it with one of those",
    },
    {
      failure: { kind: "engine-not-allowed", check: "CD-15#loops", engine: "walker", allowed: { stated: "by-rule-set" } },
      line: "load failure: engine-not-allowed CD-15#loops walker: the rule set does not run that check on that engine, though its catalogue says it does; list the check with an engine its rule set runs it on, or correct the rule set",
    },
    { failure: { kind: "engine-missing", engine: { named: "engine", engine: ESLINT_ENGINE } }, line: "load failure: engine-missing eslint" },
    {
      failure: { kind: "engine-missing", engine: { named: "mechanism", mechanism: mechanismIdSchema.parse("stylelint") } },
      line: "load failure: engine-missing stylelint",
    },
    {
      failure: { kind: "engine-invalid", engine: { named: "engine", engine: WALKER }, detail: "no runner export" },
      line: "load failure: engine-invalid walker no runner export",
    },
    {
      failure: { kind: "check-missing", check: "CD-15#loops", engine: { named: "engine", engine: WALKER } },
      line: "load failure: check-missing CD-15#loops walker",
    },
  ])("prints $failure.kind", ({ failure, line }) => {
    expect(runLoadFailureLine({ failure, upgradeCommand: UPGRADE_COMMAND })).toBe(line);
  });
});

describe("runLoadFailureLine, an engine that failed", () => {
  it.each<LineRow>([
    {
      failure: { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "ESLint exited 2" } },
      line: "load failure: engine-failed eslint tool-failed ESLint exited 2",
    },
    {
      failure: { kind: "engine-failed", engine: { named: "engine", engine: WALKER }, failure: { kind: "file-unparseable", file: repoPathSchema.parse("src/a.ts"), detail: "line 1\nline 2" } },
      line: "load failure: engine-failed walker file-unparseable src/a.ts line 1\\nline 2",
    },
    {
      failure: {
        kind: "engine-failed",
        engine: { named: "engine", engine: ESLINT_ENGINE },
        failure: { kind: "toolchain-unavailable", peers: [{ packageName: "eslint", peer: "required", found: "8.57.0", supported: "^9.0.0" }] },
      },
      line: "load failure: engine-failed eslint toolchain-unavailable eslint found 8.57.0, supported ^9.0.0: add a supported version to the devDependencies of the repository root",
    },
  ])("prints $failure.failure.kind", ({ failure, line }) => {
    expect(runLoadFailureLine({ failure, upgradeCommand: UPGRADE_COMMAND })).toBe(line);
  });
});

describe("runLoadFailureLine, a check choice the settings refuse", () => {
  it.each<LineRow>([
    {
      failure: { kind: "checks-run-together", check: "branch-in-a-test#conditionals", others: ["branch-in-a-test#loops", "branch-in-a-test#ternaries"] },
      line: "load failure: checks-run-together branch-in-a-test#conditionals branch-in-a-test#loops branch-in-a-test#ternaries: these checks are one rule today, so they run together; list each of them as branch-in-a-test#conditionals is listed",
    },
    {
      failure: { kind: "check-settings-refused", check: "claimed-type#cast-expressions", listing: "unlisted" },
      line: "load failure: check-settings-refused claimed-type#cast-expressions unlisted: checkSettings gives settings only to a check listed to run; list it under checks or remove its settings",
    },
    {
      failure: { kind: "check-settings-refused", check: "claimed-type#cast-expressions", listing: "not-run" },
      line: "load failure: check-settings-refused claimed-type#cast-expressions not-run: checkSettings gives settings only to a check listed to run; run it or remove its settings",
    },
    {
      failure: { kind: "check-settings-differ", check: "branch-in-a-test#loops", other: "branch-in-a-test#conditionals" },
      line: "load failure: check-settings-differ branch-in-a-test#loops branch-in-a-test#conditionals: these checks are one rule today, so they take one set of settings; give them the same settings",
    },
  ])("prints $failure.kind", ({ failure, line }) => {
    expect(runLoadFailureLine({ failure, upgradeCommand: UPGRADE_COMMAND })).toBe(line);
  });
});

describe("runLoadFailureLine, records that could not be read", () => {
  it.each<LineRow>([
    {
      failure: { kind: "records-folder-unreadable", folder: repoPathSchema.parse("hone-records/debt"), detail: "EACCES" },
      line: "load failure: records-folder-unreadable hone-records/debt EACCES",
    },
    { failure: { kind: "records-file-unreadable", file: DEBT_FILE, detail: "EACCES" }, line: "load failure: records-file-unreadable hone-records/debt/claimed-type.json EACCES" },
    {
      failure: { kind: "records-file-not-json", file: SPACED_FILE, detail: "Unexpected token" },
      line: 'load failure: records-file-not-json "hone-records/debt/claimed type.json" Unexpected token',
    },
    {
      failure: { kind: "not-a-records-file", file: repoPathSchema.parse("hone-records/notes.md") },
      line: "load failure: not-a-records-file hone-records/notes.md: a records file is boundary-records.json or dependency-records.json, or a .json file named for its symptom, or for its recipe in deviations, inside the folder authorised-locations, debt or deviations of hone-records; move this file to where its kind belongs, or out of hone-records if it holds no records",
    },
    {
      failure: { kind: "not-a-records-name", folder: repoPathSchema.parse("hone-records/debt"), name: "a\\b.json" },
      line: 'load failure: not-a-records-name hone-records/debt "a\\\\b.json": no repository path can hold that name; rename it',
    },
    {
      failure: { kind: "records-refused", refusals: [DOCUMENT_REFUSED] },
      line: "load failure: records-refused hone-records/debt/claimed-type.json document-refused records.0.file: expected a repository path, document: expected version 2",
    },
    {
      failure: { kind: "records-refused", refusals: [DOCUMENT_REFUSED, MISPLACED_FILE] },
      line: 'load failure: records-refused hone-records/debt/claimed-type.json document-refused records.0.file: expected a repository path, document: expected version 2; "hone-records/debt/claimed type.json" not-a-records-file',
    },
  ])("prints $failure.kind", ({ failure, line }) => {
    expect(runLoadFailureLine({ failure, upgradeCommand: UPGRADE_COMMAND })).toBe(line);
  });
});

describe("runLoadFailureLine, failures version 2 names first", () => {
  it.each<LineRow>([
    {
      failure: { kind: "catalogue-not-read", path: "node_modules/@hailstails/hone/rules/typescript/symptoms.json", reason: { reason: "absent" } },
      line: "load failure: catalogue-not-read node_modules/@hailstails/hone/rules/typescript/symptoms.json: the symptom catalogue is missing from this install; reinstall @hailstails/hone",
    },
    {
      failure: { kind: "catalogue-not-read", path: "node_modules/@hailstails/hone/rules/typescript/symptoms.json", reason: { reason: "unreadable", detail: "symptoms is not an array" } },
      line: "load failure: catalogue-not-read node_modules/@hailstails/hone/rules/typescript/symptoms.json symptoms is not an array",
    },
    {
      failure: { kind: "upgrade-needed", path: "disciplines.json" },
      line: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run node /work/shop/node_modules/@hailstails/hone/src/hone.js upgrade --repo /work/shop, which rewrites every version 1 file as version 2, and commit what it writes",
    },
  ])("prints $failure.kind", ({ failure, line }) => {
    expect(runLoadFailureLine({ failure, upgradeCommand: UPGRADE_COMMAND })).toBe(line);
  });
});

describe("runLoadFailureLine, not-ready-yet eslint-config-roots", () => {
  const lineOf = (what: { readonly paths: readonly string[] }) =>
    runLoadFailureLine({ failure: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", ...what } }, upgradeCommand: undefined });

  it("names the other version 2 repositories inside this one", () => {
    expect(lineOf({ paths: ["vendor/lib", "vendor/tool"] })).toBe(
      "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: vendor/lib, vendor/tool; move them out of this repository, and run each on its own with --repo",
    );
  });

  it("names exactly three folders with no count of the rest", () => {
    expect(lineOf({ paths: ["a", "b", "c"] })).toBe(
      "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: a, b, c; move them out of this repository, and run each on its own with --repo",
    );
  });

  it("counts one more when four folders hold a settings file", () => {
    expect(lineOf({ paths: ["a", "b", "c", "d"] })).toBe(
      "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: a, b, c and 1 more; move them out of this repository, and run each on its own with --repo",
    );
  });

  it("counts the rest when five folders hold a settings file", () => {
    expect(lineOf({ paths: ["a", "b", "c", "d", "e"] })).toBe(
      "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: a, b, c and 2 more; move them out of this repository, and run each on its own with --repo",
    );
  });
});

describe("runLoadFailureLine, a version 1 file found while no command rewrites it", () => {
  it("prints upgrade-needed naming plain hone upgrade when no invocation could be built", () => {
    expect(runLoadFailureLine({ failure: { kind: "upgrade-needed", path: "disciplines.json" }, upgradeCommand: undefined })).toBe(
      "load failure: upgrade-needed disciplines.json: this is a version 1 file; run hone upgrade, which rewrites every version 1 file as version 2, and commit what it writes",
    );
  });
});

describe("runLoadFailureLine, a failure version 2 keeps", () => {
  it.each<LineRow>([
    { failure: { kind: "arguments-invalid", detail: "--repo needs a value" }, line: "load failure: arguments-invalid --repo needs a value" },
    { failure: { kind: "file-malformed", path: "hone.config.json", detail: "checks: expected an array" }, line: "load failure: file-malformed hone.config.json checks: expected an array" },
    { failure: { kind: "unsupported-version", path: "rules/CD-1/discipline.json", found: 3 }, line: "load failure: unsupported-version rules/CD-1/discipline.json 3" },
    {
      failure: { kind: "config-root-untracked", root: repoPathSchema.parse("packages/gone") },
      line: "load failure: config-root-untracked packages/gone: an eslintConfigRoots entry is a folder git tracks files under outside every excluded path, spelled exactly as git spells it; fix or remove it in hone.config.json",
    },
  ])("prints $failure.kind", ({ failure, line }) => {
    expect(runLoadFailureLine({ failure, upgradeCommand: UPGRADE_COMMAND })).toBe(line);
  });
});
