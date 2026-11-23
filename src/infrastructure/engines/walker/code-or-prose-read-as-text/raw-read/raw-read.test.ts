import { assert, describe, expect, it } from "vitest";

import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { DEFAULT_TEST_FILES } from "../../../../../domain/settings/test-files.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./raw-read.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "code-or-prose-read-as-text#raw-read",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/code-or-prose-read-as-text/raw-read",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "raw-read.ts" },
};

const loadedParse = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParse.outcome === "ok");
const parse = loadedParse.value;

const observeWalkerPiece = async (request: {
  readonly piece: WalkerPiece;
  readonly binding: CheckBinding;
  readonly file: RepoPath;
  readonly source: string;
}): Promise<Result<readonly CheckHit[], RunnerFailure>> => {
  const bindings = [request.binding];
  const prepared = request.piece.prepare({
    bindings,
    repository: {
      files: [request.file],
      exists: () => "present",
      disk: textsDisk({ root: "/repo", texts: {} }),
      testFiles: DEFAULT_TEST_FILES,
    },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const observed = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [{ modulePath: request.binding.pieceRoot, bindings, check: prepared.value }],
    parse,
    escapes: [],
  });
  assert(observed.outcome === "ok");
  return { outcome: "ok", value: observed.value.hits };
};

describe("raw reads", () => {
  it("finds literal code and doc reads in file-call arguments and raw imports", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'fs.readFileSync(join(dir, "README.md"));\nawait fs.promises.readFile("./order.mts");\nimport text from "./order.ts?raw";\nawait import("./guide.mdx?raw");',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 26 },
          snippet: '"README.md"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 27 },
          snippet: '"./order.mts"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 3, column: 17 },
          snippet: '"./order.ts?raw"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 4, column: 13 },
          snippet: '"./guide.mdx?raw"',
        },
      ],
    });
  });

  it("finds source glob patterns with the current and older raw options", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'import.meta.glob(["./*.{ts,md}", "!./skip.ts"], { query: "?raw" });\nimport.meta.glob("./*.md", { as: "raw" });\nimport.meta.glob("./*.ts", { eager: true });\nimport.meta.glob(["!./skip.ts", "./*.json"], { query: "?raw" });',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 18 },
          snippet: '"./*.{ts,md}"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 17 },
          snippet: '"./*.md"',
        },
      ],
    });
  });

  it("passes unrelated file types, ordinary imports and production reads", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source: 'readFileSync("./data.json");\nimport "./codec.ts";\nreadFileSync(docPath);',
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
    const file = repoPathSchema.parse("src/orders.ts");
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: file,
        source: 'readFileSync("./doc.md");',
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("finds actual file-system reads without matching local ports or earlier path segments", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'import { readFileSync } from "node:fs";\nimport * as files from "node:fs/promises";\nconst host = hooks.fileHost;\nhost.readFile("src/a.ts");\nreadFileSync(join(fileURLToPath(new URL("./x.test.ts", import.meta.url)), "..", "data.json"));\nreadFileSync(resolve("elsewhere.md", ".."));\nreadFileSync((("README.MD") as string));\nfiles.readFile("src/order.ts");',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 7, column: 15 },
          snippet: '"README.MD"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 8, column: 15 },
          snippet: '"src/order.ts"',
        },
      ],
    });
  });

  it("finds renamed reads, the imported promises namespace and required file systems", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'import { readFile as read } from "node:fs/promises";\nimport { promises } from "fs";\nimport { promises as files } from "node:fs";\nawait read("./order.ts");\nawait promises.readFile("README.md");\nawait files.readFile("guide.mdx");\nrequire("fs").readFileSync("src/order.ts");\nrequire("node:fs").promises.readFile("src/order.mts");',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 4, column: 11 },
          snippet: '"./order.ts"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 5, column: 24 },
          snippet: '"README.md"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 6, column: 21 },
          snippet: '"guide.mdx"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 7, column: 27 },
          snippet: '"src/order.ts"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 8, column: 37 },
          snippet: '"src/order.mts"',
        },
      ],
    });
  });

  it("passes renamed writes, renamed local reads and required local modules", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'import { writeFile as readFile } from "node:fs/promises";\nimport { readFile as read } from "./ports.ts";\nawait readFile("./order.ts", "");\nawait read("./order.ts");\nrequire("./ports.ts").readFileSync("src/order.ts");',
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("finds static template suffixes and raw query forms without searching unrelated arguments", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'readFileSync(`${root}/README.md`);\nreadFile(new URL(`./${name}.ts`, import.meta.url));\nimport.meta.glob("./*.md", { "query": "raw" });\nimport.meta.glob("./*.ts", { query: { raw: true } });\nimport.meta.glob("./*.mts", { query: "?inline&raw" });\nimport report from "./report.ts?url&raw";\nimport type { Report } from "./report.ts?raw";\nreadFile({ path: "report.ts" });\nreadFile(path, "utf8", (error, text) => verify(text).toContain("report.ts"));\nreadFileSync(fileURLToPath(new URL("../README.md", import.meta.url)));',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 13 },
          snippet: "`${root}/README.md`",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 17 },
          snippet: "`./${name}.ts`",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 3, column: 17 },
          snippet: '"./*.md"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 5, column: 17 },
          snippet: '"./*.mts"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 6, column: 19 },
          snippet: '"./report.ts?url&raw"',
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 10, column: 35 },
          snippet: '"../README.md"',
        },
      ],
    });
  });
});
