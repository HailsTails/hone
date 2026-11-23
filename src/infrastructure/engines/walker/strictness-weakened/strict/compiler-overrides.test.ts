import { assert, describe, expect, it, vi } from "vitest";

import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { Edition } from "../../../../../domain/rule-set/edition-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import type { JsoncParsePort } from "../../runner/pieces/jsonc-parse.ts";
import { createDefaultJsoncParsePort } from "../../runner/pieces/jsonc-parse.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type {
  PreparedWalkerCheck,
  WalkerFile,
  WalkerRepository,
} from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import type {
  CompilerOptionsResolution,
  CompilerOptionsResolutionOf,
  OptionSettings,
  ResolvedConfig,
} from "./compiler-options-resolution.ts";
import { createCompilerOverridesCheck } from "./compiler-overrides.ts";

const EMPTY_DISK = textsDisk({ root: "/repo", texts: {} });
const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);
const defaultParsePort = loadedParsePort.value;

const FILE = repoPathOf("tsconfig.json");
const SOURCE = '{"compilerOptions":{"strict":true}}';
const SYNTAX_API = defaultParsePort.syntaxApi;
const STRICT: CheckAddressText = "strictness-weakened#strict";
const UNCHECKED: CheckAddressText = "strictness-weakened#no-unchecked-indexed-access";
const EXACT: CheckAddressText = "strictness-weakened#exact-optional-property-types";
const OVERRIDE: CheckAddressText = "strictness-weakened#no-implicit-override";
const FALLTHROUGH: CheckAddressText = "strictness-weakened#no-fallthrough-cases-in-switch";
const PROPERTY: CheckAddressText = "strictness-weakened#no-property-access-from-index-signature";
const CATCH: CheckAddressText = "strictness-weakened#use-unknown-in-catch-variables";
const STRICT_CLAUSE: CheckBinding = {
  address: STRICT,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-3",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "compiler-overrides.ts" },
};
const UNCHECKED_CLAUSE: CheckBinding = {
  address: UNCHECKED,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-3",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "compiler-overrides.ts" },
};
const EXACT_CLAUSE: CheckBinding = {
  address: EXACT,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-3",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "compiler-overrides.ts" },
};
const OVERRIDE_CLAUSE: CheckBinding = {
  address: OVERRIDE,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-3",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "compiler-overrides.ts" },
};
const FALLTHROUGH_CLAUSE: CheckBinding = {
  address: FALLTHROUGH,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-3",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "compiler-overrides.ts" },
};
const PROPERTY_CLAUSE: CheckBinding = {
  address: PROPERTY,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-3",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "compiler-overrides.ts" },
};
const CATCH_CLAUSE: CheckBinding = {
  address: CATCH,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-3",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "compiler-overrides.ts" },
};
const CLAUSES: readonly CheckBinding[] = [
  STRICT_CLAUSE,
  UNCHECKED_CLAUSE,
  EXACT_CLAUSE,
  OVERRIDE_CLAUSE,
  FALLTHROUGH_CLAUSE,
  PROPERTY_CLAUSE,
  CATCH_CLAUSE,
];

const UNRESOLVING: CompilerOptionsResolutionOf = () => ({
  resolve: vi.fn<CompilerOptionsResolution["resolve"]>(),
});

const prepareCheck = (request: {
  readonly jsonc: JsoncParsePort<unknown>;
  readonly bindings: readonly CheckBinding[];
  readonly file?: WalkerFile["file"];
  readonly resolutionOf?: CompilerOptionsResolutionOf;
}): PreparedWalkerCheck => {
  const repository: WalkerRepository = {
    files: [request.file ?? FILE],
    exists: vi.fn<WalkerRepository["exists"]>().mockReturnValue("present"),
    disk: EMPTY_DISK,
    testFiles: { suffixes: ["test", "spec"], folders: [] },
  };
  const prepared = createCompilerOverridesCheck({
    jsonc: request.jsonc,
    resolutionOf: request.resolutionOf ?? UNRESOLVING,
  }).prepare({
    bindings: request.bindings,
    repository,
    syntaxApi: SYNTAX_API,
  });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD3 existing explicit compiler overrides", () => {
  it("returns every selected explicit flag in legacy policy order with one read and parse", () => {
    const source =
      '{"compilerOptions":{"useUnknownInCatchVariables":false,"noPropertyAccessFromIndexSignature":true,"noFallthroughCasesInSwitch":false,"noImplicitOverride":true,"exactOptionalPropertyTypes":false,"noUncheckedIndexedAccess":false,"strict":true}}';
    const parse = vi.fn<JsoncParsePort<unknown>["parse"]>().mockReturnValue({
      outcome: "ok",
      value: {
        compilerOptions: {
          useUnknownInCatchVariables: false,
          noPropertyAccessFromIndexSignature: true,
          noFallthroughCasesInSwitch: false,
          noImplicitOverride: true,
          exactOptionalPropertyTypes: false,
          noUncheckedIndexedAccess: false,
          strict: true,
        },
      },
    });
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "ok", value: source });
    const prepared = prepareCheck({
      jsonc: { parse },
      bindings: [
        CATCH_CLAUSE,
        PROPERTY_CLAUSE,
        FALLTHROUGH_CLAUSE,
        OVERRIDE_CLAUSE,
        EXACT_CLAUSE,
        UNCHECKED_CLAUSE,
        STRICT_CLAUSE,
      ],
    });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: STRICT,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.strict = true",
          },
          {
            check: UNCHECKED,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.noUncheckedIndexedAccess = false",
          },
          {
            check: EXACT,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.exactOptionalPropertyTypes = false",
          },
          {
            check: OVERRIDE,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.noImplicitOverride = true",
          },
          {
            check: FALLTHROUGH,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.noFallthroughCasesInSwitch = false",
          },
          {
            check: PROPERTY,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.noPropertyAccessFromIndexSignature = true",
          },
          {
            check: CATCH,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.useUnknownInCatchVariables = false",
          },
        ],
      },
    });
    expect(readText).toHaveBeenCalledExactlyOnceWith();
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source });
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("ignores an unselected present flag and a selected absent flag without evaluating inheritance", () => {
    const parse = vi.fn<JsoncParsePort<unknown>["parse"]>().mockReturnValue({
      outcome: "ok",
      value: {
        extends: "../tsconfig.base.json",
        compilerOptions: { strict: true, useUnknownInCatchVariables: false, outDir: "dist" },
      },
    });
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({
      jsonc: { parse },
      bindings: [STRICT_CLAUSE, UNCHECKED_CLAUSE],
    });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: STRICT,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.strict = true",
          },
        ],
      },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it("retains presence-only observations for arbitrary JSON option values", () => {
    const parse = vi.fn<JsoncParsePort<unknown>["parse"]>().mockReturnValue({
      outcome: "ok",
      value: {
        compilerOptions: {
          strict: null,
          noUncheckedIndexedAccess: ["inherited"],
          exactOptionalPropertyTypes: { mode: "same" },
          noImplicitOverride: "inherited",
          noFallthroughCasesInSwitch: 0,
        },
      },
    });
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, bindings: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: STRICT,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.strict = null",
          },
          {
            check: UNCHECKED,
            anchor: { line: 1, column: 0 },
            snippet: 'compilerOptions.noUncheckedIndexedAccess = ["inherited"]',
          },
          {
            check: EXACT,
            anchor: { line: 1, column: 0 },
            snippet: 'compilerOptions.exactOptionalPropertyTypes = {"mode":"same"}',
          },
          {
            check: OVERRIDE,
            anchor: { line: 1, column: 0 },
            snippet: 'compilerOptions.noImplicitOverride = "inherited"',
          },
          {
            check: FALLTHROUGH,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.noFallthroughCasesInSwitch = 0",
          },
        ],
      },
    });
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it.each([
    { name: "missing compilerOptions", config: { extends: "../tsconfig.base.json" } },
    { name: "empty compilerOptions", config: { compilerOptions: {} } },
    {
      name: "unrelated options",
      config: { compilerOptions: { outDir: "dist", declaration: true } },
    },
  ])("completes a valid config with $name without findings", ({ config }) => {
    const parse = vi
      .fn<JsoncParsePort<unknown>["parse"]>()
      .mockReturnValue({ outcome: "ok", value: config });
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, bindings: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [] },
    });
    expect(readText).toHaveBeenCalledExactlyOnceWith();
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it("propagates an affected config read failure before parsing", () => {
    const failure = {
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "fixture read refused" },
    };
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "fixture read refused" },
    });
    const parse = vi.fn<JsoncParsePort<unknown>["parse"]>();
    const prepared = prepareCheck({ jsonc: { parse }, bindings: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual(failure);
    expect(readText).toHaveBeenCalledExactlyOnceWith();
    expect(parse).not.toHaveBeenCalled();
  });

  it("attributes a parser refusal to this config while preserving its detail", () => {
    const parse = vi.fn<JsoncParsePort<unknown>["parse"]>().mockReturnValue({
      outcome: "failed",
      error: { detail: "fixture parser refused original input" },
    });
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, bindings: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unparseable",
        file: FILE,
        detail: "fixture parser refused original input",
      },
    });
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it.each([
    { name: "null root", config: null },
    { name: "array root", config: [] },
    { name: "scalar root", config: "config" },
    { name: "null compilerOptions", config: { compilerOptions: null } },
    { name: "array compilerOptions", config: { compilerOptions: [] } },
    { name: "scalar compilerOptions", config: { compilerOptions: "strict" } },
  ])("refuses $name as an affected unparseable file", ({ config }) => {
    const parse = vi
      .fn<JsoncParsePort<unknown>["parse"]>()
      .mockReturnValue({ outcome: "ok", value: config });
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, bindings: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "failed",
      error: { kind: "file-unparseable", file: FILE, detail: expect.stringMatching(/\S/) },
    });
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it.each([
    { name: "root config", fileName: "tsconfig.json" },
    { name: "nested package config", fileName: "packages/app/tsconfig.json" },
    { name: "physical script config", fileName: "scripts/tsconfig.json" },
    { name: "nested root-only directory config", fileName: "src/vendor/tsconfig.json" },
  ])("admits $name from the supplied candidate population", ({ fileName }) => {
    const file = repoPathSchema.parse(fileName);
    const parse = vi
      .fn<JsoncParsePort<unknown>["parse"]>()
      .mockReturnValue({ outcome: "ok", value: {} });
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, bindings: CLAUSES, file });

    expect(prepared.prepareFile({ file, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [] },
    });
    expect(readText).toHaveBeenCalledExactlyOnceWith();
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it.each([
    { name: "different basename", fileName: "tsconfig.base.json" },
    { name: "different basename case", fileName: "packages/app/TSConfig.json" },
    { name: "non-config union candidate", fileName: "src/example.ts" },
    { name: "all-depth excluded directory", fileName: "src/node_modules/tsconfig.json" },
    { name: "root-only excluded directory", fileName: "vendor/tsconfig.json" },
  ])("excludes $name without reading or parsing", ({ fileName }) => {
    const file = repoPathSchema.parse(fileName);
    const parse = vi.fn<JsoncParsePort<unknown>["parse"]>();
    const readText = vi.fn<WalkerFile["readText"]>();
    const prepared = prepareCheck({ jsonc: { parse }, bindings: CLAUSES, file });

    expect(prepared.prepareFile({ file, readText })).toEqual({
      outcome: "ok",
      value: { kind: "skipped" },
    });
    expect(readText).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });
});

const SECOND_EDITION: Edition = editionOf("2");

const JSONC = createDefaultJsoncParsePort({ trailingCommas: "refused" });

const SECOND_EDITION_CLAUSES: readonly CheckBinding[] = [
  { ...STRICT_CLAUSE, edition: SECOND_EDITION },
  { ...UNCHECKED_CLAUSE, edition: SECOND_EDITION },
  { ...EXACT_CLAUSE, edition: SECOND_EDITION },
  { ...OVERRIDE_CLAUSE, edition: SECOND_EDITION },
  { ...FALLTHROUGH_CLAUSE, edition: SECOND_EDITION },
  { ...PROPERTY_CLAUSE, edition: SECOND_EDITION },
  { ...CATCH_CLAUSE, edition: SECOND_EDITION },
];

const EITHER_EDITION = [
  { edition: editionOf("1"), bindings: CLAUSES },
  { edition: SECOND_EDITION, bindings: SECOND_EDITION_CLAUSES },
];

const UNSET: OptionSettings = {
  strict: "unset",
  noUncheckedIndexedAccess: "unset",
  exactOptionalPropertyTypes: "unset",
  noImplicitOverride: "unset",
  noFallthroughCasesInSwitch: "unset",
  noPropertyAccessFromIndexSignature: "unset",
  useUnknownInCatchVariables: "unset",
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

const ALL_OFF = {
  strict: "off",
  noUncheckedIndexedAccess: "off",
  exactOptionalPropertyTypes: "off",
  noImplicitOverride: "off",
  noFallthroughCasesInSwitch: "off",
  noPropertyAccessFromIndexSignature: "off",
  useUnknownInCatchVariables: "off",
} as const;

const resolvingTo = (request: { readonly resolved: ResolvedConfig }) => {
  const resolve = vi.fn<CompilerOptionsResolution["resolve"]>().mockReturnValue(request.resolved);
  const resolutionOf = vi.fn<CompilerOptionsResolutionOf>().mockReturnValue({ resolve });
  return { resolve, resolutionOf };
};

const fileWith = (request: { readonly source: string }): WalkerFile => ({
  file: FILE,
  readText: () => ({ outcome: "ok", value: request.source }),
});

const EXTENDING_SOURCE =
  '{ "extends": "./tsconfig.base.json", "compilerOptions": { "outDir": "dist" } }';

const EVERY_OPTION_SOURCE =
  '{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": false, "exactOptionalPropertyTypes": true, "noImplicitOverride": true, "noFallthroughCasesInSwitch": true, "noPropertyAccessFromIndexSignature": true, "useUnknownInCatchVariables": true } }';

describe("CD3 in either edition", () => {
  it.each(EITHER_EDITION)(
    "flags each selected option a tsconfig.json sets itself under edition $edition",
    ({ bindings }) => {
      const { resolve, resolutionOf } = resolvingTo({
        resolved: { kind: "resolved", effective: ALL_ON, bases: [] },
      });
      const prepared = prepareCheck({ jsonc: JSONC, bindings, resolutionOf });

      expect(prepared.prepareFile(fileWith({ source: EVERY_OPTION_SOURCE }))).toEqual({
        outcome: "ok",
        value: {
          kind: "complete",
          hits: [
            {
              check: STRICT,
              anchor: { line: 1, column: 0 },
              snippet: "compilerOptions.strict = true",
            },
            {
              check: UNCHECKED,
              anchor: { line: 1, column: 0 },
              snippet: "compilerOptions.noUncheckedIndexedAccess = false",
            },
            {
              check: EXACT,
              anchor: { line: 1, column: 0 },
              snippet: "compilerOptions.exactOptionalPropertyTypes = true",
            },
            {
              check: OVERRIDE,
              anchor: { line: 1, column: 0 },
              snippet: "compilerOptions.noImplicitOverride = true",
            },
            {
              check: FALLTHROUGH,
              anchor: { line: 1, column: 0 },
              snippet: "compilerOptions.noFallthroughCasesInSwitch = true",
            },
            {
              check: PROPERTY,
              anchor: { line: 1, column: 0 },
              snippet: "compilerOptions.noPropertyAccessFromIndexSignature = true",
            },
            {
              check: CATCH,
              anchor: { line: 1, column: 0 },
              snippet: "compilerOptions.useUnknownInCatchVariables = true",
            },
          ],
        },
      });
      expect(resolve).not.toHaveBeenCalled();
    },
  );

  it.each(EITHER_EDITION)(
    "skips a config not named tsconfig.json without resolving it under edition $edition",
    ({ bindings }) => {
      const { resolutionOf, resolve } = resolvingTo({
        resolved: { kind: "resolved", effective: ALL_OFF, bases: [] },
      });
      const file = repoPathOf("tsconfig.base.json");
      const prepared = prepareCheck({ jsonc: JSONC, bindings, file, resolutionOf });

      expect(
        prepared.prepareFile({ file, readText: () => ({ outcome: "ok", value: "{}" }) }),
      ).toEqual({ outcome: "ok", value: { kind: "skipped" } });
      expect(resolve).not.toHaveBeenCalled();
    },
  );
});

describe("CD3 edition 1", () => {
  it("leaves an option a tsconfig.json inherits unjudged, whatever the base turns off", () => {
    const { resolve, resolutionOf } = resolvingTo({
      resolved: {
        kind: "resolved",
        effective: ALL_OFF,
        bases: [{ file: "tsconfig.base.json", settings: ALL_OFF }],
      },
    });
    const prepared = prepareCheck({ jsonc: JSONC, bindings: CLAUSES, resolutionOf });

    expect(prepared.prepareFile(fileWith({ source: EXTENDING_SOURCE }))).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [] },
    });
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("CD3 edition 2 judging the options a tsconfig.json resolves to", () => {
  it("passes a tsconfig.json whose resolved configuration turns every selected option on", () => {
    const { resolutionOf } = resolvingTo({
      resolved: {
        kind: "resolved",
        effective: ALL_ON,
        bases: [{ file: "tsconfig.base.json", settings: ALL_ON }],
      },
    });
    const prepared = prepareCheck({ jsonc: JSONC, bindings: SECOND_EDITION_CLAUSES, resolutionOf });

    expect(prepared.prepareFile(fileWith({ source: EXTENDING_SOURCE }))).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [] },
    });
  });

  it("resolves the walked tsconfig.json once over the piece's syntax API and disk, however many bindings it judges", () => {
    const { resolve, resolutionOf } = resolvingTo({
      resolved: { kind: "resolved", effective: ALL_ON, bases: [] },
    });
    const prepared = prepareCheck({ jsonc: JSONC, bindings: SECOND_EDITION_CLAUSES, resolutionOf });

    prepared.prepareFile(fileWith({ source: EXTENDING_SOURCE }));

    expect(resolutionOf).toHaveBeenCalledExactlyOnceWith({
      syntaxApi: SYNTAX_API,
      disk: EMPTY_DISK,
    });
    expect(resolve).toHaveBeenCalledExactlyOnceWith({ file: FILE });
  });

  it("names the bases that turn an inherited option off", () => {
    const { resolutionOf } = resolvingTo({
      resolved: {
        kind: "resolved",
        effective: { ...ALL_ON, noUncheckedIndexedAccess: "off" },
        bases: [
          { file: "tsconfig.base.json", settings: { ...UNSET, noUncheckedIndexedAccess: "on" } },
          { file: "configs/loose.json", settings: { ...UNSET, noUncheckedIndexedAccess: "off" } },
        ],
      },
    });
    const prepared = prepareCheck({
      jsonc: JSONC,
      bindings: [{ ...UNCHECKED_CLAUSE, edition: SECOND_EDITION }],
      resolutionOf,
    });

    expect(prepared.prepareFile(fileWith({ source: EXTENDING_SOURCE }))).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: UNCHECKED,
            anchor: { line: 1, column: 0 },
            snippet:
              "compilerOptions.noUncheckedIndexedAccess = false, inherited from configs/loose.json",
          },
        ],
      },
    });
  });

  it("names this file and every base an option is unset in when nothing turns it on", () => {
    const { resolutionOf } = resolvingTo({
      resolved: {
        kind: "resolved",
        effective: { ...ALL_ON, exactOptionalPropertyTypes: "off" },
        bases: [
          { file: "tsconfig.base.json", settings: { ...UNSET, strict: "on" } },
          { file: "node_modules/@tsconfig/node20/tsconfig.json", settings: UNSET },
        ],
      },
    });
    const prepared = prepareCheck({
      jsonc: JSONC,
      bindings: [{ ...EXACT_CLAUSE, edition: SECOND_EDITION }],
      resolutionOf,
    });

    expect(prepared.prepareFile(fileWith({ source: EXTENDING_SOURCE }))).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: EXACT,
            anchor: { line: 1, column: 0 },
            snippet:
              "compilerOptions.exactOptionalPropertyTypes unset here and in tsconfig.base.json, node_modules/@tsconfig/node20/tsconfig.json",
          },
        ],
      },
    });
  });
});

describe("CD3 edition 2 naming where an option is left unset or turned off", () => {
  it("says a tsconfig.json that leaves an option unset extends no base", () => {
    const { resolutionOf } = resolvingTo({
      resolved: {
        kind: "resolved",
        effective: { ...ALL_ON, noImplicitOverride: "off" },
        bases: [],
      },
    });
    const prepared = prepareCheck({
      jsonc: JSONC,
      bindings: [{ ...OVERRIDE_CLAUSE, edition: SECOND_EDITION }],
      resolutionOf,
    });

    expect(
      prepared.prepareFile(fileWith({ source: '{ "compilerOptions": { "outDir": "dist" } }' })),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: OVERRIDE,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.noImplicitOverride unset, and this file extends no base",
          },
        ],
      },
    });
  });

  it("names the base whose strict = false turns useUnknownInCatchVariables off", () => {
    const { resolutionOf } = resolvingTo({
      resolved: {
        kind: "resolved",
        effective: { ...ALL_ON, strict: "off", useUnknownInCatchVariables: "off" },
        bases: [{ file: "tsconfig.base.json", settings: { ...UNSET, strict: "off" } }],
      },
    });
    const prepared = prepareCheck({
      jsonc: JSONC,
      bindings: [{ ...CATCH_CLAUSE, edition: SECOND_EDITION }],
      resolutionOf,
    });

    expect(prepared.prepareFile(fileWith({ source: EXTENDING_SOURCE }))).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: CATCH,
            anchor: { line: 1, column: 0 },
            snippet:
              "compilerOptions.useUnknownInCatchVariables = false, inherited from tsconfig.base.json",
          },
        ],
      },
    });
  });

  it("names this file when its own strict = false turns useUnknownInCatchVariables off", () => {
    const { resolutionOf } = resolvingTo({
      resolved: {
        kind: "resolved",
        effective: { ...ALL_ON, strict: "off", useUnknownInCatchVariables: "off" },
        bases: [{ file: "tsconfig.base.json", settings: ALL_ON }],
      },
    });
    const prepared = prepareCheck({
      jsonc: JSONC,
      bindings: [
        { ...STRICT_CLAUSE, edition: SECOND_EDITION },
        { ...CATCH_CLAUSE, edition: SECOND_EDITION },
      ],
      resolutionOf,
    });

    expect(
      prepared.prepareFile(
        fileWith({
          source: '{ "extends": "./tsconfig.base.json", "compilerOptions": { "strict": false } }',
        }),
      ),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: STRICT,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.strict = false",
          },
          {
            check: CATCH,
            anchor: { line: 1, column: 0 },
            snippet:
              "compilerOptions.useUnknownInCatchVariables = false, turned off in tsconfig.json",
          },
        ],
      },
    });
  });

  it("reports each option a tsconfig.json leaves out as unknown when its configuration cannot be resolved", () => {
    const { resolutionOf } = resolvingTo({
      resolved: { kind: "unresolved", detail: "TS5083 Cannot read file 'missing.json'." },
    });
    const prepared = prepareCheck({
      jsonc: JSONC,
      bindings: [
        { ...STRICT_CLAUSE, edition: SECOND_EDITION },
        { ...UNCHECKED_CLAUSE, edition: SECOND_EDITION },
      ],
      resolutionOf,
    });

    expect(
      prepared.prepareFile(
        fileWith({
          source: '{ "extends": "./missing.json", "compilerOptions": { "strict": true } }',
        }),
      ),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: STRICT,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.strict = true",
          },
          {
            check: UNCHECKED,
            anchor: { line: 1, column: 0 },
            snippet:
              "compilerOptions.noUncheckedIndexedAccess unknown: TS5083 Cannot read file 'missing.json'.",
          },
        ],
      },
    });
  });

  it("judges only the bindings selected under edition 2 when the editions differ", () => {
    const { resolutionOf } = resolvingTo({
      resolved: { kind: "resolved", effective: ALL_OFF, bases: [] },
    });
    const prepared = prepareCheck({
      jsonc: JSONC,
      bindings: [STRICT_CLAUSE, { ...UNCHECKED_CLAUSE, edition: SECOND_EDITION }],
      resolutionOf,
    });

    expect(prepared.prepareFile(fileWith({ source: '{ "compilerOptions": {} }' }))).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: UNCHECKED,
            anchor: { line: 1, column: 0 },
            snippet:
              "compilerOptions.noUncheckedIndexedAccess unset, and this file extends no base",
          },
        ],
      },
    });
  });
});

describe("CD3 edition 2 over a tsconfig.json that compiles no files", () => {
  it("leaves the options of a solution-style tsconfig.json unjudged, since they apply to no file", () => {
    const { resolutionOf } = resolvingTo({ resolved: { kind: "compiles-nothing" } });
    const prepared = prepareCheck({ jsonc: JSONC, bindings: SECOND_EDITION_CLAUSES, resolutionOf });

    expect(
      prepared.prepareFile(
        fileWith({ source: '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }' }),
      ),
    ).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [] },
    });
  });

  it("still flags an option such a tsconfig.json sets itself, as edition 1 does", () => {
    const { resolutionOf } = resolvingTo({ resolved: { kind: "compiles-nothing" } });
    const prepared = prepareCheck({ jsonc: JSONC, bindings: SECOND_EDITION_CLAUSES, resolutionOf });

    expect(
      prepared.prepareFile(
        fileWith({ source: '{ "files": [], "compilerOptions": { "strict": false } }' }),
      ),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: STRICT,
            anchor: { line: 1, column: 0 },
            snippet: "compilerOptions.strict = false",
          },
        ],
      },
    });
  });
});
