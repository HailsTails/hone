import { assert, describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { checkNamesOf } from "../../domain/language-layer/check-address-text.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import type { DeclaredRuleSet } from "../../domain/settings/settings-file.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { createPathPort } from "../node/path-port.ts";
import { engineIdSchema } from "./identifiers.ts";
import { createCheckPieceSource, createSettingsSources } from "./settings-sources.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const INSTALL_ROOT = absoluteRootOf("/install");

const AUDIT = "walker";

const SETTINGS_TEXT = `{ "version": 2, "ruleSets": {}, "checks": {} }`;

const NAMES = `{
  "version": 1,
  "clauses": [
    { "clause": "CD-15#loops", "sight": { "kind": "one-symptom", "symptom": "loop-keyword" }, "checks": ["loop-keyword#loop-statement"], "anchor": { "kind": "file" } },
    { "clause": "CD-15#loop-intent", "sight": { "kind": "outside-the-cases" }, "checks": [] }
  ],
  "recordKinds": {}
}`;

const LOOPS_CASES = `{
  "flag": [{ "name": "flagged", "fileName": "src/a.ts", "source": "let a = 1;\\n", "expectedLines": [1] }],
  "allow": [{ "name": "allowed", "fileName": "src/b.ts", "source": "const b = 1;\\n", "expectedLines": [] }]
}`;

const TM_1_DISCIPLINE = `{
  "version": 1,
  "id": "TM-1",
  "clauses": [
    {
      "kind": "mechanical",
      "id": "loops",
      "summary": "no loop statements",
      "mechanisms": ["walker"],
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
      "mechanisms": ["walker"],
      "anchor": { "kind": "file" },
      "cases": {
        "flag": [{ "name": "flagged", "fileName": "src/a.ts", "source": "let a = 1;\\n", "expectedLines": [1] }],
        "allow": [{ "name": "allowed", "fileName": "src/b.ts", "source": "const b = 1;\\n", "expectedLines": [] }]
      }
    }
  ]
}`;

const TM_1_PIECE = `{
  "version": 1,
  "discipline": "TM-1",
  "mechanism": "walker",
  "clauses": [{ "clause": "loops", "settings": { "module": "loops.ts" } }]
}`;

const CD_15_PIECE = `{
  "version": 2,
  "anchor": { "kind": "file" },
  "settings": { "module": "loops.ts" }
}`;

const RUNNER_TEXT = "export const runner = {};\n";

const INSTALL_FILES: Readonly<Record<string, string>> = {
  "/repo/hone.config.json": SETTINGS_TEXT,
  "/install/src/infrastructure/disciplines-file/version-one-names.json": NAMES,
  "/install/src/infrastructure/engines/walker/loop-keyword/loop-statement/piece.json": CD_15_PIECE,
  "/install/src/infrastructure/engines/walker/loop-keyword/loop-statement/loop-statement.examples.json":
    LOOPS_CASES,
  "/install/src/infrastructure/engines/walker/runner/runner.ts": RUNNER_TEXT,
};

const TEAM_FILES: Readonly<Record<string, string>> = {
  "/repo/tools/hone-rules/rules/TM-1/discipline.json": TM_1_DISCIPLINE,
  "/install/src/infrastructure/engines/walker/runner/runner.ts": RUNNER_TEXT,
};

const inMemoryFileText = (request: {
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
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
    directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
    repoRoot: REPO_ROOT,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    fileText: inMemoryFileText({ files: request.files }),
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  });

const TEAM_ROOT = absoluteRootOf("/repo/tools/hone-rules");

describe("createCheckPieceSource", () => {
  it("uses the installed runner with the team's named piece and resolves its forms", () => {
    const names = checkNamesOf({ text: "loop-keyword#loop-statement" });
    assert(names !== undefined);
    const source = createCheckPieceSource({
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts",
      fileText: inMemoryFileText({
        files: {
          ...TEAM_FILES,
          "/repo/tools/hone-rules/engines/walker/loop-keyword/loop-statement/piece.json":
            JSON.stringify({
              version: 2,
              anchor: { kind: "file" },
              settings: { module: "check.ts" },
              forms: { for: { symptom: "loop-keyword", check: "loop-statement" } },
            }),
        },
      }),
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
    });

    expect(source({ names, ruleSetRoot: TEAM_ROOT, mechanism: "walker" })).toMatchObject({
      outcome: "ok",
      value: {
        pieceRoot: "/repo/tools/hone-rules/engines/walker/loop-keyword/loop-statement",
        forms: { for: "loop-keyword#loop-statement" },
        settings: { module: "check.ts" },
      },
    });
  });

  it("reports the unavailable installed runner before reading the piece", () => {
    const names = checkNamesOf({ text: "loop-keyword#loop-statement" });
    assert(names !== undefined);
    const read = vi.fn<FileTextPort["read"]>();
    const source = createCheckPieceSource({
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts",
      fileText: {
        read,
        exists: () => "absent",
        write: vi.fn<FileTextPort["write"]>(),
      },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
    });

    expect(source({ names, ruleSetRoot: TEAM_ROOT, mechanism: "walker" })).toEqual({
      outcome: "failed",
      error: { kind: "runner-missing", mechanism: "walker" },
    });
    expect(read).not.toHaveBeenCalled();
  });
});

const pieceOf = (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly ruleSetRoot: AbsolutePath;
  readonly clause: string;
  readonly mechanism: string;
}) =>
  sourcesOver({ files: request.files }).pieceClause({
    ruleSetRoot: request.ruleSetRoot,
    clause: clauseAddressSchema.parse(request.clause),
    mechanism: engineIdSchema.parse(request.mechanism),
  });

describe("createSettingsSources", () => {
  it("reads hone.config.json at the repository root as a document, naming its path", () => {
    expect(sourcesOver({ files: INSTALL_FILES }).settingsFile({})).toEqual({
      outcome: "ok",
      value: { path: "/repo/hone.config.json", document: { version: 2, ruleSets: {}, checks: {} } },
    });
  });

  it("names the repository when it has no hone.config.json", () => {
    expect(sourcesOver({ files: {} }).settingsFile({})).toEqual({
      outcome: "failed",
      error: { kind: "selection-absent", repo: "/repo" },
    });
  });

  it("names the file when hone.config.json is not JSON", () => {
    expect(
      sourcesOver({ files: { "/repo/hone.config.json": "{ version" } }).settingsFile({}),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/repo/hone.config.json" },
    });
  });

  it("finds Hone's own rule set at the install root and a declared one under the repository", () => {
    const sources = sourcesOver({ files: INSTALL_FILES });
    const ruleSets: readonly DeclaredRuleSet[] = [
      {
        name: ruleSetNameOf("team"),
        location: { location: "folder", path: repoPathOf("tools/hone-rules") },
      },
    ];
    expect({
      hone: sources.ruleSetRoot({ ruleSet: "hone", ruleSets }),
      team: sources.ruleSetRoot({ ruleSet: { name: ruleSetNameOf("team") }, ruleSets }),
    }).toEqual({
      hone: { outcome: "ok", value: "/install" },
      team: { outcome: "ok", value: "/repo/tools/hone-rules" },
    });
  });

  it("holds no symptom catalogue where a rule set has none", () => {
    expect(sourcesOver({ files: INSTALL_FILES }).catalogue({ ruleSetRoot: INSTALL_ROOT })).toEqual({
      outcome: "ok",
      value: { held: "none" },
    });
  });

  it("reports an unreadable named catalogue at the declared rule-set root", () => {
    const sources = createSettingsSources({
      directory: {
        list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({
          outcome: "failed",
          error: {
            kind: "directory-unreadable",
            path: absoluteRootOf("/repo/tools/hone-rules/rules"),
            detail: "EACCES",
          },
        }),
        create: vi.fn<DirectoryPort["create"]>(),
      },
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts",
      fileText: {
        read: vi.fn<FileTextPort["read"]>(),
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
        write: vi.fn<FileTextPort["write"]>(),
      },
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
    });
    expect(sources.catalogue({ ruleSetRoot: absoluteRootOf("/repo/tools/hone-rules") })).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        path: "/repo/tools/hone-rules/rules",
        detail: "EACCES",
      },
    });
  });

  it("reads the piece of a mechanical clause with its definition's anchor and exceptions", () => {
    expect(
      pieceOf({
        files: INSTALL_FILES,
        ruleSetRoot: INSTALL_ROOT,
        clause: "CD-15#loops",
        mechanism: "walker",
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        anchor: { kind: "file" },
        pieceRoot: "/install/src/infrastructure/engines/walker/loop-keyword/loop-statement",
        settings: { module: "loops.ts" },
        declarations: {},
      },
    });
  });

  it("refuses a discipline the rule set lacks", () => {
    expect(
      pieceOf({
        files: INSTALL_FILES,
        ruleSetRoot: INSTALL_ROOT,
        clause: "CD-99#loops",
        mechanism: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-discipline", address: "CD-99#loops" },
    });
  });

  it("refuses a clause its discipline lacks", () => {
    expect(
      pieceOf({
        files: INSTALL_FILES,
        ruleSetRoot: INSTALL_ROOT,
        clause: "CD-15#nothing",
        mechanism: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-clause", address: "CD-15#nothing" },
    });
  });

  it("refuses a judgement clause", () => {
    expect(
      pieceOf({
        files: INSTALL_FILES,
        ruleSetRoot: INSTALL_ROOT,
        clause: "CD-15#loop-intent",
        mechanism: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "judgement-clause-selected", address: "CD-15#loop-intent" },
    });
  });

  it("refuses a mechanism the clause does not allow", () => {
    expect(
      pieceOf({
        files: INSTALL_FILES,
        ruleSetRoot: INSTALL_ROOT,
        clause: "CD-15#loops",
        mechanism: "eslint",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: "eslint" },
    });
  });

  it("refuses a mechanism whose runner is not installed", () => {
    expect(
      pieceOf({
        files: {
          "/install/src/infrastructure/disciplines-file/version-one-names.json": NAMES,
          "/install/src/infrastructure/engines/walker/loop-keyword/loop-statement/piece.json":
            CD_15_PIECE,
          "/install/src/infrastructure/engines/walker/loop-keyword/loop-statement/loop-statement.examples.json":
            LOOPS_CASES,
        },
        ruleSetRoot: INSTALL_ROOT,
        clause: "CD-15#loops",
        mechanism: "walker",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "runner-missing", mechanism: AUDIT } });
  });

  it("refuses a team clause whose discipline has no piece for the mechanism", () => {
    expect(
      pieceOf({
        files: TEAM_FILES,
        ruleSetRoot: TEAM_ROOT,
        clause: "TM-1#loops",
        mechanism: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "TM-1#loops", mechanism: AUDIT },
    });
  });

  it("refuses a team clause its discipline's piece has no entry for", () => {
    expect(
      pieceOf({
        files: {
          ...TEAM_FILES,
          "/repo/tools/hone-rules/mechanisms/audit/TM-1/piece.json": TM_1_PIECE,
        },
        ruleSetRoot: TEAM_ROOT,
        clause: "TM-1#labels",
        mechanism: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "TM-1#labels", mechanism: AUDIT },
    });
  });

  it("refuses an install clause that no piece runs", () => {
    expect(
      pieceOf({
        files: {
          "/install/src/infrastructure/disciplines-file/version-one-names.json": NAMES,
          "/install/src/infrastructure/engines/walker/runner/runner.ts": RUNNER_TEXT,
        },
        ruleSetRoot: INSTALL_ROOT,
        clause: "CD-15#loops",
        mechanism: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        path: "/install/src/infrastructure/disciplines-file/version-one-names.json",
        detail: "no piece runs CD-15#loops",
      },
    });
  });
});
