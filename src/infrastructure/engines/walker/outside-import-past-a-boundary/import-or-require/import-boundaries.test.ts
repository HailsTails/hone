import { assert, describe, expect, it, type Mock, vi } from "vitest";

import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type {
  CheckSettingValues,
  CheckBinding,
} from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type {
  PreparedWalkerCheck,
  SourceObservers,
  WalkerFile,
} from "../../runner/pieces/walker-piece.ts";
import type { SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./import-boundaries.ts";

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

const FILE = repoPathOf("src/import-source.ts");
const ADDRESS: CheckAddressText = "outside-import-past-a-boundary#import-or-require";
const SYNTAX_API = defaultParsePort.syntaxApi;
const FROM = "fr" + "om";
const IMPORT = "im" + "port";
const REQUIRE = "req" + "uire";
const LINE_COMMENT = "/" + "/";
const TEMPLATE_SUBSTITUTION = "$" + "{name}";
const CONFIGURED_PACKAGES: readonly string[] = [
  "eslint",
  "winston",
  "winston-transport",
  "better-sqlite3",
  "pino",
  "hono",
  "@hono/node-server",
  "jose",
  "@modelcontextprotocol/sdk",
  "zod-to-json-schema",
  "uuid",
];

const CLAUSE_WITH_NO_SETTINGS: CheckBinding = {
  address: ADDRESS,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-19",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "import-boundaries.ts" },
};
const clauseWith = (request: { readonly checkSettings: CheckSettingValues }): CheckBinding => ({
  ...CLAUSE_WITH_NO_SETTINGS,
  checkSettings: request.checkSettings,
});
const CLAUSE = clauseWith({ checkSettings: { confinedOutsideDependencies: CONFIGURED_PACKAGES } });
const NEUTRAL_CLAUSE = clauseWith({ checkSettings: { confinedOutsideDependencies: [] } });

const bannedHit = (request: { readonly line: number; readonly specifier: string }) => ({
  check: ADDRESS,
  anchor: { line: request.line, column: 0 },
  snippet: `banned third-party import: ${request.specifier} — use its recorded wrapping boundary`,
  importSpecifier: request.specifier,
});

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly enter: NonNullable<SourceObservers["enter"]>;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly readText: Mock<WalkerFile["readText"]>;
  readonly finish: PreparedWalkerCheck["finish"];
};

const preparedFor = (request: {
  readonly file: WalkerFile["file"];
  readonly clause: CheckBinding;
}): PreparedWalkerCheck => {
  const prepared = check.prepare({
    bindings: [request.clause],
    repository: {
      files: [request.file],
      exists: vi.fn().mockReturnValue("present"),
      disk: EMPTY_DISK,
    },
    syntaxApi: SYNTAX_API,
  });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

const sourceObservations = (request: {
  readonly source: string;
  readonly clause: CheckBinding;
}): ObservationFixture => {
  const prepared = preparedFor({ file: FILE, clause: request.clause });
  const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "file-unreadable", file: FILE, detail: "piece must use supplied source" },
  });
  const file = prepared.prepareFile({ file: FILE, readText });
  assert(file.outcome === "ok");
  assert(file.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(
    FILE,
    request.source,
    SYNTAX_API.ScriptTarget.Latest,
    true,
  );
  const anchorAt = vi
    .fn<(request: { readonly position: number }) => Anchor>()
    .mockReturnValue({ line: 1, column: 0 });
  const observers = file.value.begin({ sourceFile: tree, anchorAt });
  const { enter } = observers;
  assert.isDefined(enter);
  return { tree, observers, enter, anchorAt, readText, finish: prepared.finish };
};

describe("CD-19 existing third-party and redirected stdlib import observations", () => {
  it("preserves raw type-only and comment matches, per-line policy order, deduplication and known text gaps", () => {
    const observed = sourceObservations({
      clause: CLAUSE,
      source: `${IMPORT} type { Rule } ${FROM} "eslint";\r\nconst literal = " ${FROM} 'hono' ${FROM} 'winston' ${FROM} 'winston' ";\r\n${LINE_COMMENT} ${FROM} "uuid"\r\n${IMPORT} client ${FROM} "hono/client";\r\n${IMPORT} "winston"; ${REQUIRE}("winston"); ${IMPORT}("winston");\r\n${IMPORT} shape ${FROM}\r\n"pino";\r\n`,
    });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "banned third-party import: eslint — use its recorded wrapping boundary",
        importSpecifier: "eslint",
      },
      {
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet: "banned third-party import: winston — use its recorded wrapping boundary",
        importSpecifier: "winston",
      },
      {
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet: "banned third-party import: hono — use its recorded wrapping boundary",
        importSpecifier: "hono",
      },
      {
        check: ADDRESS,
        anchor: { line: 3, column: 0 },
        snippet: "banned third-party import: uuid — use its recorded wrapping boundary",
        importSpecifier: "uuid",
      },
      {
        check: ADDRESS,
        anchor: { line: 4, column: 0 },
        snippet: "banned third-party import: hono/client — use its recorded wrapping boundary",
        importSpecifier: "hono/client",
      },
    ]);
    expect(observed.readText).not.toHaveBeenCalled();
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "CRLF line endings",
      source: `${IMPORT} a ${FROM} "eslint";\r\n${IMPORT} b ${FROM} "uuid";\r\n`,
      hits: [
        bannedHit({ line: 1, specifier: "eslint" }),
        bannedHit({ line: 2, specifier: "uuid" }),
      ],
    },
    {
      name: "a specifier on the line after from",
      source: `${IMPORT} x ${FROM}\n"uuid";\n`,
      hits: [],
    },
    {
      name: "a CRLF specifier on the line after from",
      source: `${IMPORT} x\r\n${FROM}\r\n"uuid";\r\n`,
      hits: [],
    },
    {
      name: "a comment and a string",
      source: `${LINE_COMMENT} ${FROM} "pino"\nconst text = "${FROM} 'pino'";\n`,
      hits: [bannedHit({ line: 1, specifier: "pino" }), bannedHit({ line: 2, specifier: "pino" })],
    },
    {
      name: "tab and mixed whitespace separators",
      source: `${IMPORT} x ${FROM}\t"jose";\n${IMPORT} y ${FROM}  \t 'jose';\n`,
      hits: [bannedHit({ line: 1, specifier: "jose" }), bannedHit({ line: 2, specifier: "jose" })],
    },
    {
      name: "hono beside its subpaths",
      source: `${IMPORT} a ${FROM} "hono";\n${IMPORT} b ${FROM} "hono/cors";\n${IMPORT} c ${FROM} "hono/cookie";\n`,
      hits: [
        bannedHit({ line: 1, specifier: "hono" }),
        bannedHit({ line: 2, specifier: "hono/cors" }),
        bannedHit({ line: 3, specifier: "hono/cookie" }),
      ],
    },
    {
      name: "a final line with no trailing newline",
      source: `${IMPORT} a ${FROM} "winston"`,
      hits: [bannedHit({ line: 1, specifier: "winston" })],
    },
    {
      name: "specifiers that share a prefix or contain regex metacharacters",
      source: `${IMPORT} a ${FROM} "winston-transport";\n${IMPORT} b ${FROM} "@hono/node-server";\n${IMPORT} c ${FROM} "@modelcontextprotocol/sdk";\n`,
      hits: [
        bannedHit({ line: 1, specifier: "winston-transport" }),
        bannedHit({ line: 2, specifier: "@hono/node-server" }),
        bannedHit({ line: 3, specifier: "@modelcontextprotocol/sdk" }),
      ],
    },
    {
      name: "lookalike specifiers",
      source: `${IMPORT} a ${FROM} "honoXcors";\n${IMPORT} b ${FROM} "hono.cors";\n`,
      hits: [],
    },
    { name: "no banned import", source: `const nothing = 1;\n`, hits: [] },
    { name: "an empty file", source: "", hits: [] },
  ])(
    "finds the same per-line banned third-party imports as a scan of every line for $name",
    ({ source, hits }) => {
      expect(sourceObservations({ clause: CLAUSE, source }).observers.finish()).toEqual(hits);
    },
  );

  it.each([
    { specifier: "eslint" },
    { specifier: "winston" },
    { specifier: "winston-transport" },
    { specifier: "better-sqlite3" },
    { specifier: "pino" },
    { specifier: "hono" },
    { specifier: "@hono/node-server" },
    { specifier: "hono/cors" },
    { specifier: "hono/cookie" },
    { specifier: "hono/types" },
    { specifier: "hono/utils/http-status" },
    { specifier: "jose" },
    { specifier: "@modelcontextprotocol/sdk" },
    { specifier: "zod-to-json-schema" },
    { specifier: "uuid" },
  ])("flags $specifier imported alone in a file", ({ specifier }) => {
    const source = `${IMPORT} a ${FROM} "${specifier}";\n`;

    expect(sourceObservations({ clause: CLAUSE, source }).observers.finish()).toEqual([
      bannedHit({ line: 1, specifier }),
    ]);
  });

  it("returns every raw hit before earlier and later observed stdlib imports under the CD19 clause", () => {
    const observed = sourceObservations({
      clause: CLAUSE,
      source: `import fs ${FROM} "node:fs";\r\nimport logger ${FROM} "winston";\r\nexport * ${FROM} "node:path";\r\n`,
    });
    const imported = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const exported = observed.tree.getChildAt(0, observed.tree).getChildAt(2, observed.tree);
    observed.anchorAt
      .mockReturnValueOnce({ line: 1, column: 15 })
      .mockReturnValueOnce({ line: 3, column: 14 });

    observed.enter({ node: imported });
    observed.enter({ node: exported });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet: "banned third-party import: winston — use its recorded wrapping boundary",
        importSpecifier: "winston",
      },
      {
        check: ADDRESS,
        anchor: { line: 1, column: 15 },
        snippet:
          "bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: node:fs",
        importSpecifier: "node:fs",
      },
      {
        check: ADDRESS,
        anchor: { line: 3, column: 14 },
        snippet:
          "bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: node:path",
        importSpecifier: "node:path",
      },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 15 }], [{ position: 72 }]]);
    expect(observed.readText).not.toHaveBeenCalled();
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains import-type, external import-equals, dynamic import and literal require observations in supplied order", () => {
    const observed = sourceObservations({
      clause: CLAUSE,
      source: `type Stats = ${IMPORT}("node:fs").Stats;\n${IMPORT} path = ${REQUIRE}("node:path");\n${IMPORT}("node:url");\n${REQUIRE}("node:crypto");\n`,
    });
    const importType = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(3, observed.tree);
    const importEquals = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree);
    const dynamicImport = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(2, observed.tree)
      .getChildAt(0, observed.tree);
    const required = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(3, observed.tree)
      .getChildAt(0, observed.tree);
    observed.anchorAt
      .mockReturnValueOnce({ line: 1, column: 20 })
      .mockReturnValueOnce({ line: 2, column: 22 })
      .mockReturnValueOnce({ line: 3, column: 7 })
      .mockReturnValueOnce({ line: 4, column: 8 });

    observed.enter({ node: importType });
    observed.enter({ node: importEquals });
    observed.enter({ node: dynamicImport });
    observed.enter({ node: required });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 20 },
        snippet:
          "bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: node:fs",
        importSpecifier: "node:fs",
      },
      {
        check: ADDRESS,
        anchor: { line: 2, column: 22 },
        snippet:
          "bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: node:path",
        importSpecifier: "node:path",
      },
      {
        check: ADDRESS,
        anchor: { line: 3, column: 7 },
        snippet:
          "bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: node:url",
        importSpecifier: "node:url",
      },
      {
        check: ADDRESS,
        anchor: { line: 4, column: 8 },
        snippet:
          "bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: node:crypto",
        importSpecifier: "node:crypto",
      },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([
      [{ position: 20 }],
      [{ position: 60 }],
      [{ position: 81 }],
      [{ position: 102 }],
    ]);
  });

  it("preserves shadowed require and first-argument quirks while excluding property calls, computed strings and unprefixed modules", () => {
    const observed = sourceObservations({
      clause: CLAUSE,
      source: `const ${REQUIRE} = loader;\n${REQUIRE}("node:fs", "ignored");\nloader.${REQUIRE}("node:path");\n${REQUIRE}(name);\n${REQUIRE}("fs");\n${IMPORT}(\`node:${TEMPLATE_SUBSTITUTION}\`);\n`,
    });
    const shadowedRequire = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(1, observed.tree)
      .getChildAt(0, observed.tree);
    const propertyRequire = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(2, observed.tree)
      .getChildAt(0, observed.tree);
    const computedRequire = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(3, observed.tree)
      .getChildAt(0, observed.tree);
    const unprefixedRequire = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(4, observed.tree)
      .getChildAt(0, observed.tree);
    const templateImport = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(5, observed.tree)
      .getChildAt(0, observed.tree);
    observed.anchorAt.mockReturnValue({ line: 2, column: 8 });

    observed.enter({ node: shadowedRequire });
    observed.enter({ node: propertyRequire });
    observed.enter({ node: computedRequire });
    observed.enter({ node: unprefixedRequire });
    observed.enter({ node: templateImport });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 2, column: 8 },
        snippet:
          "bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: node:fs",
        importSpecifier: "node:fs",
      },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 32 });
  });

  it.each([
    { name: "all-depth exclusion", fileName: "src/node_modules/imports.ts", kind: "skipped" },
    { name: "root-only exclusion", fileName: "vendor/imports.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/imports.ts", kind: "syntax" },
    { name: "TSX source", fileName: "src/Imports.tsx", kind: "syntax" },
    { name: "test source", fileName: "src/imports.test.ts", kind: "syntax" },
    { name: "declaration source", fileName: "src/imports.d.ts", kind: "syntax" },
    { name: "physical script retained", fileName: "scripts/imports.ts", kind: "syntax" },
    { name: "non-TypeScript union candidate", fileName: "src/imports.js", kind: "skipped" },
  ])("preserves its own source population without reading for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "file-unreadable", file, detail: "unexpected piece read" },
    });

    expect(preparedFor({ file, clause: CLAUSE }).prepareFile({ file, readText })).toMatchObject({
      outcome: "ok",
      value: { kind },
    });
    expect(readText).not.toHaveBeenCalled();
  });
});

describe("CD-19 confined packages come from the clause settings", () => {
  it("confines no third-party package by default while still flagging node: imports", () => {
    const observed = sourceObservations({
      clause: NEUTRAL_CLAUSE,
      source: `${IMPORT} a ${FROM} "eslint";\n${IMPORT} b ${FROM} "winston";\n${IMPORT} fs ${FROM} "node:fs";\n`,
    });
    const nodeImport = observed.tree.getChildAt(0, observed.tree).getChildAt(2, observed.tree);
    observed.anchorAt.mockReturnValueOnce({ line: 3, column: 15 });

    observed.enter({ node: nodeImport });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 3, column: 15 },
        snippet:
          "bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: node:fs",
        importSpecifier: "node:fs",
      },
    ]);
  });

  it("flags only the packages a repository confines", () => {
    const observed = sourceObservations({
      clause: clauseWith({ checkSettings: { confinedOutsideDependencies: ["@acme/payments"] } }),
      source: `${IMPORT} a ${FROM} "@acme/payments";\n${IMPORT} b ${FROM} "winston";\n`,
    });

    expect(observed.observers.finish()).toEqual([
      bannedHit({ line: 1, specifier: "@acme/payments" }),
    ]);
  });
});

describe("CD-19 names, as data on each hit, the import that raised it", () => {
  it("gives a confined package's specifier exactly as the source wrote it, subpath and scope included", () => {
    const observed = sourceObservations({
      clause: clauseWith({
        checkSettings: { confinedOutsideDependencies: ["lodash", "@scope/pkg"] },
      }),
      source: `${IMPORT} fp ${FROM} "lodash/fp";\n${IMPORT} sub ${FROM} '@scope/pkg/sub';\n`,
    });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "banned third-party import: lodash/fp — use its recorded wrapping boundary",
        importSpecifier: "lodash/fp",
      },
      {
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet: "banned third-party import: @scope/pkg/sub — use its recorded wrapping boundary",
        importSpecifier: "@scope/pkg/sub",
      },
    ]);
  });
});

describe("CD-19 package matching", () => {
  it.each([
    { name: "the package itself", packageName: "hono", specifier: "hono" },
    { name: "a subpath of the package", packageName: "hono", specifier: "hono/cors" },
    {
      name: "a nested subpath of the package",
      packageName: "hono",
      specifier: "hono/utils/http-status",
    },
    { name: "a scoped package", packageName: "@acme/payments", specifier: "@acme/payments" },
    {
      name: "a subpath of a scoped package",
      packageName: "@acme/payments",
      specifier: "@acme/payments/client",
    },
  ])("flags $name, reporting the imported specifier", ({ packageName, specifier }) => {
    const observed = sourceObservations({
      clause: clauseWith({ checkSettings: { confinedOutsideDependencies: [packageName] } }),
      source: `${IMPORT} a ${FROM} "${specifier}";\n`,
    });

    expect(observed.observers.finish()).toEqual([bannedHit({ line: 1, specifier })]);
  });

  it.each([
    {
      name: "a package whose name extends the confined one",
      packageName: "hono",
      specifier: "honox",
    },
    { name: "a package joined by a hyphen", packageName: "hono", specifier: "hono-extra/cors" },
    {
      name: "a scope whose name extends the confined scope",
      packageName: "@acme/payments",
      specifier: "@acmex/payments",
    },
    {
      name: "a scoped package whose name extends the confined one",
      packageName: "@acme/payments",
      specifier: "@acme/payments-client",
    },
    {
      name: "another package in the same scope",
      packageName: "@acme/payments",
      specifier: "@acme/ledger",
    },
    { name: "the scope alone", packageName: "@acme/payments", specifier: "@acme" },
  ])("does not flag $name", ({ packageName, specifier }) => {
    const observed = sourceObservations({
      clause: clauseWith({ checkSettings: { confinedOutsideDependencies: [packageName] } }),
      source: `${IMPORT} a ${FROM} "${specifier}";\n`,
    });

    expect(observed.observers.finish()).toEqual([]);
  });
});

describe("CD-19 confined package settings", () => {
  it("matches a confined package holding regular expression characters literally", () => {
    const observed = sourceObservations({
      clause: clauseWith({ checkSettings: { confinedOutsideDependencies: ["lib(x)+"] } }),
      source: `${IMPORT} a ${FROM} "lib(x)+";\n${IMPORT} b ${FROM} "libxx";\n`,
    });

    expect(observed.observers.finish()).toEqual([bannedHit({ line: 1, specifier: "lib(x)+" })]);
  });

  it.each<{ readonly name: string; readonly clause: CheckBinding }>([
    { name: "no confined list", clause: CLAUSE_WITH_NO_SETTINGS },
    {
      name: "a package list that is not an array",
      clause: clauseWith({ checkSettings: { confinedOutsideDependencies: "eslint" } }),
    },
    {
      name: "an empty package name",
      clause: clauseWith({ checkSettings: { confinedOutsideDependencies: [""] } }),
    },
    {
      name: "an unknown setting",
      clause: clauseWith({
        checkSettings: { confinedOutsideDependencies: [], confinedSpecifiers: ["eslint"] },
      }),
    },
  ])("refuses to prepare with $name, naming the clause", ({ clause }) => {
    const prepared = check.prepare({
      bindings: [clause],
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
      syntaxApi: SYNTAX_API,
    });

    expect(prepared).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: "/install/mechanisms/audit/CD-19",
        detail: expect.stringContaining(
          "the checkSettings of outside-import-past-a-boundary#import-or-require are malformed",
        ),
      },
    });
  });
});
