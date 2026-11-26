import { describe, expect, it, vi } from "vitest";

import type { VersionTwoSettingsFile } from "../../application/ports/settings/settings-file-format.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import { DEFAULT_CONVENTIONS } from "../../domain/settings/conventions.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";
import type { SettingsFileFault } from "../../domain/settings/settings-file.ts";
import {
  SETTINGS_FILE_FORMAT,
  settingsFileOf,
  settingsTextOf,
  settingsWireOf,
} from "./settings-file.ts";

const SMALLEST_DOCUMENT = { version: 2, ruleSets: {}, checks: {} };

const SMALLEST_FILE: VersionTwoSettingsFile = {
  exclude: [],
  ruleSets: [],
  checks: [],
  checkSettings: [],
  forfeiture: "this-run",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  eslintProjectionKind: "mjs",
  conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
};

describe("settingsFileOf", () => {
  it("reads the smallest file with every default today's version 1 file gives", () => {
    expect(settingsFileOf({ document: SMALLEST_DOCUMENT })).toEqual({
      outcome: "ok",
      value: SMALLEST_FILE,
    });
  });

  it.each<{
    readonly name: string;
    readonly document: ReadonlyJsonValue;
    readonly file: VersionTwoSettingsFile;
  }>([
    {
      name: "an excluded path",
      document: { version: 2, ruleSets: {}, checks: {}, exclude: ["vendor"] },
      file: {
        exclude: [repoPathOf("vendor")],
        ruleSets: [],
        checks: [],
        checkSettings: [],
        forfeiture: "this-run",
        reportOutput: "full",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [],
        eslintProjectionKind: "mjs",
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    },
    {
      name: "a rule set in a folder and one at the repository root",
      document: { version: 2, ruleSets: { team: "tools/hone-rules", local: "." }, checks: {} },
      file: {
        exclude: [],
        ruleSets: [
          {
            name: ruleSetNameOf("team"),
            location: { location: "folder", path: repoPathOf("tools/hone-rules") },
          },
          { name: ruleSetNameOf("local"), location: { location: "repo-root" } },
        ],
        checks: [],
        checkSettings: [],
        forfeiture: "this-run",
        reportOutput: "full",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [],
        eslintProjectionKind: "mjs",
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    },
    {
      name: "a check run by an engine, one not run and one not adopted",
      document: {
        version: 2,
        ruleSets: { team: "tools/hone-rules" },
        checks: {
          "date-used-directly#clock-sources": "walker",
          "team/no-tmp-file#tmp-paths": "not-run",
          "loop-keyword#loop-statement": "not-adopted",
        },
      },
      file: {
        exclude: [],
        ruleSets: [
          {
            name: ruleSetNameOf("team"),
            location: { location: "folder", path: repoPathOf("tools/hone-rules") },
          },
        ],
        checks: [
          {
            address: { ruleSet: "hone", check: "date-used-directly#clock-sources" },
            state: { state: "run", engine: "walker" },
          },
          {
            address: { ruleSet: { name: ruleSetNameOf("team") }, check: "no-tmp-file#tmp-paths" },
            state: { state: "not-run" },
          },
          {
            address: { ruleSet: "hone", check: "loop-keyword#loop-statement" },
            state: { state: "not-adopted" },
          },
        ],
        checkSettings: [],
        forfeiture: "this-run",
        reportOutput: "full",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [],
        eslintProjectionKind: "mjs",
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    },
    {
      name: "the forfeiture",
      document: { version: 2, ruleSets: {}, checks: {}, forfeiture: "elsewhere" },
      file: {
        exclude: [],
        ruleSets: [],
        checks: [],
        checkSettings: [],
        forfeiture: "elsewhere",
        reportOutput: "full",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [],
        eslintProjectionKind: "mjs",
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    },
    {
      name: "the report output",
      document: { version: 2, ruleSets: {}, checks: {}, reportOutput: "counts" },
      file: {
        exclude: [],
        ruleSets: [],
        checks: [],
        checkSettings: [],
        forfeiture: "this-run",
        reportOutput: "counts",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [],
        eslintProjectionKind: "mjs",
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    },
    {
      name: "the check editions",
      document: { version: 2, ruleSets: {}, checks: {}, checkEditions: "latest" },
      file: {
        exclude: [],
        ruleSets: [],
        checks: [],
        checkSettings: [],
        forfeiture: "this-run",
        reportOutput: "full",
        checkEditions: "latest",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [],
        eslintProjectionKind: "mjs",
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    },
    {
      name: "a declared ESLint config lookup",
      document: { version: 2, ruleSets: {}, checks: {}, eslintConfigLookup: "nearest-to-file" },
      file: {
        exclude: [],
        ruleSets: [],
        checks: [],
        checkSettings: [],
        forfeiture: "this-run",
        reportOutput: "full",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "declared", value: "nearest-to-file" },
        eslintConfigRoots: [],
        eslintProjectionKind: "mjs",
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    },
    {
      name: "the explicit mjs projection kind",
      document: { version: 2, ruleSets: {}, checks: {}, eslintProjectionKind: "mjs" },
      file: SMALLEST_FILE,
    },
    {
      name: "the ts projection kind",
      document: { version: 2, ruleSets: {}, checks: {}, eslintProjectionKind: "ts" },
      file: { ...SMALLEST_FILE, eslintProjectionKind: "ts" },
    },
    {
      name: "an ESLint config root",
      document: { version: 2, ruleSets: {}, checks: {}, eslintConfigRoots: ["web"] },
      file: {
        exclude: [],
        ruleSets: [],
        checks: [],
        checkSettings: [],
        forfeiture: "this-run",
        reportOutput: "full",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [repoPathOf("web")],
        eslintProjectionKind: "mjs",
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    },
  ])("reads $name", ({ document, file }) => {
    const read = settingsFileOf({ document });

    expect(read).toEqual({ outcome: "ok", value: file });
  });

  it("refuses a projection kind it does not know as malformed", () => {
    const document = { version: 2, ruleSets: {}, checks: {}, eslintProjectionKind: "d.mts" };

    const read = settingsFileOf({ document });

    expect(read).toEqual({
      outcome: "failed",
      error: { kind: "malformed", detail: expect.any(String) },
    });
  });

  it("reads a top-level generated key into the conventions it declares", () => {
    expect(
      settingsFileOf({
        document: {
          ...SMALLEST_DOCUMENT,
          generated: [{ files: ["generated/*.ts"], outsideParty: "codegen" }],
        },
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        conventions: {
          conventions: { generated: [{ files: ["generated/*.ts"], outsideParty: "codegen" }] },
          declared: ["generated"],
        },
      },
    });
  });

  it("hands the conventions and layers it declares to their own reading", () => {
    expect(
      settingsFileOf({ document: { ...SMALLEST_DOCUMENT, layers: { domain: ["src/domain"] } } }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        conventions: {
          conventions: { layers: [{ layer: "domain", folders: ["src/domain"] }] },
          declared: ["layers"],
        },
      },
    });
  });

  it("reads a top-level testFiles key into the conventions it declares", () => {
    expect(
      settingsFileOf({
        document: {
          ...SMALLEST_DOCUMENT,
          testFiles: { suffixes: ["spec"], folders: ["__tests__"] },
        },
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        conventions: {
          conventions: { testFiles: { suffixes: ["spec"], folders: ["__tests__"] } },
          declared: ["testFiles"],
        },
      },
    });
  });

  it("keeps tracker patterns on their check, as version 1 does", () => {
    expect(
      settingsFileOf({
        document: {
          ...SMALLEST_DOCUMENT,
          checkSettings: {
            "untracked-escape#directive-pointers": { trackerPatterns: ["^\\(spec-\\d+\\)$"] },
          },
        },
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        checkSettings: [
          {
            address: { ruleSet: "hone", check: "untracked-escape#directive-pointers" },
            values: { trackerPatterns: ["^\\(spec-\\d+\\)$"] },
          },
        ],
      },
    });
  });

  it.each<{
    readonly name: string;
    readonly document: ReadonlyJsonValue;
    readonly fault: SettingsFileFault;
  }>([
    {
      name: "the reason-only option, which version 2 does not have",
      document: { ...SMALLEST_DOCUMENT, fileExceptionWhyChains: "optional" },
      fault: {
        kind: "malformed",
        detail:
          '✖ removed: "fileExceptionWhyChains"; every record shows its why-chain in version 2\n  → at fileExceptionWhyChains',
      },
    },
    {
      name: "version 1's clauses, which version 2 calls checks",
      document: { ...SMALLEST_DOCUMENT, clauses: {} },
      fault: {
        kind: "malformed",
        detail:
          '✖ renamed: "clauses" is "checks" in version 2, addressed <symptom>#<check>\n  → at clauses',
      },
    },
    {
      name: "version 1's clauseSettings, which version 2 calls checkSettings",
      document: { ...SMALLEST_DOCUMENT, clauseSettings: {} },
      fault: {
        kind: "malformed",
        detail:
          '✖ renamed: "clauseSettings" is "checkSettings" in version 2, addressed <symptom>#<check>\n  → at clauseSettings',
      },
    },
    {
      name: "version 1's assessment, whose forfeiture is a top-level key in version 2",
      document: { ...SMALLEST_DOCUMENT, assessment: { forfeiture: "elsewhere" } },
      fault: {
        kind: "malformed",
        detail:
          '✖ renamed: "assessment" is "forfeiture" in version 2, at the top level\n  → at assessment',
      },
    },
    {
      name: "version 1's setting name for confined outside dependencies",
      document: {
        ...SMALLEST_DOCUMENT,
        checkSettings: {
          "outside-import-past-a-boundary#import-or-require": { confinedPackages: ["uuid"] },
        },
      },
      fault: {
        kind: "malformed",
        detail:
          '✖ renamed: "confinedPackages" is "confinedOutsideDependencies" in version 2\n  → at checkSettings["outside-import-past-a-boundary#import-or-require"].confinedPackages',
      },
    },

    {
      name: "a key the file does not define",
      document: { ...SMALLEST_DOCUMENT, numbers: [] },
      fault: { kind: "malformed", detail: '✖ Unrecognized key: "numbers"' },
    },
    {
      name: "a version other than 2",
      document: { ...SMALLEST_DOCUMENT, version: 1 },
      fault: { kind: "malformed", detail: "✖ Invalid input: expected 2\n  → at version" },
    },
    {
      name: "a check address that is not <symptom>#<check>",
      document: { ...SMALLEST_DOCUMENT, checks: { "CD-15": "walker" } },
      fault: {
        kind: "malformed",
        detail:
          "✖ is not a check address of the form [<ruleSet>/]<symptom>#<check>\n  → at checks[0][0]",
      },
    },
    {
      name: "a check state that is no engine's name",
      document: { ...SMALLEST_DOCUMENT, checks: { "loop-keyword#loop-statement": "Walker" } },
      fault: {
        kind: "malformed",
        detail: '✖ a check takes an engine, "not-run" or "not-adopted"\n  → at checks[0][1]',
      },
    },
    {
      name: "an exclude entry that is a glob",
      document: { ...SMALLEST_DOCUMENT, exclude: ["vendor/**"] },
      fault: {
        kind: "malformed",
        detail: "✖ an exclude entry is a repository path, not a glob\n  → at exclude[0]",
      },
    },
    {
      name: "a forfeiture outside its two choices",
      document: { ...SMALLEST_DOCUMENT, forfeiture: "never" },
      fault: {
        kind: "malformed",
        detail: '✖ Invalid option: expected one of "this-run"|"elsewhere"\n  → at forfeiture',
      },
    },
    {
      name: "the version 1 report output failures-only, which version 2 calls actionable",
      document: { ...SMALLEST_DOCUMENT, reportOutput: "failures-only" },
      fault: {
        kind: "malformed",
        detail:
          '✖ Invalid option: expected one of "full"|"actionable"|"counts"|"verdict-only"\n  → at reportOutput',
      },
    },
    {
      name: "a generated entry that names files anywhere, through the conventions reading",
      document: {
        ...SMALLEST_DOCUMENT,
        generated: [{ files: ["**/*.ts"], outsideParty: "@graphql-codegen/cli" }],
      },
      fault: {
        kind: "malformed",
        detail:
          "✖ a generated entry names files under a named folder\n  → at generated[0].files[0]",
      },
    },
    {
      name: "version 1's conventions key, whose generated is a top-level key in version 2",
      document: {
        ...SMALLEST_DOCUMENT,
        conventions: { generated: [{ files: ["generated/*.ts"], outsideParty: "codegen" }] },
      },
      fault: {
        kind: "malformed",
        detail:
          '✖ renamed: "conventions" is gone in version 2; its "generated" is a top-level key\n  → at conventions',
      },
    },
    {
      name: "a rule set named as Hone's own",
      document: { ...SMALLEST_DOCUMENT, ruleSets: { "hone-team": "tools/team" } },
      fault: { kind: "reserved-rule-set-name", name: "hone-team" },
    },
    {
      name: "a rule set named as a records kind folder, which its records folder would sit beside",
      document: { ...SMALLEST_DOCUMENT, ruleSets: { debt: "tools/debt" } },
      fault: { kind: "reserved-rule-set-name", name: "debt" },
    },
    {
      name: "a rule set whose name another extends",
      document: { ...SMALLEST_DOCUMENT, ruleSets: { team: "tools/team", "team-web": "tools/web" } },
      fault: { kind: "rule-set-name-collision", name: "team", other: "team-web" },
    },
  ])("refuses $name", ({ document, fault }) => {
    expect(settingsFileOf({ document })).toEqual({ outcome: "failed", error: fault });
  });
});

const FULL_FILE: VersionTwoSettingsFile = {
  exclude: [repoPathOf("vendor")],
  ruleSets: [
    { name: ruleSetNameOf("local"), location: { location: "repo-root" } },
    {
      name: ruleSetNameOf("team"),
      location: { location: "folder", path: repoPathOf("tools/hone-rules") },
    },
  ],
  checks: [
    {
      address: { ruleSet: "hone", check: "claimed-type#non-null-assertions" },
      state: { state: "run", engine: "eslint" },
    },
    {
      address: { ruleSet: "hone", check: "date-used-directly#clock-sources" },
      state: { state: "run", engine: "walker" },
    },
    {
      address: { ruleSet: "hone", check: "loop-keyword#loop-statement" },
      state: { state: "not-adopted" },
    },
    {
      address: { ruleSet: { name: ruleSetNameOf("team") }, check: "no-tmp-file#tmp-paths" },
      state: { state: "not-run" },
    },
  ],
  checkSettings: [
    { address: { ruleSet: "hone", check: "branch-in-a-test#test-body" }, values: { edition: "2" } },
    {
      address: { ruleSet: "hone", check: "outside-import-past-a-boundary#import-or-require" },
      values: { confinedOutsideDependencies: ["uuid"] },
    },
  ],
  forfeiture: "elsewhere",
  reportOutput: "counts",
  checkEditions: "latest",
  eslintConfigLookup: { lookup: "declared", value: "nearest-to-file" },
  eslintConfigRoots: [repoPathOf("web")],
  eslintProjectionKind: "ts",
  conventions: {
    conventions: {
      generated: [{ files: ["generated/*.ts"], outsideParty: "codegen" }],
      layers: [{ layer: "domain", folders: [repoPathOf("src/domain")] }],
      testFiles: { suffixes: ["spec"], folders: ["__tests__"] },
    },
    declared: ["generated", "layers", "testFiles"],
  },
};

const UNSORTED_FILE: VersionTwoSettingsFile = {
  ...SMALLEST_FILE,
  ruleSets: [
    {
      name: ruleSetNameOf("team"),
      location: { location: "folder", path: repoPathOf("tools/hone-rules") },
    },
    { name: ruleSetNameOf("local"), location: { location: "repo-root" } },
  ],
  checks: [
    {
      address: { ruleSet: "hone", check: "loop-keyword#loop-statement" },
      state: { state: "not-adopted" },
    },
    {
      address: { ruleSet: "hone", check: "date-used-directly#clock-sources" },
      state: { state: "run", engine: "walker" },
    },
  ],
};

const UNSORTED_TEXT = `{
  "version": 2,
  "ruleSets": {
    "local": ".",
    "team": "tools/hone-rules"
  },
  "checks": {
    "date-used-directly#clock-sources": "walker",
    "loop-keyword#loop-statement": "not-adopted"
  }
}
`;

describe("settingsWireOf", () => {
  it("writes only the version, the rule sets and the checks for the smallest file, every default left out", () => {
    expect(settingsWireOf({ settings: SMALLEST_FILE })).toEqual({
      version: 2,
      ruleSets: {},
      checks: {},
    });
  });

  it("writes every field of a full settings file", () => {
    expect(settingsWireOf({ settings: FULL_FILE })).toEqual({
      version: 2,
      ruleSets: { local: ".", team: "tools/hone-rules" },
      checks: {
        "claimed-type#non-null-assertions": "eslint",
        "date-used-directly#clock-sources": "walker",
        "loop-keyword#loop-statement": "not-adopted",
        "team/no-tmp-file#tmp-paths": "not-run",
      },
      checkSettings: {
        "branch-in-a-test#test-body": { edition: "2" },
        "outside-import-past-a-boundary#import-or-require": {
          confinedOutsideDependencies: ["uuid"],
        },
      },
      exclude: ["vendor"],
      eslintConfigRoots: ["web"],
      forfeiture: "elsewhere",
      reportOutput: "counts",
      checkEditions: "latest",
      eslintConfigLookup: "nearest-to-file",
      eslintProjectionKind: "ts",
      generated: [{ files: ["generated/*.ts"], outsideParty: "codegen" }],
      layers: { domain: ["src/domain"] },
      testFiles: { suffixes: ["spec"], folders: ["__tests__"] },
    });
  });

  it("is read back by settingsFileOf as the same full settings file", () => {
    expect(settingsFileOf({ document: settingsWireOf({ settings: FULL_FILE }) })).toEqual({
      outcome: "ok",
      value: FULL_FILE,
    });
  });

  it("is read back by settingsFileOf as the same smallest settings file", () => {
    expect(settingsFileOf({ document: settingsWireOf({ settings: SMALLEST_FILE }) })).toEqual({
      outcome: "ok",
      value: SMALLEST_FILE,
    });
  });
});

describe("settingsTextOf", () => {
  it("writes rule sets and checks in key order, indented by two spaces, with a closing newline", () => {
    expect(settingsTextOf({ settings: UNSORTED_FILE })).toBe(UNSORTED_TEXT);
  });
});
