import { describe, expect, it } from "vitest";
import { AUDIT, ESLINT, ESLINT_ENGINE, WALKER } from "../../../tests/report-catalogue.ts";
import type { RecordsDocumentRefusal } from "../../infrastructure/hone-records-folder/hone-record.ts";
import type { Engine } from "../language-layer/symptom-catalogue.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { type RunLoadFailure, type RunLoadFailureSource, runLoadFailureOf } from "./run-load-failure.ts";

type MappedRow = { readonly name: string; readonly source: RunLoadFailureSource; readonly failure: RunLoadFailure };

const ENGINES: readonly Engine[] = [WALKER, ESLINT_ENGINE];

const UNCATALOGUED = mechanismIdSchema.parse("stylelint");

const RECORDS_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const DOCUMENT_REFUSED: RecordsDocumentRefusal = { kind: "document-refused", file: RECORDS_FILE, issues: [{ code: "custom", path: ["records"], message: "expected an array", input: 1 }] };

describe("runLoadFailureOf, a failure the version 1 settings path names in version 2's words", () => {
  it.each<MappedRow>([
    { name: "the absent settings file", source: { kind: "selection-absent", repo: "/work/shop" }, failure: { kind: "config-absent", repo: "/work/shop" } },
    { name: "an unknown discipline", source: { kind: "unknown-discipline", address: "CD-99#loops" }, failure: { kind: "unknown-check", check: "CD-99#loops" } },
    { name: "an unknown clause", source: { kind: "unknown-clause", address: "CD-15#whiles" }, failure: { kind: "unknown-check", check: "CD-15#whiles" } },
    { name: "a judgement clause selected", source: { kind: "judgement-clause-selected", address: "CD-3#names" }, failure: { kind: "review-only-listed", check: "CD-3#names" } },
    { name: "a judgement clause listed", source: { kind: "judgement-clause-listed", address: "CD-3#names" }, failure: { kind: "review-only-listed", check: "CD-3#names" } },
    {
      name: "a duplicate clause",
      source: { kind: "duplicate-clause", address: "CD-15#loops", prefixedAddress: "hone/CD-15#loops" },
      failure: { kind: "duplicate-check", key: "checks", check: "CD-15#loops", prefixedCheck: "hone/CD-15#loops" },
    },
    {
      name: "a mechanism the rule set does not allow",
      source: { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: AUDIT },
      failure: { kind: "engine-not-allowed", check: "CD-15#loops", engine: "walker", allowed: { stated: "by-rule-set" } },
    },
    { name: "a missing runner", source: { kind: "runner-missing", mechanism: ESLINT }, failure: { kind: "engine-missing", engine: { named: "engine", engine: ESLINT_ENGINE } } },
    {
      name: "a missing runner the catalogue names no engine for",
      source: { kind: "runner-missing", mechanism: UNCATALOGUED },
      failure: { kind: "engine-missing", engine: { named: "mechanism", mechanism: UNCATALOGUED } },
    },
    {
      name: "an invalid runner",
      source: { kind: "runner-invalid", mechanism: AUDIT, detail: "no runner export" },
      failure: { kind: "engine-invalid", engine: { named: "engine", engine: WALKER }, detail: "no runner export" },
    },
    {
      name: "a failed runner",
      source: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "tool-failed", detail: "ESLint exited 2" } },
      failure: { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "ESLint exited 2" } },
    },
    {
      name: "a missing piece",
      source: { kind: "piece-missing", address: "CD-15#loops", mechanism: AUDIT },
      failure: { kind: "check-missing", check: "CD-15#loops", engine: { named: "engine", engine: WALKER } },
    },
  ])("names $name", ({ source, failure }) => {
    expect(runLoadFailureOf({ source, engines: ENGINES })).toEqual(failure);
  });

  it.each<MappedRow>([
    { name: "arguments-invalid", source: { kind: "arguments-invalid", detail: "--repo needs a value" }, failure: { kind: "arguments-invalid", detail: "--repo needs a value" } },
    {
      name: "install-root-unresolvable",
      source: { kind: "install-root-unresolvable", url: "https://example.invalid/tool.js", detail: "not a file URL" },
      failure: { kind: "install-root-unresolvable", url: "https://example.invalid/tool.js", detail: "not a file URL" },
    },
    { name: "file-unreadable", source: { kind: "file-unreadable", path: "hone.config.json", detail: "EACCES" }, failure: { kind: "file-unreadable", path: "hone.config.json", detail: "EACCES" } },
    { name: "file-malformed", source: { kind: "file-malformed", path: "hone.config.json", detail: "checks is not an array" }, failure: { kind: "file-malformed", path: "hone.config.json", detail: "checks is not an array" } },
    { name: "file-unwritable", source: { kind: "file-unwritable", path: "hone.eslint.mjs", detail: "EACCES" }, failure: { kind: "file-unwritable", path: "hone.eslint.mjs", detail: "EACCES" } },
    { name: "unsupported-version", source: { kind: "unsupported-version", path: "rules/CD-1/discipline.json", found: 3 }, failure: { kind: "unsupported-version", path: "rules/CD-1/discipline.json", found: 3 } },
    { name: "reserved-rule-set-name", source: { kind: "reserved-rule-set-name", name: "hone" }, failure: { kind: "reserved-rule-set-name", name: "hone" } },
    { name: "rule-set-name-collision", source: { kind: "rule-set-name-collision", name: "team", other: "Team" }, failure: { kind: "rule-set-name-collision", name: "team", other: "Team" } },
    { name: "unknown-rule-set", source: { kind: "unknown-rule-set", name: "team" }, failure: { kind: "unknown-rule-set", name: "team" } },
    { name: "rule-set-invalid", source: { kind: "rule-set-invalid", path: "team/rules", detail: "no clauses" }, failure: { kind: "rule-set-invalid", path: "team/rules", detail: "no clauses" } },
    { name: "git-failed", source: { kind: "git-failed", detail: "not a git repository" }, failure: { kind: "git-failed", detail: "not a git repository" } },
    {
      name: "config-root-untracked",
      source: { kind: "config-root-untracked", root: repoPathSchema.parse("packages/gone") },
      failure: { kind: "config-root-untracked", root: repoPathSchema.parse("packages/gone") },
    },
    { name: "unexpected-error", source: { kind: "unexpected-error", detail: "boom" }, failure: { kind: "unexpected-error", detail: "boom" } },
  ])("keeps $name as it is", ({ source, failure }) => {
    expect(runLoadFailureOf({ source, engines: ENGINES })).toEqual(failure);
  });
});

describe("runLoadFailureOf, a check choice the settings refuse", () => {
  it.each<MappedRow>([
    { name: "an unknown check", source: { kind: "unknown-check", address: "claimed-type#casts" }, failure: { kind: "unknown-check", check: "claimed-type#casts" } },
    { name: "a review-only check listed", source: { kind: "review-only-listed", address: "names#names" }, failure: { kind: "review-only-listed", check: "names#names" } },
    {
      name: "an engine the check does not run on",
      source: { kind: "engine-not-allowed", address: "date-used-directly#clock-sources", engine: "eslint", engines: ["walker"] },
      failure: { kind: "engine-not-allowed", check: "date-used-directly#clock-sources", engine: "eslint", allowed: { stated: "by-catalogue", engines: ["walker"] } },
    },
    {
      name: "a check listed twice",
      source: { kind: "duplicate-check", key: "checkSettings", address: "claimed-type#cast-expressions", prefixedAddress: "hone/claimed-type#cast-expressions" },
      failure: { kind: "duplicate-check", key: "checkSettings", check: "claimed-type#cast-expressions", prefixedCheck: "hone/claimed-type#cast-expressions" },
    },
    {
      name: "checks that run together listed apart",
      source: { kind: "checks-run-together", address: "branch-in-a-test#conditionals", others: ["branch-in-a-test#loops"] },
      failure: { kind: "checks-run-together", check: "branch-in-a-test#conditionals", others: ["branch-in-a-test#loops"] },
    },
    {
      name: "settings for a check not run",
      source: { kind: "check-settings-refused", address: "claimed-type#cast-expressions", listing: "not-run" },
      failure: { kind: "check-settings-refused", check: "claimed-type#cast-expressions", listing: "not-run" },
    },
    {
      name: "different settings for checks that run together",
      source: { kind: "check-settings-differ", address: "branch-in-a-test#loops", other: "branch-in-a-test#conditionals" },
      failure: { kind: "check-settings-differ", check: "branch-in-a-test#loops", other: "branch-in-a-test#conditionals" },
    },
  ])("names $name", ({ source, failure }) => {
    expect(runLoadFailureOf({ source, engines: ENGINES })).toEqual(failure);
  });
});

describe("runLoadFailureOf, records that could not be read", () => {
  it.each<MappedRow>([
    {
      name: "an unreadable records folder",
      source: { kind: "records-folder", failure: { kind: "records-folder-unreadable", folder: repoPathSchema.parse("hone-records/debt"), detail: "EACCES" } },
      failure: { kind: "records-folder-unreadable", folder: repoPathSchema.parse("hone-records/debt"), detail: "EACCES" },
    },
    {
      name: "an unreadable records file",
      source: { kind: "records-folder", failure: { kind: "records-file-unreadable", file: RECORDS_FILE, detail: "EACCES" } },
      failure: { kind: "records-file-unreadable", file: RECORDS_FILE, detail: "EACCES" },
    },
    {
      name: "a records file that is not JSON",
      source: { kind: "records-folder", failure: { kind: "records-file-not-json", file: RECORDS_FILE, detail: "Unexpected token" } },
      failure: { kind: "records-file-not-json", file: RECORDS_FILE, detail: "Unexpected token" },
    },
    {
      name: "a file where no records file can be",
      source: { kind: "records-folder", failure: { kind: "not-a-records-file", file: repoPathSchema.parse("hone-records/notes.md") } },
      failure: { kind: "not-a-records-file", file: repoPathSchema.parse("hone-records/notes.md") },
    },
    {
      name: "a name no repository path can hold",
      source: { kind: "records-folder", failure: { kind: "not-a-records-name", folder: repoPathSchema.parse("hone-records/debt"), name: "a\\b.json" } },
      failure: { kind: "not-a-records-name", folder: repoPathSchema.parse("hone-records/debt"), name: "a\\b.json" },
    },
    {
      name: "git failing to read the records at the base",
      source: { kind: "records-folder", failure: { kind: "git-failed", command: "git ls-tree", detail: "bad object origin/main" } },
      failure: { kind: "git-failed", detail: "bad object origin/main" },
    },
    { name: "refused records documents", source: { kind: "records-documents", refusals: [DOCUMENT_REFUSED] }, failure: { kind: "records-refused", refusals: [DOCUMENT_REFUSED] } },
  ])("names $name", ({ source, failure }) => {
    expect(runLoadFailureOf({ source, engines: ENGINES })).toEqual(failure);
  });
});

describe("runLoadFailureOf, failures version 2 names first", () => {
  it.each<MappedRow>([
    {
      name: "the catalogue absent",
      source: { kind: "catalogue-not-read", path: "rules/typescript/symptoms.json", reason: { reason: "absent" } },
      failure: { kind: "catalogue-not-read", path: "rules/typescript/symptoms.json", reason: { reason: "absent" } },
    },
    {
      name: "the catalogue unreadable",
      source: { kind: "catalogue-not-read", path: "rules/typescript/symptoms.json", reason: { reason: "unreadable", detail: "symptoms is not an array" } },
      failure: { kind: "catalogue-not-read", path: "rules/typescript/symptoms.json", reason: { reason: "unreadable", detail: "symptoms is not an array" } },
    },
    { name: "version 1 files found", source: { kind: "upgrade-needed", path: "disciplines.json" }, failure: { kind: "upgrade-needed", path: "disciplines.json" } },
  ])("keeps $name", ({ source, failure }) => {
    expect(runLoadFailureOf({ source, engines: ENGINES })).toEqual(failure);
  });
});
