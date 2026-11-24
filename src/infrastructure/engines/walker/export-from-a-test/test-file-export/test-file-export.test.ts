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
import { check } from "./test-file-export.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "export-from-a-test#test-file-export",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/export-from-a-test/test-file-export",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "test-file-export.ts" },
};

describe("test-file exports", () => {
  it("locates named, type, default and assignment exports in a test", async () => {
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
            'export const value = 1;\nexport type { Input } from "./unit.ts";\nexport default value;\nexport = value;',
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
            anchor: { line: 1, column: 0 },
            snippet: "export",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 2, column: 0 },
            snippet: "export",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 3, column: 0 },
            snippet: "export",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 4, column: 0 },
            snippet: "export",
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });

  it("finds an export in a TSX test", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const file = repoPathSchema.parse("src/order.test.tsx");
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
          .mockReturnValue({ outcome: "ok", value: "export const order = 1;" }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [{ file, check: BINDING.address, anchor: { line: 1, column: 0 }, snippet: "export" }],
        nativeExceptions: [],
        applicable: [BINDING.address],
      },
    });
  });

  it.each(["src/order.test.mts", "src/order.test.cts"])(
    "leaves %s outside the existing test-file scope",
    async (name) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const file = repoPathSchema.parse(name);
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
            .mockReturnValue({ outcome: "ok", value: "export const order = 1;" }),
        },
        pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
        parse: loaded.value,
        escapes: [],
      });

      expect(observed).toEqual({
        outcome: "ok",
        value: { hits: [], nativeExceptions: [], applicable: [] },
      });
    },
  );

  it("passes export text and empty module markers in a test", async () => {
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
          value: 'const message = "export default 1";\nexport {};',
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

  it("passes exports in production code", async () => {
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
          .mockReturnValue({ outcome: "ok", value: "export default 1;" }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], applicable: [] },
    });
  });

  it("passes exports inside a local namespace or module augmentation", async () => {
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
            'namespace Local { export const value = 1; }\ndeclare module "vitest" { export interface TestContext {} }',
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
});
