import { assert, describe, expect, it } from "vitest";

import type { Diagnostic } from "../toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { TYPE_DIRECTIVES, type TypeDirective, typeDirectiveReaderFor } from "./type-directives.ts";

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
const SYNTAX_API = loadedParsePort.value.syntaxApi;
const TYPE_EXPECTATION = "@ts-expect-" + "error";
const TYPE_IGNORE = "@ts-" + "ignore";
const TYPE_NOCHECK = "@ts-" + "nocheck";
const COMPILED_FILE = "/virtual/directive.ts";
const COMPILED_JSX_FILE = "/virtual/directive.tsx";
const TYPE_ERROR_LINE = 'export const broken: number = "text";';
const JSX_DECLARATIONS =
  "declare global { namespace JSX { interface IntrinsicElements { div: {} } interface Element {} } }\nconst n = { bar: 1 };\n";

const compiledDiagnostics = (request: {
  readonly source: string;
  readonly file?: string;
}): readonly Diagnostic[] => {
  const file = request.file ?? COMPILED_FILE;
  const sourceFile = SYNTAX_API.createSourceFile(
    file,
    request.source,
    SYNTAX_API.ScriptTarget.Latest,
    true,
  );
  const program = SYNTAX_API.createProgram({
    rootNames: [file],
    options: {
      noEmit: true,
      strict: true,
      noLib: true,
      types: [],
      jsx: SYNTAX_API.JsxEmit.Preserve,
    },
    host: {
      getSourceFile: () => sourceFile,
      getDefaultLibFileName: () => "lib.d.ts",
      writeFile: () => undefined,
      getCurrentDirectory: () => "/",
      getCanonicalFileName: (fileName) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      fileExists: () => true,
      readFile: () => request.source,
    },
  });
  return program.getSemanticDiagnostics(sourceFile);
};

const directiveAt = (request: {
  readonly source: string;
  readonly commentAt: number;
  readonly file?: string;
}): TypeDirective | undefined => {
  const sourceFile = SYNTAX_API.createSourceFile(
    request.file ?? "src/directive.ts",
    request.source,
    SYNTAX_API.ScriptTarget.Latest,
    true,
  );
  const [range] = SYNTAX_API.getLeadingCommentRanges(request.source, request.commentAt) ?? [];
  assert(range !== undefined);
  return typeDirectiveReaderFor({ sourceFile, syntaxApi: SYNTAX_API })({ range })?.directive;
};

describe("typeDirectiveReaderFor, read as the installed TypeScript honours each directive", () => {
  it.each<{
    readonly name: string;
    readonly directive: string;
    readonly before?: string;
    readonly commentAt?: number;
    readonly diagnostics: number;
    readonly read: TypeDirective | undefined;
  }>([
    {
      name: "an ignore in a line comment",
      directive: `// ${TYPE_IGNORE}`,
      diagnostics: 0,
      read: "@ts-ignore",
    },
    {
      name: "an expectation in a line comment",
      directive: `// ${TYPE_EXPECTATION}`,
      diagnostics: 0,
      read: "@ts-expect-error",
    },
    {
      name: "an expectation in a triple-slash comment",
      directive: `/// ${TYPE_EXPECTATION} legacy`,
      diagnostics: 0,
      read: "@ts-expect-error",
    },
    {
      name: "a nocheck in a triple-slash comment",
      directive: `/// ${TYPE_NOCHECK}`,
      diagnostics: 0,
      read: "@ts-nocheck",
    },
    {
      name: "an ignore on the last line of a block comment",
      directive: `/*\n * reason\n * ${TYPE_IGNORE} */`,
      diagnostics: 0,
      read: "@ts-ignore",
    },
    {
      name: "an expectation after slashes on the last line of a block comment",
      directive: `/* reason\n//// ${TYPE_EXPECTATION} */`,
      diagnostics: 0,
      read: "@ts-expect-error",
    },
    {
      name: "an ignore on a one-line doc comment",
      directive: `/** ${TYPE_IGNORE} */`,
      diagnostics: 0,
      read: "@ts-ignore",
    },
    {
      name: "a nocheck after a leading block comment",
      directive: `// ${TYPE_NOCHECK}`,
      before: "/* header */\n",
      commentAt: 12,
      diagnostics: 0,
      read: "@ts-nocheck",
    },
    {
      name: "an ignore on the first line of a longer block comment",
      directive: `/* ${TYPE_IGNORE}\n * reason\n */`,
      diagnostics: 1,
      read: undefined,
    },
    {
      name: "an ignore above the closing line of a block comment",
      directive: `/*\n * ${TYPE_IGNORE}\n */`,
      diagnostics: 1,
      read: undefined,
    },
    {
      name: "an ignore with a longer name",
      directive: "// @ts-ignored",
      diagnostics: 0,
      read: "@ts-ignore",
    },
    {
      name: "a nocheck in capitals",
      directive: "// @TS-NOCHECK",
      diagnostics: 0,
      read: "@ts-nocheck",
    },
    {
      name: "a nocheck followed by a colon",
      directive: "// @ts-nocheck: legacy",
      diagnostics: 0,
      read: "@ts-nocheck",
    },
    {
      name: "an ignore in mixed case",
      directive: "// @Ts-Ignore",
      diagnostics: 1,
      read: undefined,
    },
    {
      name: "a nocheck with a longer name",
      directive: "// @ts-nocheck-later",
      diagnostics: 1,
      read: undefined,
    },
    {
      name: "an ignore after four slashes",
      directive: `//// ${TYPE_IGNORE}`,
      diagnostics: 1,
      read: undefined,
    },
    {
      name: "a nocheck in a block comment",
      directive: `/* ${TYPE_NOCHECK} */`,
      diagnostics: 1,
      read: undefined,
    },
    {
      name: "a nocheck in a doc comment",
      directive: `/** ${TYPE_NOCHECK} */`,
      diagnostics: 1,
      read: undefined,
    },
    {
      name: "a nocheck after code",
      directive: `// ${TYPE_NOCHECK}`,
      before: "const first = 1;\n",
      commentAt: 16,
      diagnostics: 1,
      read: undefined,
    },
  ])(
    "reads $name the way the compiler does",
    ({ directive, before, commentAt, diagnostics, read }) => {
      const source = `${before ?? ""}${directive}\n${TYPE_ERROR_LINE}\n`;

      expect({
        diagnostics: compiledDiagnostics({ source }).length,
        read: directiveAt({ source, commentAt: commentAt ?? 0 }),
      }).toEqual({
        diagnostics,
        read,
      });
    },
  );

  it.each<{
    readonly name: string;
    readonly markup: string;
    readonly commentAt: number;
    readonly diagnostics: number;
    readonly read: TypeDirective | undefined;
  }>([
    {
      name: "an ignore in a line comment before a statement",
      markup: `// ${TYPE_IGNORE}\nexport const view = n.foo;\n`,
      commentAt: -1,
      diagnostics: 0,
      read: "@ts-ignore",
    },
    {
      name: "an ignore in a line comment inside braces",
      markup: `export const view = <div>{\n  // ${TYPE_IGNORE}\n  n.foo}</div>;\n`,
      commentAt: 26,
      diagnostics: 0,
      read: "@ts-ignore",
    },
    {
      name: "an ignore-shaped line in JSX text",
      markup: `export const view = <div>\n  // ${TYPE_IGNORE}\n  {n.foo}</div>;\n`,
      commentAt: 25,
      diagnostics: 1,
      read: undefined,
    },
  ])(
    "reads $name in a .tsx file the way the compiler does",
    ({ markup, commentAt, diagnostics, read }) => {
      const source = `${JSX_DECLARATIONS}${markup}`;
      const position = JSX_DECLARATIONS.length + commentAt;

      expect({
        diagnostics: compiledDiagnostics({ source, file: COMPILED_JSX_FILE }).length,
        read: directiveAt({ source, commentAt: position, file: "src/directive.tsx" }),
      }).toEqual({ diagnostics, read });
    },
  );

  it("reads the text after the directive as its tail", () => {
    const source = `// ${TYPE_EXPECTATION} reason (#42)\n${TYPE_ERROR_LINE}\n`;
    const sourceFile = SYNTAX_API.createSourceFile(
      "src/directive.ts",
      source,
      SYNTAX_API.ScriptTarget.Latest,
      true,
    );
    const [range] = SYNTAX_API.getLeadingCommentRanges(source, 0) ?? [];
    assert(range !== undefined);

    expect(typeDirectiveReaderFor({ sourceFile, syntaxApi: SYNTAX_API })({ range })).toEqual({
      directive: "@ts-expect-error",
      tail: " reason (#42)",
    });
  });

  it("names the three directives the compiler honours as escapes", () => {
    expect(TYPE_DIRECTIVES).toEqual([TYPE_EXPECTATION, TYPE_IGNORE, TYPE_NOCHECK]);
  });
});
