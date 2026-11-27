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
import { check } from "./assertion-site.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "assertion-outside-a-test-body#assertion-site",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/assertion-outside-a-test-body/assertion-site",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "assertion-site.ts" },
};

describe("assertion sites", () => {
  it("reports assertions in suites and hooks while allowing asymmetric matchers", async () => {
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
            'beforeEach(() => expect(order).toBeDefined());\ndescribe("suite", () => { assert.ok(order); });\nexpect.hasAssertions();\nconst type = expect.any(String);\nexpect.extend(matchers);',
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
            snippet: "expect",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 2, column: 26 },
            snippet: "assert",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 3, column: 0 },
            snippet: "expect",
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
        inapplicable: [],
      },
    });
  });

  it("recognizes modified and table-driven tests as the assertion boundary", async () => {
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
            'it.each([1])("case", () => { const prove = () => expect(order).toBeDefined(); prove(); });\ntest.concurrent("case", () => assert.ok(order));',
        }),
      },
      pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
      parse: loaded.value,
      escapes: [],
    });

    expect(observed).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], applicable: [BINDING.address], inapplicable: [] },
    });
  });

  it("recognizes namespace test members and a constant made by chaining extensions", async () => {
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
            'import * as vitest from "vitest";\nconst trial = vitest.test.extend(fixtures).extend(extraFixtures);\nvitest.it("case", () => expect(order));\nvitest["test"].concurrent("case", () => expect(order));\ntrial("case", () => expect(order));\nvitest.describe("suite", () => expect(order));',
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
            anchor: { line: 6, column: 31 },
            snippet: "expect",
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
        inapplicable: [],
      },
    });
  });

  it("resolves Vitest imports and ignores production assertions from other sources", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const file = repoPathSchema.parse("src/helper.ts");
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
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({
          outcome: "ok",
          value:
            'import assert from "node:assert/strict";\nimport { expect as verify } from "vitest";\nassert.ok(order);\nverify(order).toBeDefined();\nconst compare = (verify: Check) => verify(order);',
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
          { file: file, check: BINDING.address, anchor: { line: 4, column: 0 }, snippet: "verify" },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
        inapplicable: [],
      },
    });
  });

  it("recognizes a Vitest extension without treating shadowed or unrelated callbacks as tests", async () => {
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
            'import { test as base, it as should } from "vitest";\nimport { test as adapter } from "./runtime";\nconst myTest = base.extend(fixtures);\nconst chained = myTest.extend(otherFixtures);\nconst fake = adapter.extend(fixtures);\nbase("import", () => expect(order));\nshould("alias", () => expect(order));\nmyTest("extended", () => expect(order));\nchained("chain", () => expect(order));\nfunction outer(it: Test) { it("shadowed", () => expect(order)); }\nfunction inner(myTest: Test) { myTest("shadowed", () => expect(order)); }\nfake("adapter", () => expect(order));',
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
            anchor: { line: 10, column: 48 },
            snippet: "expect",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 11, column: 56 },
            snippet: "expect",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 12, column: 22 },
            snippet: "expect",
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
        inapplicable: [],
      },
    });
  });

  it("reports the Vitest expect methods that make assertions", async () => {
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
            "expect.soft(order);\nexpect.poll(readOrder);\nexpect.assertions(1);\nexpect.unreachable();",
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
            snippet: "expect",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 2, column: 0 },
            snippet: "expect",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 3, column: 0 },
            snippet: "expect",
          },
          {
            file: TEST_FILE,
            check: BINDING.address,
            anchor: { line: 4, column: 0 },
            snippet: "expect",
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
        inapplicable: [],
      },
    });
  });

  it("resolves assertion bindings in tests without treating an each table as a test body", async () => {
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
            'import { expect as verify } from "vitest";\nconst expect = (order: Order) => order;\nexpect(order);\nit.each([() => verify(order)])("case", () => verify(order));\nit("case", { timeout: 100 }, () => verify(order));',
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
            anchor: { line: 4, column: 15 },
            snippet: "verify",
          },
        ],
        nativeExceptions: [],
        applicable: [BINDING.address],
        inapplicable: [],
      },
    });
  });
});
