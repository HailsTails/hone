import { assert, describe, expect, it } from "vitest";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { SyntaxApi } from "../../runner/toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort, type TypeScriptPeers, typeScriptPeersNamed } from "../../runner/toolchain/typescript-toolchain.ts";
import type { OptionSettings, ResolvedConfig } from "./compiler-options-resolution.ts";
import { typeScriptCompilerOptionsOf } from "./typescript-compiler-options.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";

const DEVELOPMENT_ROOT = `${import.meta.dirname}/../../../../../..`;

const CURRENT_PEERS = defaultTypeScriptPeers({ installRoot: DEVELOPMENT_ROOT, installForm: "source" });

const FLOOR_PEERS: TypeScriptPeers = typeScriptPeersNamed({ installRoot: DEVELOPMENT_ROOT, installForm: "source", packageName: "typescript-floor" });

const syntaxApiOn = async (request: {
  readonly peers: TypeScriptPeers;
  readonly line: string;
  readonly version: RegExp;
}): Promise<SyntaxApi> => {
  const loaded = await loadParsePort({ peers: request.peers });
  assert(loaded.outcome === "ok", `the ${request.line} line loads from the development install`);
  assert(
    request.version.test(loaded.value.syntaxApi.version),
    `the ${request.line} line runs TypeScript ${loaded.value.syntaxApi.version}`,
  );
  return loaded.value.syntaxApi;
};

const CURRENT = await syntaxApiOn({ peers: CURRENT_PEERS, line: "typescript", version: /^6\./ });
const FLOOR = await syntaxApiOn({ peers: FLOOR_PEERS, line: "typescript-floor", version: /^4\.8\.4$/ });

const LEAF = repoPathOf("packages/a/tsconfig.json");

const UNSET: OptionSettings = {
  strict: "unset",
  noUncheckedIndexedAccess: "unset",
  exactOptionalPropertyTypes: "unset",
  noImplicitOverride: "unset",
  noFallthroughCasesInSwitch: "unset",
  noPropertyAccessFromIndexSignature: "unset",
  useUnknownInCatchVariables: "unset",
};

const STRICTEST_TEXT = `{
  // comments and trailing commas, as TypeScript accepts them
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
  },
}
`;

const STRICTEST_SETTINGS: OptionSettings = {
  ...UNSET,
  strict: "on",
  noUncheckedIndexedAccess: "on",
  exactOptionalPropertyTypes: "on",
  noImplicitOverride: "on",
  noFallthroughCasesInSwitch: "on",
  noPropertyAccessFromIndexSignature: "on",
};

const STRICTEST_PACKAGE = {
  "node_modules/@tsconfig/strictest/package.json": '{ "name": "@tsconfig/strictest", "version": "2.0.5" }',
  "node_modules/@tsconfig/strictest/tsconfig.json": STRICTEST_TEXT,
};

const ALL_ON = {
  strict: "on",
  noUncheckedIndexedAccess: "on",
  exactOptionalPropertyTypes: "on",
  noImplicitOverride: "on",
  noFallthroughCasesInSwitch: "on",
  noPropertyAccessFromIndexSignature: "on",
  useUnknownInCatchVariables: "on",
} as const;

const resolvedOn = (request: { readonly syntaxApi: typeof CURRENT; readonly texts: Readonly<Record<string, string>> }): ResolvedConfig =>
  typeScriptCompilerOptionsOf({ syntaxApi: request.syntaxApi, disk: textsDisk({ root: "/repository", texts: request.texts }) }).resolve({ file: LEAF });

describe("typeScriptCompilerOptionsOf resolving what a tsconfig.json extends", () => {
  it("follows a relative extends to a base that turns every option on", () => {
    expect(
      resolvedOn({
        syntaxApi: CURRENT,
        texts: {
          [LEAF]: '{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist" } }',
          "tsconfig.base.json": STRICTEST_TEXT,
        },
      }),
    ).toEqual({ kind: "resolved", effective: ALL_ON, bases: [{ file: "tsconfig.base.json", settings: STRICTEST_SETTINGS }] });
  });

  it("follows a package-name base under node_modules", () => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "extends": "@tsconfig/strictest/tsconfig.json" }', ...STRICTEST_PACKAGE } })).toEqual({
      kind: "resolved",
      effective: ALL_ON,
      bases: [{ file: "node_modules/@tsconfig/strictest/tsconfig.json", settings: STRICTEST_SETTINGS }],
    });
  });

  it("follows a workspace package's base reached through node_modules", () => {
    expect(
      resolvedOn({
        syntaxApi: CURRENT,
        texts: {
          [LEAF]: '{ "extends": "@acme/config/strict.json" }',
          "node_modules/@acme/config/package.json": '{ "name": "@acme/config", "version": "0.0.0" }',
          "node_modules/@acme/config/strict.json": '{ "compilerOptions": { "strict": false } }',
        },
      }),
    ).toEqual({
      kind: "resolved",
      effective: { strict: "off", noUncheckedIndexedAccess: "off", exactOptionalPropertyTypes: "off", noImplicitOverride: "off", noFallthroughCasesInSwitch: "off", noPropertyAccessFromIndexSignature: "off", useUnknownInCatchVariables: "off" },
      bases: [{ file: "node_modules/@acme/config/strict.json", settings: { ...UNSET, strict: "off" } }],
    });
  });

});

describe("typeScriptCompilerOptionsOf applying the bases of a chain in TypeScript's order", () => {
  it("applies an array of bases in order, so a later base turns an option back off", () => {
    expect(
      resolvedOn({
        syntaxApi: CURRENT,
        texts: {
          [LEAF]: '{ "extends": ["@tsconfig/strictest/tsconfig.json", "../../configs/loose.json"] }',
          "configs/loose.json": '{ "compilerOptions": { "noUncheckedIndexedAccess": false } }',
          ...STRICTEST_PACKAGE,
        },
      }),
    ).toEqual({
      kind: "resolved",
      effective: { ...ALL_ON, noUncheckedIndexedAccess: "off" },
      bases: [
        { file: "node_modules/@tsconfig/strictest/tsconfig.json", settings: STRICTEST_SETTINGS },
        { file: "configs/loose.json", settings: { ...UNSET, noUncheckedIndexedAccess: "off" } },
      ],
    });
  });

  it("sees an option a base turns on and a base further down the chain turns off", () => {
    expect(
      resolvedOn({
        syntaxApi: CURRENT,
        texts: {
          [LEAF]: '{ "extends": "../../configs/package.json" }',
          "configs/package.json": '{ "extends": "./shared.json", "compilerOptions": { "noImplicitOverride": false } }',
          "configs/shared.json": STRICTEST_TEXT,
        },
      }),
    ).toEqual({
      kind: "resolved",
      effective: { ...ALL_ON, noImplicitOverride: "off" },
      bases: [
        { file: "configs/package.json", settings: { ...UNSET, noImplicitOverride: "off" } },
        { file: "configs/shared.json", settings: STRICTEST_SETTINGS },
      ],
    });
  });
});

describe("typeScriptCompilerOptionsOf reading strict's defaults as the installed TypeScript does", () => {
  it.each([
    { line: "6", syntaxApi: CURRENT, defaulted: "on" },
    { line: "4.8.4", syntaxApi: FLOOR, defaulted: "off" },
  ])("resolves strict and useUnknownInCatchVariables, set nowhere, to $defaulted under TypeScript $line", ({ syntaxApi, defaulted }) => {
    expect(resolvedOn({ syntaxApi, texts: { [LEAF]: '{ "compilerOptions": { "outDir": "dist" } }' } })).toEqual({
      kind: "resolved",
      effective: {
        strict: defaulted,
        noUncheckedIndexedAccess: "off",
        exactOptionalPropertyTypes: "off",
        noImplicitOverride: "off",
        noFallthroughCasesInSwitch: "off",
        noPropertyAccessFromIndexSignature: "off",
        useUnknownInCatchVariables: defaulted,
      },
      bases: [],
    });
  });

  it("turns useUnknownInCatchVariables off with a base's strict = false", () => {
    expect(
      resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "extends": "../../tsconfig.base.json" }', "tsconfig.base.json": '{ "compilerOptions": { "strict": false } }' } }),
    ).toMatchObject({ kind: "resolved", effective: { strict: "off", useUnknownInCatchVariables: "off" } });
  });
});

const UNRESOLVABLE: readonly {
  readonly name: string;
  readonly extendsValue: string;
  readonly texts: Readonly<Record<string, string>>;
  readonly detail: string;
}[] = [
  {
    name: "a base file that is missing",
    extendsValue: '"../../missing.json"',
    texts: {},
    detail: "TS5083 Cannot read file 'missing.json'.",
  },
  {
    name: "a base package that is not installed",
    extendsValue: '"@tsconfig/absent/tsconfig.json"',
    texts: {},
    detail: "TS6053 File '@tsconfig/absent/tsconfig.json' not found.",
  },
  {
    name: "bases that extend each other",
    extendsValue: '"../../configs/one.json"',
    texts: { "configs/one.json": '{ "extends": "./two.json" }', "configs/two.json": '{ "extends": "./one.json" }' },
    detail: "TS18000 Circularity detected while resolving configuration: packages/a/tsconfig.json -> configs/one.json -> configs/two.json -> configs/one.json",
  },
  {
    name: "a configDir path in extends that TypeScript cannot find",
    extendsValue: `"\${configDir}/../../tsconfig.base.json"`,
    texts: { "tsconfig.base.json": STRICTEST_TEXT },
    detail: `TS6053 File '\${configDir}/../../tsconfig.base.json' not found.`,
  },
];

describe("typeScriptCompilerOptionsOf reporting a configuration TypeScript cannot resolve", () => {
  it.each(UNRESOLVABLE)("is unresolved, with TypeScript's diagnostic, for $name", ({ extendsValue, texts, detail }) => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: `{ "extends": ${extendsValue} }`, ...texts } })).toEqual({ kind: "unresolved", detail });
  });

  it("is unresolved for an array of bases under TypeScript 4.8.4, which takes one base only", () => {
    expect(
      resolvedOn({ syntaxApi: FLOOR, texts: { [LEAF]: '{ "extends": ["../../tsconfig.base.json"] }', "tsconfig.base.json": STRICTEST_TEXT } }),
    ).toEqual({ kind: "unresolved", detail: "TS5024 Compiler option 'extends' requires a value of type string." });
  });

  it("is resolved for a tsconfig.json whose include matches no file, since the check reads no source files", () => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "include": ["src"], "compilerOptions": { "strict": true } }' } })).toMatchObject({ kind: "resolved" });
  });
});

const VITE_ROOT = '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }';

describe("typeScriptCompilerOptionsOf telling a tsconfig.json that compiles no files", () => {
  it.each([
    { line: "6", syntaxApi: CURRENT },
    { line: "4.8.4", syntaxApi: FLOOR },
  ])("says a solution-style tsconfig.json with an empty files list and only references compiles nothing under TypeScript $line", ({ syntaxApi }) => {
    expect(resolvedOn({ syntaxApi, texts: { [LEAF]: VITE_ROOT } })).toEqual({ kind: "compiles-nothing" });
  });

  it("says a tsconfig.json compiles nothing when the empty files list comes from its base", () => {
    expect(
      resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "extends": "../../configs/solution.json" }', "configs/solution.json": '{ "files": [] }' } }),
    ).toEqual({ kind: "compiles-nothing" });
  });

  it("resolves a tsconfig.json that lists files of its own", () => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "files": ["src/index.ts"], "references": [{ "path": "../b" }] }' } })).toMatchObject({
      kind: "resolved",
    });
  });

  it("resolves a tsconfig.json with an empty files list beside an include", () => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "files": [], "include": ["src"] }' } })).toMatchObject({ kind: "resolved" });
  });
});

const COMPILE_SHAPES: readonly { readonly shape: string; readonly config: string; readonly kind: ResolvedConfig["kind"] }[] = [
  { shape: "an include naming a file under a base", config: '{ "extends": "../../tsconfig.base.json", "include": ["src/index.ts"] }', kind: "resolved" },
  { shape: "an include naming a file at the root", config: '{ "include": ["vite.config.ts"] }', kind: "resolved" },
  { shape: "an include naming the folder itself", config: '{ "include": ["."] }', kind: "resolved" },
  { shape: "a solution root extending a base", config: '{ "extends": "../../tsconfig.base.json", "files": [], "references": [{ "path": "./app" }] }', kind: "compiles-nothing" },
  { shape: "an empty files list beside an include of a folder", config: '{ "files": [], "include": ["src"] }', kind: "resolved" },
  { shape: "an empty include", config: '{ "include": [] }', kind: "compiles-nothing" },
  { shape: "an exclude of every file", config: '{ "exclude": ["**/*"] }', kind: "compiles-nothing" },
  { shape: "a files entry naming a missing file", config: '{ "files": ["src/missing.ts"] }', kind: "resolved" },
];

describe("typeScriptCompilerOptionsOf telling whether TypeScript would compile any file from a tsconfig.json", () => {
  it.each(COMPILE_SHAPES)("is $kind for $shape under TypeScript 6", ({ config, kind }) => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: config, "tsconfig.base.json": '{ "compilerOptions": { "strict": true } }' } })).toMatchObject({ kind });
  });

  it.each(COMPILE_SHAPES)("is $kind for $shape under TypeScript 4.8.4", ({ config, kind }) => {
    expect(resolvedOn({ syntaxApi: FLOOR, texts: { [LEAF]: config, "tsconfig.base.json": '{ "compilerOptions": { "strict": true } }' } })).toMatchObject({ kind });
  });
});
