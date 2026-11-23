import { assert, describe, expect, it, vi } from "vitest";

import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { SourceObservers, WalkerRepository } from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./export-test-sibling.ts";

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

const FILE = repoPathOf("src/view.tsx");
const SIBLING = repoPathOf("src/view.test.tsx");
const ADDRESS: CheckAddressText = "unit-without-a-running-test#companion-test-file";
const SYNTAX_API = defaultParsePort.syntaxApi;
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-23",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "export-test-sibling.ts" },
};

const sourceObservations = (request: {
  readonly source: string;
  readonly repository: WalkerRepository;
}): SourceObservers => {
  const prepared = check.prepare({
    bindings: [CLAUSE],
    repository: request.repository,
    syntaxApi: SYNTAX_API,
  });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({
    file: FILE,
    readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }),
  });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  return selected.value.begin({
    sourceFile: SYNTAX_API.createSourceFile(
      FILE,
      request.source,
      SYNTAX_API.ScriptTarget.Latest,
      true,
    ),
    anchorAt: vi.fn().mockReturnValue({ line: 1, column: 0 }),
  });
};

describe("CD-23 existing exported-source sibling obligation", () => {
  it("reports an exported runtime source without its co-located test sibling at the file anchor", () => {
    const observers = sourceObservations({
      source: "export const value = 1;\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent"), disk: EMPTY_DISK },
    });

    expect(observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "missing co-located *.test.ts(x) sibling",
      },
    ]);
  });

  it("accepts the existing TSX test sibling in the supplied repository population", () => {
    const observers = sourceObservations({
      source: "export const value = 1;\n",
      repository: {
        files: [FILE, SIBLING],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
      },
    });

    expect(observers.finish()).toEqual([]);
  });

  it("reports a default-export assignment without its co-located test sibling", () => {
    const observers = sourceObservations({
      source: "export default value;\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent"), disk: EMPTY_DISK },
    });

    expect(observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "missing co-located *.test.ts(x) sibling",
      },
    ]);
  });

  it("reports a runtime named export without its co-located test sibling", () => {
    const observers = sourceObservations({
      source: "const value = 1;\nexport { value };\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent"), disk: EMPTY_DISK },
    });

    expect(observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "missing co-located *.test.ts(x) sibling",
      },
    ]);
  });

  it("excludes both forms of type-only named exports from sibling obligations", () => {
    const observers = sourceObservations({
      source:
        "export type { First } from './first.ts';\nexport { type Second } from './second.ts';\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent"), disk: EMPTY_DISK },
    });

    expect(observers.finish()).toEqual([]);
  });

  it("accepts an exported TS source with its matching TS test sibling", () => {
    const file = repoPathOf("src/value.ts");
    const sibling = repoPathOf("src/value.test.ts");
    const source = "export const value = 1;\n";
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [file, sibling],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
      },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const selected = prepared.value.prepareFile({
      file,
      readText: vi.fn().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selected.outcome === "ok");
    assert(selected.value.kind === "syntax");
    const observers = selected.value.begin({
      sourceFile: SYNTAX_API.createSourceFile(file, source, SYNTAX_API.ScriptTarget.Latest, true),
      anchorAt: vi.fn().mockReturnValue({ line: 1, column: 0 }),
    });

    expect(observers.finish()).toEqual([]);
  });

  it("retains type-only and declare-only export exclusions", () => {
    const observers = sourceObservations({
      source:
        "export type Value = { readonly name: string };\nexport declare const value: Value;\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent"), disk: EMPTY_DISK },
    });

    expect(observers.finish()).toEqual([]);
  });

  it("preserves the existing export-star and unexported-runtime classification gaps", () => {
    const observers = sourceObservations({
      source: "export * from './module.ts';\nconst hidden = 1;\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent"), disk: EMPTY_DISK },
    });

    expect(observers.finish()).toEqual([]);
  });

  it.each([
    "src/view.test.ts",
    "src/view.js",
    "src/view.d.ts",
    "src/__tests__/fixture.ts",
    "src/node_modules/view.ts",
    "vendor/view.ts",
  ])("preserves the existing companion-check exclusion for %s", (fileName) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: { files: [file], exists: vi.fn().mockReturnValue("absent"), disk: EMPTY_DISK },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "ok", value: "export const value = 1;\n" });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toEqual({ outcome: "ok", value: { kind: "skipped" } });
    expect(readText).not.toHaveBeenCalled();
  });

  it.each(["src/vendor/view.ts", "src/scripts/task.ts", "scripts/task.ts", "ui/view.tsx"])(
    "retains authored source for %s",
    (fileName) => {
      const file = repoPathSchema.parse(fileName);
      const prepared = check.prepare({
        bindings: [CLAUSE],
        repository: { files: [file], exists: vi.fn().mockReturnValue("absent"), disk: EMPTY_DISK },
        syntaxApi: SYNTAX_API,
      });
      assert(prepared.outcome === "ok");
      const readText = vi.fn().mockReturnValue({
        outcome: "failed",
        error: { kind: "file-unreadable", file, detail: "unexpected read" },
      });

      const selected = prepared.value.prepareFile({ file, readText });

      expect(selected).toMatchObject({
        outcome: "ok",
        value: { kind: "syntax", begin: expect.any(Function) },
      });
      expect(readText).not.toHaveBeenCalled();
    },
  );
});
