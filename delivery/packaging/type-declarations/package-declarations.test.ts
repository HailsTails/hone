import { describe, expect, it } from "vitest";

import {
  type DeclarationEmit,
  type DeclarationPort,
  declarationFilesOf,
  declarationReachedBy,
  PUBLIC_TYPE_ENTRIES,
  publishedDeclarationsOf,
  reachableDeclarations,
  typedExportOf,
} from "./package-declarations.ts";

const ENTRY = { subpath: "audit", source: "api/audit.ts" };

const declaration = (request: {
  readonly path: string;
  readonly specifiers: readonly string[];
}) => ({
  path: request.path,
  text: `${request.path}\n`,
  specifiers: request.specifiers,
  refusals: [],
});

const REFUSAL =
  "core/check/run-check.d.ts: a value import from zod; a shipped declaration may hold only type declarations, type-only imports and type-only exports";

const EMITTED: DeclarationEmit = {
  diagnostics: [],
  declarations: [
    declaration({
      path: "api/audit.d.ts",
      specifiers: ["../core/values/result.js", "../mechanisms/audit/runner/typescript-parse.js"],
    }),
    declaration({ path: "core/values/result.d.ts", specifiers: [] }),
    declaration({
      path: "mechanisms/audit/runner/typescript-parse.d.ts",
      specifiers: ["typescript"],
    }),
    declaration({ path: "core/check/run-check.d.ts", specifiers: ["zod"] }),
  ],
};

describe("PUBLIC_TYPE_ENTRIES", () => {
  it("names the eslint-plugin, rule-set, testing and walker entries and their hand-written sources", () => {
    expect(PUBLIC_TYPE_ENTRIES).toEqual([
      { subpath: "eslint-plugin", source: "src/eslint-plugin.ts" },
      { subpath: "rule-set", source: "src/rule-set.ts" },
      { subpath: "testing", source: "src/testing.ts" },
      { subpath: "walker", source: "src/walker.ts" },
    ]);
  });
});

describe("typedExportOf", () => {
  it("pairs an entry's subpath with the declaration and the module built from its source", () => {
    expect(typedExportOf({ entry: ENTRY })).toEqual({
      subpath: "audit",
      declaration: "api/audit.d.ts",
      module: "api/audit.js",
    });
  });
});

describe("declarationReachedBy", () => {
  it("resolves a relative .js specifier to the declaration beside it, from the importing declaration's folder", () => {
    expect(
      declarationReachedBy({ from: "api/audit.d.ts", specifier: "../core/values/result.js" }),
    ).toBe("core/values/result.d.ts");
  });

  it("is undefined for a package specifier", () => {
    expect(
      declarationReachedBy({ from: "api/audit.d.ts", specifier: "typescript" }),
    ).toBeUndefined();
  });
});

describe("reachableDeclarations", () => {
  it("follows relative specifiers from the roots and leaves out what nothing reaches", () => {
    expect(
      reachableDeclarations({ declarations: EMITTED.declarations, roots: ["api/audit.d.ts"] }),
    ).toEqual([
      "api/audit.d.ts",
      "core/values/result.d.ts",
      "mechanisms/audit/runner/typescript-parse.d.ts",
    ]);
  });
});

describe("publishedDeclarationsOf", () => {
  it("ships the declarations the entries reach, leaving each entry's module to the bundle", () => {
    expect(
      publishedDeclarationsOf({ emit: EMITTED, entries: [ENTRY], requiredPeers: ["typescript"] }),
    ).toEqual({
      outcome: "ok",
      value: [
        { path: "api/audit.d.ts", text: "api/audit.d.ts\n" },
        { path: "core/values/result.d.ts", text: "core/values/result.d.ts\n" },
        {
          path: "mechanisms/audit/runner/typescript-parse.d.ts",
          text: "mechanisms/audit/runner/typescript-parse.d.ts\n",
        },
      ],
    });
  });

  it("refuses a reached declaration that imports a package the consumer is not sure to have", () => {
    expect(publishedDeclarationsOf({ emit: EMITTED, entries: [ENTRY], requiredPeers: [] })).toEqual(
      {
        outcome: "failed",
        error: [
          "mechanisms/audit/runner/typescript-parse.d.ts imports typescript, which is neither shipped nor a required peer",
        ],
      },
    );
  });
});

describe("publishedDeclarationsOf, judging what each declaration's emit refused", () => {
  it("refuses a reached declaration holding what a shipped declaration may not", () => {
    expect(
      publishedDeclarationsOf({
        emit: {
          diagnostics: [],
          declarations: [
            declaration({ path: "api/audit.d.ts", specifiers: ["../core/check/run-check.js"] }),
            {
              ...declaration({ path: "core/check/run-check.d.ts", specifiers: [] }),
              refusals: [REFUSAL],
            },
          ],
        },
        entries: [ENTRY],
        requiredPeers: [],
      }),
    ).toEqual({ outcome: "failed", error: [`declaration emit reported: ${REFUSAL}`] });
  });

  it("ignores what a declaration nothing reaches would have been refused for, since it is not shipped", () => {
    expect(
      publishedDeclarationsOf({
        emit: {
          diagnostics: [],
          declarations: [
            declaration({ path: "api/audit.d.ts", specifiers: [] }),
            {
              ...declaration({ path: "core/check/run-check.d.ts", specifiers: [] }),
              refusals: [REFUSAL],
            },
          ],
        },
        entries: [ENTRY],
        requiredPeers: [],
      }),
    ).toEqual({ outcome: "ok", value: [{ path: "api/audit.d.ts", text: "api/audit.d.ts\n" }] });
  });
});

describe("publishedDeclarationsOf, refusing an incomplete emit", () => {
  it("refuses an emit that reported diagnostics", () => {
    expect(
      publishedDeclarationsOf({
        emit: { ...EMITTED, diagnostics: ["api/audit.ts: Cannot find module"] },
        entries: [ENTRY],
        requiredPeers: ["typescript"],
      }),
    ).toEqual({
      outcome: "failed",
      error: ["declaration emit reported: api/audit.ts: Cannot find module"],
    });
  });

  it("refuses an entry whose declaration was not emitted", () => {
    expect(
      publishedDeclarationsOf({
        emit: EMITTED,
        entries: [{ subpath: "rule-set", source: "api/rule-set.ts" }],
        requiredPeers: ["typescript"],
      }),
    ).toEqual({ outcome: "failed", error: ["api/rule-set.d.ts is reached but was not emitted"] });
  });

  it("refuses a reached specifier that names no emitted declaration", () => {
    expect(
      publishedDeclarationsOf({
        emit: {
          diagnostics: [],
          declarations: [
            declaration({ path: "api/audit.d.ts", specifiers: ["../core/values/result.ts"] }),
          ],
        },
        entries: [ENTRY],
        requiredPeers: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: ["core/values/result.ts is reached but was not emitted"],
    });
  });
});

const portEmitting = (request: {
  readonly emitted: Awaited<ReturnType<DeclarationPort["emit"]>>;
}): DeclarationPort => ({
  emit: () => Promise.resolve(request.emitted),
});

describe("declarationFilesOf", () => {
  it("publishes what the port emitted for the entries", async () => {
    await expect(
      declarationFilesOf({
        port: portEmitting({ emitted: { outcome: "ok", value: EMITTED } }),
        sourceRoot: "/repo",
        entries: [ENTRY],
        requiredPeers: ["typescript"],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: expect.arrayContaining([{ path: "api/audit.d.ts", text: "api/audit.d.ts\n" }]),
    });
  });

  it("names the port's failure", async () => {
    await expect(
      declarationFilesOf({
        port: portEmitting({
          emitted: {
            outcome: "failed",
            error: { kind: "declarations-failed", detail: "no tsconfig.json" },
          },
        }),
        sourceRoot: "/repo",
        entries: [ENTRY],
        requiredPeers: ["typescript"],
      }),
    ).resolves.toEqual({ outcome: "failed", error: "FAIL: emit declarations: no tsconfig.json" });
  });

  it("names every publication problem in one failure", async () => {
    await expect(
      declarationFilesOf({
        port: portEmitting({ emitted: { outcome: "ok", value: EMITTED } }),
        sourceRoot: "/repo",
        entries: [ENTRY],
        requiredPeers: [],
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error:
        "FAIL: publish declarations: mechanisms/audit/runner/typescript-parse.d.ts imports typescript, which is neither shipped nor a required peer",
    });
  });
});
