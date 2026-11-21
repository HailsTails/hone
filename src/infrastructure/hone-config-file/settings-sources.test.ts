import { describe, expect, it } from "vitest";
import type { FileTextPort } from "../node/file-system/file-text-port.ts";
import { createPathPort } from "../node/path-port.ts";
import { absolutePathSchema } from "../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema, ruleSetNameSchema } from "./identifiers.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import type { DeclaredRuleSet } from "./settings-file.ts";
import { createSettingsSources } from "./settings-sources.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const INSTALL_ROOT = absolutePathSchema.parse("/install");

const AUDIT = mechanismIdSchema.parse("audit");

const SETTINGS_TEXT = `{ "version": 2, "ruleSets": {}, "checks": {} }`;

const CD_15_DISCIPLINE = `{
  "version": 1,
  "id": "CD-15",
  "clauses": [
    {
      "kind": "mechanical",
      "id": "loops",
      "summary": "no loop statements",
      "mechanisms": ["audit"],
      "anchor": { "kind": "file" },
      "cases": {
        "flag": [{ "name": "flagged", "fileName": "src/a.ts", "source": "let a = 1;\\n", "expectedLines": [1] }],
        "allow": [{ "name": "allowed", "fileName": "src/b.ts", "source": "const b = 1;\\n", "expectedLines": [] }]
      }
    },
    {
      "kind": "mechanical",
      "id": "labels",
      "summary": "no labelled statements",
      "mechanisms": ["audit"],
      "anchor": { "kind": "file" },
      "cases": {
        "flag": [{ "name": "flagged", "fileName": "src/a.ts", "source": "let a = 2;\\n", "expectedLines": [1] }],
        "allow": [{ "name": "allowed", "fileName": "src/b.ts", "source": "const b = 1;\\n", "expectedLines": [] }]
      }
    },
    { "kind": "judgement", "id": "loop-intent", "summary": "a loop says what it is for", "enforcedBy": "review" }
  ]
}`;

const CD_15_PIECE = `{
  "version": 1,
  "discipline": "CD-15",
  "mechanism": "audit",
  "clauses": [{ "clause": "loops", "settings": { "module": "loops.ts" } }]
}`;

const RUNNER_TEXT = "export const runner = {};\n";

const INSTALL_FILES: Readonly<Record<string, string>> = {
  "/repo/hone.config.json": SETTINGS_TEXT,
  "/install/rules/CD-15/discipline.json": CD_15_DISCIPLINE,
  "/install/src/infrastructure/engines/audit/CD-15/piece.json": CD_15_PIECE,
  "/install/src/infrastructure/engines/audit/runner/runner.ts": RUNNER_TEXT,
};

const inMemoryFileText = (request: { readonly files: Readonly<Record<string, string>> }): FileTextPort => {
  const files = new Map(Object.entries(request.files));
  return {
    read: ({ path }) => {
      const text = files.get(path);
      return text === undefined
        ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } }
        : { outcome: "ok", value: text };
    },
    exists: ({ path }) => (files.has(path) ? "present" : "absent"),
    write: ({ path, text }) => {
      files.set(path, text);
      return { outcome: "ok", value: undefined };
    },
  };
};

const sourcesOver = (request: { readonly files: Readonly<Record<string, string>> }) =>
  createSettingsSources({
    repoRoot: REPO_ROOT,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    fileText: inMemoryFileText({ files: request.files }),
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  });

const pieceOf = (request: { readonly files: Readonly<Record<string, string>>; readonly clause: string; readonly mechanism: string }) =>
  sourcesOver({ files: request.files }).pieceClause({
    ruleSetRoot: INSTALL_ROOT,
    clause: clauseAddressSchema.parse(request.clause),
    mechanism: mechanismIdSchema.parse(request.mechanism),
  });

describe("createSettingsSources", () => {
  it("reads hone.config.json at the repository root as a document, naming its path", () => {
    expect(sourcesOver({ files: INSTALL_FILES }).settingsFile({})).toEqual({
      outcome: "ok",
      value: { path: "/repo/hone.config.json", document: { version: 2, ruleSets: {}, checks: {} } },
    });
  });

  it("names the repository when it has no hone.config.json", () => {
    expect(sourcesOver({ files: {} }).settingsFile({})).toEqual({ outcome: "failed", error: { kind: "selection-absent", repo: "/repo" } });
  });

  it("names the file when hone.config.json is not JSON", () => {
    expect(sourcesOver({ files: { "/repo/hone.config.json": "{ version" } }).settingsFile({})).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/repo/hone.config.json" },
    });
  });

  it("finds Hone's own rule set at the install root and a declared one under the repository", () => {
    const sources = sourcesOver({ files: INSTALL_FILES });
    const ruleSets: readonly DeclaredRuleSet[] = [{ name: ruleSetNameSchema.parse("team"), location: { location: "folder", path: repoPathSchema.parse("tools/hone-rules") } }];
    expect({
      hone: sources.ruleSetRoot({ ruleSet: "hone", ruleSets }),
      team: sources.ruleSetRoot({ ruleSet: { name: ruleSetNameSchema.parse("team") }, ruleSets }),
    }).toEqual({
      hone: { outcome: "ok", value: "/install" },
      team: { outcome: "ok", value: "/repo/tools/hone-rules" },
    });
  });

  it("holds no symptom catalogue where a rule set has none", () => {
    expect(sourcesOver({ files: INSTALL_FILES }).catalogue({ ruleSetRoot: INSTALL_ROOT })).toEqual({ outcome: "ok", value: { held: "none" } });
  });

  it("reads the piece of a mechanical clause with its definition's anchor and exceptions", () => {
    expect(pieceOf({ files: INSTALL_FILES, clause: "CD-15#loops", mechanism: "audit" })).toMatchObject({
      outcome: "ok",
      value: {
        anchor: { kind: "file" },
        pieceRoot: "/install/src/infrastructure/engines/audit/CD-15",
        settings: { module: "loops.ts" },
        declarations: {},
      },
    });
  });

  it("refuses a discipline the rule set lacks", () => {
    expect(pieceOf({ files: INSTALL_FILES, clause: "CD-99#loops", mechanism: "audit" })).toEqual({
      outcome: "failed",
      error: { kind: "unknown-discipline", address: "CD-99#loops" },
    });
  });

  it("refuses a clause its discipline lacks", () => {
    expect(pieceOf({ files: INSTALL_FILES, clause: "CD-15#nothing", mechanism: "audit" })).toEqual({
      outcome: "failed",
      error: { kind: "unknown-clause", address: "CD-15#nothing" },
    });
  });

  it("refuses a judgement clause", () => {
    expect(pieceOf({ files: INSTALL_FILES, clause: "CD-15#loop-intent", mechanism: "audit" })).toEqual({
      outcome: "failed",
      error: { kind: "judgement-clause-selected", address: "CD-15#loop-intent" },
    });
  });

  it("refuses a mechanism the clause does not allow", () => {
    expect(pieceOf({ files: INSTALL_FILES, clause: "CD-15#loops", mechanism: "eslint" })).toEqual({
      outcome: "failed",
      error: { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: "eslint" },
    });
  });

  it("refuses a mechanism whose runner is not installed", () => {
    expect(
      pieceOf({
        files: {
          "/install/rules/CD-15/discipline.json": CD_15_DISCIPLINE,
          "/install/src/infrastructure/engines/audit/CD-15/piece.json": CD_15_PIECE,
        },
        clause: "CD-15#loops",
        mechanism: "audit",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "runner-missing", mechanism: AUDIT } });
  });

  it("refuses a clause whose discipline has no piece for the mechanism", () => {
    expect(
      pieceOf({
        files: {
          "/install/rules/CD-15/discipline.json": CD_15_DISCIPLINE,
          "/install/src/infrastructure/engines/audit/runner/runner.ts": RUNNER_TEXT,
        },
        clause: "CD-15#loops",
        mechanism: "audit",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "piece-missing", address: "CD-15#loops", mechanism: AUDIT } });
  });

  it("refuses a clause its discipline's piece has no entry for", () => {
    expect(pieceOf({ files: INSTALL_FILES, clause: "CD-15#labels", mechanism: "audit" })).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "CD-15#labels", mechanism: AUDIT },
    });
  });
});
