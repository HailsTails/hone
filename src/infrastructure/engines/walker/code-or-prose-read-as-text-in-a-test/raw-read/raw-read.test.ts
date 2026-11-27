import { assert, describe, expect, it, vi } from "vitest";

import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { DEFAULT_TEST_FILES } from "../../../../../domain/settings/test-files.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { WalkerFile } from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./raw-read.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "code-or-prose-read-as-text-in-a-test#raw-read",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/code-or-prose-read-as-text-in-a-test/raw-read",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "raw-read.ts" },
};

describe("raw reads", () => {
  it("finds literal code and doc reads in file-call arguments and raw imports", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'fs.readFileSync(join(dir, "README.md"));\nawait fs.promises.readFile("./order.mts");\nimport text from "./order.ts?raw";\nawait import("./guide.mdx?raw");',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
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
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });

  it("finds source glob patterns with the current and older raw options", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'import.meta.glob(["./*.{ts,md}", "!./skip.ts"], { query: "?raw" });\nimport.meta.glob("./*.md", { as: "raw" });\nimport.meta.glob("./*.ts", { eager: true });\nimport.meta.glob(["!./skip.ts", "./*.json"], { query: "?raw" });',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
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
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });

  it("passes unrelated file types and ordinary imports in a test", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value: 'readFileSync("./data.json");\nimport "./codec.ts";\nreadFileSync(docPath);',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], applicable: [BINDING.address] },
    });
  });

  it("passes reads in production code", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const file = repoPathSchema.parse("src/orders.ts");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [file],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: file,
        readText: vi
          .fn<WalkerFile["readText"]>()
          .mockReturnValue({ outcome: "ok", value: 'readFileSync("./doc.md");' }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], applicable: [], inapplicable: [BINDING.address] },
    });
  });

  it("finds actual file-system reads without matching local ports or earlier path segments", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'import { readFileSync } from "node:fs";\nimport * as files from "node:fs/promises";\nconst host = hooks.fileHost;\nhost.readFile("src/a.ts");\nreadFileSync(join(fileURLToPath(new URL("./x.test.ts", import.meta.url)), "..", "data.json"));\nreadFileSync(resolve("elsewhere.md", ".."));\nreadFileSync((("README.MD") as string));\nfiles.readFile("src/order.ts");',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
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
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });

  it("finds renamed reads and the imported promises namespace", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'import { readFile as read } from "node:fs/promises";\nimport { promises } from "fs";\nimport { promises as files } from "node:fs";\nawait read("./order.ts");\nawait promises.readFile("README.md");\nawait files.readFile("guide.mdx");',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
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
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });

  it("finds reads through required file systems", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'require("fs").readFileSync("src/order.ts");\nrequire("node:fs").promises.readFile("src/order.mts");',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 1, column: 27 },
            snippet: '"src/order.ts"',
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 2, column: 37 },
            snippet: '"src/order.mts"',
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });

  it("passes renamed writes, renamed local reads and required local modules", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'import { writeFile as readFile } from "node:fs/promises";\nimport { readFile as read } from "./ports.ts";\nawait readFile("./order.ts", "");\nawait read("./order.ts");\nrequire("./ports.ts").readFileSync("src/order.ts");',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], applicable: [BINDING.address] },
    });
  });

  it("finds static template suffixes without searching unrelated arguments", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'readFileSync(`${root}/README.md`);\nreadFile(new URL(`./${name}.ts`, import.meta.url));\nreadFile({ path: "report.ts" });\nreadFile(path, "utf8", (error, text) => verify(text).toContain("report.ts"));\nreadFileSync(fileURLToPath(new URL("../README.md", import.meta.url)));',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
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
            anchor: { line: 5, column: 35 },
            snippet: '"../README.md"',
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });

  it("finds raw query forms", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [TEST_FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loaded.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const observed = observeWalkerFile({
      file: {
        file: TEST_FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'import.meta.glob("./*.md", { "query": "raw" });\nimport.meta.glob("./*.ts", { query: { raw: true } });\nimport.meta.glob("./*.mts", { query: "?inline&raw" });\nimport report from "./report.ts?url&raw";\nimport type { Report } from "./report.ts?raw";',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 1, column: 17 },
            snippet: '"./*.md"',
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 3, column: 17 },
            snippet: '"./*.mts"',
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 4, column: 19 },
            snippet: '"./report.ts?url&raw"',
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });
});
