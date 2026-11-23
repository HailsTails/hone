import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { configRootOf, typeScriptConfigOf } from "./typescript-config.ts";
import { textsDisk } from "./walker-disk.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
const SYNTAX_API = loadedParsePort.value.syntaxApi;

describe("configRootOf", () => {
  it.each([
    { root: "/repo", expected: "/repo" },
    { root: "C:\\work\\repo", expected: "C:/work/repo" },
  ])("writes $root as $expected", ({ root, expected }) => {
    expect(configRootOf({ disk: textsDisk({ root, texts: {} }) })).toBe(expected);
  });
});

describe("typeScriptConfigOf", () => {
  it("parses a config through what it extends, recording the includes it lists", () => {
    const config = typeScriptConfigOf({
      syntaxApi: SYNTAX_API,
      disk: textsDisk({
        root: "/repo",
        texts: {
          "tsconfig.base.json": '{"compilerOptions":{"checkJs":true}}',
          "packages/app/tsconfig.json": '{"extends":"../../tsconfig.base.json","include":["src"]}',
        },
      }),
      root: "/repo",
      path: "/repo/packages/app/tsconfig.json",
    });
    assert(config.kind === "parsed");

    expect(config.parsed.options.checkJs).toBe(true);
    expect(config.source.extendedSourceFiles).toEqual(["/repo/tsconfig.base.json"]);
    expect(config.includesListed).toEqual(["src"]);
  });

  it("is unresolved with TypeScript's diagnostic, written relative to the root", () => {
    expect(
      typeScriptConfigOf({
        syntaxApi: SYNTAX_API,
        disk: textsDisk({
          root: "/repo",
          texts: { "tsconfig.json": '{"extends":"./missing.json"}' },
        }),
        root: "/repo",
        path: "/repo/tsconfig.json",
      }),
    ).toEqual({ kind: "unresolved", detail: "TS5083 Cannot read file 'missing.json'." });
  });
});
