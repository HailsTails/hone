import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { ClauseSettingValues, RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type { Anchor } from "../../../../domain/finding/anchor.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../runner/toolchain/typescript-toolchain.ts";
import type { PreparedWalkerCheck, SourceObservers } from "../runner/pieces/walker-piece.ts";
import { check } from "./comments-directives.ts";
import { textsDisk } from "../runner/pieces/walker-disk.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";

const EMPTY_DISK = textsDisk({ root: "/repo", texts: {} });
const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../../..`, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const defaultParsePort = loadedParsePort.value;

const FILE = repoPathOf("src/annotations.ts");
const ADDRESS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-5"), clause: clauseIdOf("comments-directives") };
const SYNTAX_API = defaultParsePort.syntaxApi;
const TODO_ANNOTATION = "TO" + "DO";
const TYPE_EXPECTATION = "@ts-expect-" + "error";
const TYPE_IGNORE = "@ts-" + "ignore";
const TYPE_NOCHECK = "@ts-" + "nocheck";
const ANY_TOKEN_PATTERNS: readonly string[] = ["^\\(\\S+\\)$"];
const SPEC_TRACKER_PATTERNS: readonly string[] = ["^\\(spec-\\d+\\)$"];
const LINE_COMMENT = SYNTAX_API.SyntaxKind.SingleLineCommentTrivia;
const BLOCK_COMMENT = SYNTAX_API.SyntaxKind.MultiLineCommentTrivia;

type CommentKind = typeof LINE_COMMENT | typeof BLOCK_COMMENT;
type CommentCase = { readonly name: string; readonly comment: string; readonly kind: CommentKind };

const CLAUSE_WITH_NO_SETTINGS: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-5",
  clauseSettings: {},
  edition: editionOf("1"),
  settings: { module: "comments-directives.ts" },
};
const clauseWith = (request: { readonly clauseSettings: ClauseSettingValues }): RunnerClause => ({
  ...CLAUSE_WITH_NO_SETTINGS,
  clauseSettings: request.clauseSettings,
});
const CLAUSE = clauseWith({ clauseSettings: { trackerPatterns: ANY_TOKEN_PATTERNS } });
const SPEC_CLAUSE = clauseWith({ clauseSettings: { trackerPatterns: SPEC_TRACKER_PATTERNS } });

const sourceObservations = (request: { readonly source: string; readonly clause?: RunnerClause }): {
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
} => {
  const prepared = check.prepare({ clauses: [request.clause ?? CLAUSE], repository: { files: [FILE], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({ file: FILE, readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }) });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>().mockReturnValue({ line: 7, column: 2 });
  return {
    observers: selected.value.begin({ sourceFile: SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true), anchorAt }),
    anchorAt,
    finish: prepared.value.finish,
  };
};

const singleCommentHits = (request: {
  readonly comment: string;
  readonly kind?: CommentKind;
  readonly clause?: RunnerClause;
}): ReturnType<SourceObservers["finish"]> => {
  const observed = sourceObservations({ source: `${request.comment}\nexport const marker = 1;\n`, clause: request.clause });
  observed.observers.comment?.({ range: { kind: request.kind ?? LINE_COMMENT, pos: 0, end: request.comment.length } });
  return observed.observers.finish();
};

describe("CD-5 existing annotation capability", () => {
  it.each([
    { name: "all-depth excluded directory", fileName: "src/node_modules/example.ts", kind: "skipped" },
    { name: "root-only excluded directory", fileName: "vendor/example.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/example.ts", kind: "syntax" },
    { name: "TSX source", fileName: "src/example.tsx", kind: "syntax" },
    { name: "test source", fileName: "src/example.test.ts", kind: "syntax" },
    { name: "declaration source", fileName: "src/example.d.ts", kind: "syntax" },
    { name: "physical scripts source", fileName: "scripts/task.ts", kind: "syntax" },
    { name: "non-TypeScript candidate", fileName: "src/example.js", kind: "skipped" },
  ])("preserves source eligibility without a read for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("returns every annotation in category order with supplied anchors", () => {
    const expectation = `// ${TYPE_EXPECTATION} missing`;
    const directive = "// biome-ignore lint/example: rationale";
    const firstTask = `// ${TODO_ANNOTATION} first`;
    const observed = sourceObservations({ source: `${expectation}\n${directive}\n${firstTask}\n// ${TODO_ANNOTATION} second\n` });

    observed.observers.comment?.({ range: { kind: LINE_COMMENT, pos: 0, end: expectation.length } });
    observed.observers.comment?.({ range: { kind: LINE_COMMENT, pos: expectation.length + 1, end: expectation.length + 1 + directive.length } });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: firstTask },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: `// ${TODO_ANNOTATION} second` },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: directive },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: expectation },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([
      [{ position: expectation.length + directive.length + 2 }],
      [{ position: expectation.length + directive.length + firstTask.length + 3 }],
      [{ position: 0 }],
      [{ position: expectation.length + 1 }],
    ]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains complete multiline directive snippets and refuses a tracker outside the comment", () => {
    const observed = sourceObservations({ source: "/* eslint no-console: off\nreason */\nconst tracker = '(spec-099)';\n" });

    observed.observers.comment?.({ range: { kind: BLOCK_COMMENT, pos: 0, end: 35 } });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "/* eslint no-console: off\nreason */" },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it("matches task annotations on raw lines, including inside strings, and type directives only in comments", () => {
    const observed = sourceObservations({ source: `const note = '// ${TODO_ANNOTATION} later';\nconst marker = '// ${TYPE_EXPECTATION} ignored';\n` });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: `const note = '// ${TODO_ANNOTATION} later';` },
    ]);
  });

  it("leaves ordinary comments and directive lookalikes in strings alone", () => {
    const observed = sourceObservations({ source: "const note = '// eslint-disable no-alert';\n// ordinary explanation\n" });

    observed.observers.comment?.({ range: { kind: LINE_COMMENT, pos: 43, end: 66 } });

    expect(observed.observers.finish()).toEqual([]);
  });
});

describe("CD-5 type directives", () => {
  it.each<CommentCase>([
    { name: "an expectation in a line comment", comment: `// ${TYPE_EXPECTATION} reason`, kind: LINE_COMMENT },
    { name: "an ignore in a line comment", comment: `// ${TYPE_IGNORE} reason`, kind: LINE_COMMENT },
    { name: "a file-wide nocheck in a line comment", comment: `// ${TYPE_NOCHECK}`, kind: LINE_COMMENT },
    { name: "an ignore without a space", comment: `//${TYPE_IGNORE}`, kind: LINE_COMMENT },
    { name: "an ignore in a block comment", comment: `/* ${TYPE_IGNORE} reason */`, kind: BLOCK_COMMENT },
    { name: "an expectation in a doc comment", comment: `/** ${TYPE_EXPECTATION} reason */`, kind: BLOCK_COMMENT },
  ])("flags $name without a tracked reference", ({ comment, kind }) => {
    expect(singleCommentHits({ comment, kind })).toEqual([{ clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: comment }]);
  });

  it.each<CommentCase>([
    { name: "an expectation", comment: `// ${TYPE_EXPECTATION} reason (#42)`, kind: LINE_COMMENT },
    { name: "an ignore", comment: `// ${TYPE_IGNORE} reason (PROJ-7)`, kind: LINE_COMMENT },
    { name: "a nocheck", comment: `// ${TYPE_NOCHECK} (spec-099)`, kind: LINE_COMMENT },
    { name: "a block ignore", comment: `/* ${TYPE_IGNORE} reason (#42) */`, kind: BLOCK_COMMENT },
  ])("accepts $name carrying a tracked reference", ({ comment, kind }) => {
    expect(singleCommentHits({ comment, kind })).toEqual([]);
  });

  it("does not read a directive marker that does not open the comment", () => {
    const comment = `// (#42) ${TYPE_IGNORE} reason`;

    expect(singleCommentHits({ comment })).toEqual([]);
  });

  it("leaves a type-check opt-in and prose mentioning a directive alone", () => {
    expect(singleCommentHits({ comment: "// @ts-check" })).toEqual([]);
    expect(singleCommentHits({ comment: `// avoid ${TYPE_IGNORE} here` })).toEqual([]);
  });
});

describe("CD-5 tracked references with the default patterns", () => {
  it.each([
    { name: "an issue number", tracker: "(#42)" },
    { name: "a ticket key", tracker: "(PROJ-7)" },
    { name: "a spec number", tracker: "(spec-099)" },
    { name: "a link with an id", tracker: "(https://tracker.example/issues/42)" },
  ])("accepts a linter directive, a type directive and a task carrying $name", ({ tracker }) => {
    const observed = sourceObservations({ source: `// ${TODO_ANNOTATION}${tracker} later\n` });

    expect(singleCommentHits({ comment: `// biome-ignore lint/example: rationale ${tracker}` })).toEqual([]);
    expect(singleCommentHits({ comment: `// ${TYPE_EXPECTATION} reason ${tracker}` })).toEqual([]);
    expect(observed.observers.finish()).toEqual([]);
  });

  it.each([
    { name: "empty parentheses", tracker: "()" },
    { name: "blank parentheses", tracker: "(  )" },
    { name: "a word with no digit", tracker: "(legacy)" },
    { name: "a single letter", tracker: "(x)" },
    { name: "a reference with a space", tracker: "(issue 42)" },
    { name: "an unclosed parenthesis", tracker: "(#42" },
  ])("flags a linter directive, a type directive and a task carrying only $name", ({ tracker }) => {
    const directive = `// biome-ignore lint/example: rationale ${tracker}`;
    const expectation = `// ${TYPE_EXPECTATION} reason ${tracker}`;
    const task = `// ${TODO_ANNOTATION}${tracker} later`;
    const observed = sourceObservations({ source: `${task}\n` });

    expect(singleCommentHits({ comment: directive })).toEqual([{ clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: directive }]);
    expect(singleCommentHits({ comment: expectation })).toEqual([{ clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: expectation }]);
    expect(observed.observers.finish()).toEqual([{ clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: task }]);
  });
});

describe("CD-5 task annotations", () => {
  it.each([
    { name: "a reference right after the annotation", source: `// ${TODO_ANNOTATION}(#42) later\n`, hits: 0 },
    { name: "a reference after a space", source: `// ${TODO_ANNOTATION} (#42) later\n`, hits: 0 },
    { name: "a bare annotation", source: `// ${TODO_ANNOTATION} later\n`, hits: 1 },
    { name: "empty parentheses", source: `// ${TODO_ANNOTATION}() later\n`, hits: 1 },
    { name: "a reference further along the line", source: `// ${TODO_ANNOTATION} later (#42)\n`, hits: 1 },
  ])("reads $name as $hits findings", ({ source, hits }) => {
    expect(sourceObservations({ source }).observers.finish()).toHaveLength(hits);
  });
});

describe("CD-5 configured tracker patterns", () => {
  it("accepts only tracked references the configured patterns choose", () => {
    const tracked = "// biome-ignore lint/example: rationale (spec-7)";
    const untracked = "// biome-ignore lint/example: rationale (#42)";
    const task = `// ${TODO_ANNOTATION}(#42) later`;

    expect(singleCommentHits({ comment: tracked, clause: SPEC_CLAUSE })).toEqual([]);
    expect(singleCommentHits({ comment: untracked, clause: SPEC_CLAUSE })).toEqual([{ clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: untracked }]);
    expect(sourceObservations({ source: `${task}\n`, clause: SPEC_CLAUSE }).observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: task },
    ]);
  });

  it("accepts a reference any one of several configured patterns chooses", () => {
    const clause = clauseWith({ clauseSettings: { trackerPatterns: [...SPEC_TRACKER_PATTERNS, "^\\(ABC-\\d+\\)$"] } });

    expect(singleCommentHits({ comment: `// ${TYPE_IGNORE} reason (ABC-12)`, clause })).toEqual([]);
  });

  it.each([
    { name: "a word with no digit", tracker: "(legacy)" },
    { name: "empty parentheses", tracker: "()" },
    { name: "a reference with a space", tracker: "(issue 42)" },
  ])("cannot loosen the default shape to accept $name", ({ tracker }) => {
    const clause = clauseWith({ clauseSettings: { trackerPatterns: [".*"] } });
    const directive = `// biome-ignore lint/example: rationale ${tracker}`;

    expect(singleCommentHits({ comment: directive, clause })).toEqual([{ clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: directive }]);
  });

  it.each<{ readonly name: string; readonly clause: RunnerClause; readonly detail: string }>([
    { name: "no tracker patterns", clause: CLAUSE_WITH_NO_SETTINGS, detail: "the clauseSettings of CD-5#comments-directives are malformed" },
    {
      name: "a pattern list that is not an array",
      clause: clauseWith({ clauseSettings: { trackerPatterns: "\\(#\\d+\\)" } }),
      detail: "the clauseSettings of CD-5#comments-directives are malformed",
    },
    {
      name: "an empty pattern",
      clause: clauseWith({ clauseSettings: { trackerPatterns: [""] } }),
      detail: "the clauseSettings of CD-5#comments-directives are malformed",
    },
    {
      name: "a pattern that does not compile",
      clause: clauseWith({ clauseSettings: { trackerPatterns: ["(spec-"] } }),
      detail: 'the clauseSettings of CD-5#comments-directives are malformed: trackerPatterns entry "(spec-" is not a regular expression',
    },
  ])("refuses to prepare with $name, naming the clause", ({ clause, detail }) => {
    const prepared = check.prepare({
      clauses: [clause],
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
      syntaxApi: SYNTAX_API,
    });

    expect(prepared).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: "/install/mechanisms/audit/CD-5", detail: expect.stringContaining(detail) },
    });
  });
});
