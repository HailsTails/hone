import { assert, describe, expect, it, vi } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { checkedSourceOf, type SourceChecking } from "./checked-source.ts";
import { textsDisk } from "./walker-disk.ts";
import type { WalkerFile } from "./walker-piece.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
const SYNTAX_API = loadedParsePort.value.syntaxApi;

describe("checkedSourceOf", () => {
  it.each([
    { file: "src/route.ts", checking: "checked" },
    { file: "src/route.tsx", checking: "checked" },
    { file: "src/route.mts", checking: "checked" },
    { file: "src/route.cts", checking: "checked" },
    { file: "src/route.d.mts", checking: "checked" },
    { file: "dist/route.mts", checking: "unchecked" },
    { file: "node_modules/pkg/route.js", checking: "unchecked" },
    { file: "src/route.json", checking: "unchecked" },
  ])("judges $file $checking without reading it", ({ file, checking }) => {
    const readText = vi.fn<WalkerFile["readText"]>();
    const checkedSource = checkedSourceOf({
      syntaxApi: SYNTAX_API,
      disk: textsDisk({
        root: "/repo",
        texts: { "tsconfig.json": '{"compilerOptions":{"checkJs":true}}' },
      }),
    });

    expect(checkedSource({ file: repoPathSchema.parse(file), readText })).toEqual({
      outcome: "ok",
      value: checking,
    });
    expect(readText).not.toHaveBeenCalled();
  });

  it.each([
    { name: "a line pragma", source: "// @ts-check\nexport const a = 1;\n", checking: "checked" },
    {
      name: "a pragma after a shebang",
      source: "#!/usr/bin/env node\n// @ts-check\nexport const a = 1;\n",
      checking: "checked",
    },
    { name: "no pragma", source: "export const a = 1;\n", checking: "unchecked" },
    {
      name: "a block comment",
      source: "/* @ts-check */\nexport const a = 1;\n",
      checking: "unchecked",
    },
    {
      name: "a pragma after the first statement",
      source: "export const a = 1;\n// @ts-check\n",
      checking: "unchecked",
    },
  ])(
    "judges a JavaScript file with $name $checking when no config checks it",
    ({ source, checking }) => {
      const checkedSource = checkedSourceOf({
        syntaxApi: SYNTAX_API,
        disk: textsDisk({ root: "/repo", texts: { "tsconfig.json": "{}" } }),
      });

      expect(
        checkedSource({
          file: repoPathOf("src/route.js"),
          readText: () => ({ outcome: "ok", value: source }),
        }),
      ).toEqual({ outcome: "ok", value: checking });
    },
  );

  it.each<{
    readonly name: string;
    readonly texts: Readonly<Record<string, string>>;
    readonly checking: SourceChecking;
  }>([
    {
      name: "a root config turning checkJs on",
      texts: { "tsconfig.json": '{"compilerOptions":{"checkJs":true}}' },
      checking: "checked",
    },
    {
      name: "a base the nearest config extends",
      texts: {
        "tsconfig.base.json": '{"compilerOptions":{"checkJs":true}}',
        "packages/app/tsconfig.json": '{"extends":"../../tsconfig.base.json"}',
      },
      checking: "checked",
    },
    {
      name: "a nearer config leaving checkJs off",
      texts: {
        "tsconfig.json": '{"compilerOptions":{"checkJs":true}}',
        "packages/app/tsconfig.json": "{}",
      },
      checking: "unchecked",
    },
    { name: "no config", texts: {}, checking: "unchecked" },
  ])("judges a pragma-free JavaScript file under $name $checking", ({ texts, checking }) => {
    const checkedSource = checkedSourceOf({
      syntaxApi: SYNTAX_API,
      disk: textsDisk({ root: "/repo", texts }),
    });

    expect(
      [
        "packages/app/src/route.js",
        "packages/app/src/view.jsx",
        "packages/app/run.mjs",
        "packages/app/run.cjs",
      ].map((file) =>
        checkedSource({
          file: repoPathSchema.parse(file),
          readText: () => ({ outcome: "ok", value: "export const a = 1;\n" }),
        }),
      ),
    ).toEqual([
      { outcome: "ok", value: checking },
      { outcome: "ok", value: checking },
      { outcome: "ok", value: checking },
      { outcome: "ok", value: checking },
    ]);
  });

  it("passes on the failure of a JavaScript file it cannot read", () => {
    const file = repoPathOf("src/route.js");
    const checkedSource = checkedSourceOf({
      syntaxApi: SYNTAX_API,
      disk: textsDisk({ root: "/repo", texts: {} }),
    });

    expect(
      checkedSource({
        file,
        readText: () => ({
          outcome: "failed",
          error: { kind: "file-unreadable", file, detail: "denied" },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file, detail: "denied" },
    });
  });
});
