import { assert, describe, expect, it } from "vitest";

import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import {
  createDefaultTypeScriptDeclarationPort,
  publishedDeclarationText,
} from "./typescript-declaration-port.ts";

const REPO_ROOT = `${import.meta.dirname}/../../..`;

const port = createDefaultTypeScriptDeclarationPort({});

const emitted = (request: { readonly entryPoints: readonly string[] }) =>
  port.emit({ sourceRoot: REPO_ROOT, entryPoints: request.entryPoints });

const ENTRIES_EMITTED_TOGETHER = emitted({
  entryPoints: [
    "src/domain/runner/piece-failure-types.ts",
    "src/domain/repository/repo-path-types.ts",
    "src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts",
    "src/domain/repository/branded.ts",
  ],
});

describe("the TypeScript declaration port, emitting in memory with the repository's own TypeScript and tsconfig (CD-47: nothing is spawned or written)", () => {
  it("emits a declaration per source module the entries import, and nothing else, without diagnostics", async () => {
    const entriesEmit = await ENTRIES_EMITTED_TOGETHER;
    assert(entriesEmit.outcome === "ok");

    expect(entriesEmit.value.diagnostics).toEqual([]);
    expect(entriesEmit.value.declarations).toMatchObject([
      { path: "src/domain/repository/branded.d.ts", specifiers: [], refusals: [] },
      {
        path: "src/domain/repository/repo-path-types.d.ts",
        specifiers: ["./branded.js"],
        refusals: [],
      },
      {
        path: "src/domain/runner/piece-failure-types.d.ts",
        specifiers: ["../repository/repo-path-types.js"],
        refusals: [],
      },
      {
        path: "src/infrastructure/engines/walker/runner/toolchain/typescript-parse.d.ts",
        specifiers: ["typescript"],
        refusals: [],
      },
    ]);
  });

  it("rewrites relative .ts specifiers to the .js form a published declaration resolves from", async () => {
    await expect(ENTRIES_EMITTED_TOGETHER).resolves.toMatchObject({
      outcome: "ok",
      value: {
        declarations: expect.arrayContaining([
          expect.objectContaining({
            path: "src/domain/repository/repo-path-types.d.ts",
            text: expect.stringContaining('from "./branded.js"'),
          }),
        ]),
      },
    });
  });

  it("keeps the exported values of a module it was handed as an entry", async () => {
    await expect(ENTRIES_EMITTED_TOGETHER).resolves.toMatchObject({
      outcome: "ok",
      value: {
        declarations: expect.arrayContaining([
          expect.objectContaining({
            path: "src/infrastructure/engines/walker/runner/toolchain/typescript-parse.d.ts",
            specifiers: ["typescript"],
            text: expect.stringContaining(
              "export declare const defaultTypeScriptModules: TypeScriptModules;",
            ),
            refusals: [],
          }),
        ]),
      },
    });
  });

  it("keeps the module's type aliases", async () => {
    await expect(ENTRIES_EMITTED_TOGETHER).resolves.toMatchObject({
      outcome: "ok",
      value: {
        declarations: expect.arrayContaining([
          expect.objectContaining({
            path: "src/infrastructure/engines/walker/runner/toolchain/typescript-parse.d.ts",
            text: expect.stringContaining("export type SyntaxApi = typeof typescript;"),
          }),
        ]),
      },
    });
  });

  it("keeps a module-private unique symbol a type depends on", async () => {
    await expect(ENTRIES_EMITTED_TOGETHER).resolves.toMatchObject({
      outcome: "ok",
      value: {
        declarations: expect.arrayContaining([
          expect.objectContaining({
            path: "src/domain/repository/branded.d.ts",
            text: expect.stringContaining("declare const brandName: unique symbol;"),
          }),
        ]),
      },
    });
  });

  it("reports a diagnostic for an entry that does not exist", async () => {
    await expect(
      emitted({ entryPoints: ["src/domain/repository/missing.ts"] }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { diagnostics: [expect.stringContaining("missing.ts")] },
    });
  });
});

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: REPO_ROOT, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);

const syntaxApi = loadedParsePort.value.syntaxApi;

const ONLY_TYPES =
  "a shipped declaration may hold only type declarations, type-only imports and type-only exports";

const VALUE_RE_EXPORT = `a value re-export from ./other.js; ${ONLY_TYPES}`;

describe("publishedDeclarationText, over declaration text parsed and printed with the repository's own TypeScript", () => {
  it("drops exported values and export assignments, and keeps types and private declarations", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        role: "internal",
        text: "export declare const answer: 1;\nexport declare function ask(): void;\nexport declare class Asker {\n}\nexport declare enum Mood {\n    Calm = 0\n}\nexport default answer;\nexport type Answer = 1;\ndeclare const brand: unique symbol;\n",
      }),
    ).toEqual({
      text: "export type Answer = 1;\ndeclare const brand: unique symbol;\n",
      refusals: [],
    });
  });

  it("leaves a value out of a local export list, drops a list naming only values, and keeps the types beside them", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        role: "internal",
        text: "declare const answer = 1;\ntype Answer = number;\nexport { answer, Answer };\nexport { answer as reply };\n",
      }),
    ).toEqual({
      text: "declare const answer = 1;\ntype Answer = number;\nexport { Answer };\n",
      refusals: [],
    });
  });
});

describe("publishedDeclarationText, for an entry declaration", () => {
  it("keeps the values an entry exports, typed by what it imports as types", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "api/testing.d.ts",
        role: "entry",
        text: 'import type { Ask } from "./other.js";\nexport declare const ask: Ask;\nexport declare function reply(): void;\nexport type Answer = 1;\n',
      }),
    ).toEqual({
      text: 'import type { Ask } from "./other.js";\nexport declare const ask: Ask;\nexport declare function reply(): void;\nexport type Answer = 1;\n',
      refusals: [],
    });
  });

  it("keeps a default export naming a private value, the module's runtime default now declared", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "api/eslint-plugin.d.ts",
        role: "entry",
        text: "export type Plugin = 1;\ndeclare const plugin: Plugin;\nexport default plugin;\n",
      }),
    ).toEqual({
      text: "export type Plugin = 1;\ndeclare const plugin: Plugin;\nexport default plugin;\n",
      refusals: [],
    });
  });

  it("drops an export equals naming a private value of the entry", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "api/eslint-plugin.d.ts",
        role: "entry",
        text: "export type Plugin = 1;\ndeclare const plugin: Plugin;\nexport = plugin;\n",
      }),
    ).toEqual({ text: "export type Plugin = 1;\ndeclare const plugin: Plugin;\n", refusals: [] });
  });

  it("drops a default export naming a private value of an internal file", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "core/plugin.d.ts",
        role: "internal",
        text: "export type Plugin = 1;\ndeclare const plugin: Plugin;\nexport default plugin;\n",
      }),
    ).toEqual({ text: "export type Plugin = 1;\ndeclare const plugin: Plugin;\n", refusals: [] });
  });

  it("drops a default export naming no private value of the entry", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "api/eslint-plugin.d.ts",
        role: "entry",
        text: "export type Plugin = 1;\nexport default other;\n",
      }),
    ).toEqual({ text: "export type Plugin = 1;\n", refusals: [] });
  });

  it("still refuses a value re-export, whose module declares no values", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "api/audit.d.ts",
        role: "entry",
        text: 'export { answer } from "./other.js";\n',
      }),
    ).toEqual({
      text: "export {};\n",
      refusals: [`api/audit.d.ts: ${VALUE_RE_EXPORT}`],
    });
  });
});

describe("the TypeScript declaration port, emitting a public entry that exports values", () => {
  it("keeps the entry's values and leaves out the values of what it imports", async () => {
    const emit = await emitted({ entryPoints: ["src/audit.ts"] });
    expect(emit).toMatchObject({
      outcome: "ok",
      value: {
        diagnostics: [],
        declarations: expect.arrayContaining([
          expect.objectContaining({
            path: "src/audit.d.ts",
            text: expect.stringContaining("export declare const folderScope: (request: {"),
            refusals: [],
          }),
          expect.objectContaining({
            path: "src/infrastructure/engines/walker/runner/toolchain/typescript-parse.d.ts",
            text: expect.not.stringContaining("defaultTypeScriptModules"),
          }),
        ]),
      },
    });
  });
});

describe("publishedDeclarationText, refusing what a shipped declaration may not hold", () => {
  it("refuses every value re-export from another module and keeps a type-only one", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        role: "internal",
        text: 'export * from "./other.js";\nexport * as other from "./other.js";\nexport { answer } from "./other.js";\nexport type { Answer } from "./other.js";\n',
      }),
    ).toEqual({
      text: 'export type { Answer } from "./other.js";\n',
      refusals: [
        `entry.d.ts: ${VALUE_RE_EXPORT}`,
        `entry.d.ts: ${VALUE_RE_EXPORT}`,
        `entry.d.ts: ${VALUE_RE_EXPORT}`,
      ],
    });
  });

  it("refuses a value imported and exported again, and an import-equals, as it refuses a value re-export", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        role: "internal",
        text: 'import { answer } from "./other.js";\nexport { answer };\nimport reply = require("./other.js");\nexport { reply };\n',
      }),
    ).toEqual({
      text: "export {};\n",
      refusals: [
        `entry.d.ts: a value import from ./other.js; ${ONLY_TYPES}`,
        `entry.d.ts: "answer" is exported but is not a type declared or imported as a type here; ${ONLY_TYPES}`,
        `entry.d.ts: the import-equals "reply"; ${ONLY_TYPES}`,
        `entry.d.ts: "reply" is exported but is not a type declared or imported as a type here; ${ONLY_TYPES}`,
      ],
    });
  });

  it("keeps a type imported as a type and exported again", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        role: "internal",
        text: 'import type { Answer } from "./other.js";\nexport { Answer };\n',
      }),
    ).toEqual({
      text: 'import type { Answer } from "./other.js";\nexport { Answer };\n',
      refusals: [],
    });
  });

  it("refuses namespaces, global and module augmentations, an exported import-equals and a global namespace export, exported or not", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        role: "internal",
        text: 'export declare namespace Space {\n    const inner: 1;\n}\ndeclare namespace Hidden {\n}\nexport { Hidden };\ndeclare global {\n    var answer: 1;\n}\ndeclare module "other" {\n    export const answer: 1;\n}\nexport import Alias = Space;\nexport as namespace Hone;\n',
      }),
    ).toEqual({
      text: "export {};\n",
      refusals: [
        `entry.d.ts: the module declaration "Space"; ${ONLY_TYPES}`,
        `entry.d.ts: the module declaration "Hidden"; ${ONLY_TYPES}`,
        `entry.d.ts: "Hidden" is exported but is not a type declared or imported as a type here; ${ONLY_TYPES}`,
        `entry.d.ts: the module declaration "global"; ${ONLY_TYPES}`,
        `entry.d.ts: the module declaration "other"; ${ONLY_TYPES}`,
        `entry.d.ts: the import-equals "Alias"; ${ONLY_TYPES}`,
        `entry.d.ts: "export as namespace Hone"; ${ONLY_TYPES}`,
      ],
    });
  });
});

describe("publishedDeclarationText, keeping a file a module", () => {
  it("marks a module whose every statement was dropped as a module still", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        role: "internal",
        text: "export declare const answer: 1;\n",
      }),
    ).toEqual({ text: "export {};\n", refusals: [] });
  });

  it("keeps an empty module marker so a types-only file stays a module", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        role: "internal",
        text: "type Local = 1;\nexport {};\n",
      }),
    ).toEqual({ text: "type Local = 1;\nexport {};\n", refusals: [] });
  });
});
