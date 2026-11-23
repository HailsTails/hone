import { assert, describe, expect, it, vi } from "vitest";

import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { PreparedWalkerCheck, WalkerFile } from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./categorical-paths.ts";

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

const ADDRESS: CheckAddressText = "drawer-path#drawer-names";
const SYNTAX_API = defaultParsePort.syntaxApi;
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-7",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "categorical-paths.ts" },
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({
    bindings: [CLAUSE],
    repository: {
      files: [request.file],
      exists: vi.fn().mockReturnValue("present"),
      disk: EMPTY_DISK,
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    },
    syntaxApi: SYNTAX_API,
  });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD-7 existing categorical path checks", () => {
  it("completes both filename and first-folder findings in order without reading content", () => {
    const file = repoPathOf("src/common/helpers/types.ts");
    const prepared = preparedFor({ file });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "file-unreadable", file, detail: "unexpected read" },
    });

    const observation = prepared.prepareFile({ file, readText });

    expect(observation).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet: "forbidden categorical filename: types.ts",
          },
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet: "forbidden categorical folder: common",
          },
        ],
      },
    });
    expect(readText).not.toHaveBeenCalled();
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it.each(["src/account-types.ts", "src/Types.ts", "src/types.tsx"])(
    "retains the exact filename gap for %s",
    (fileName) => {
      const file = repoPathSchema.parse(fileName);
      const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "file-unreadable", file, detail: "unexpected read" },
      });

      expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual({
        outcome: "ok",
        value: { kind: "complete", hits: [] },
      });
      expect(readText).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: "all-depth exclusion",
      fileName: "src/node_modules/types.ts",
      expected: { outcome: "ok", value: { kind: "skipped" } },
    },
    {
      name: "root-only exclusion",
      fileName: "vendor/types.ts",
      expected: { outcome: "ok", value: { kind: "skipped" } },
    },
    {
      name: "nested root-only directory",
      fileName: "src/vendor/types.ts",
      expected: {
        outcome: "ok",
        value: {
          kind: "complete",
          hits: [
            {
              check: ADDRESS,
              anchor: { line: 1, column: 0 },
              snippet: "forbidden categorical filename: types.ts",
            },
          ],
        },
      },
    },
    {
      name: "physical script",
      fileName: "scripts/types.ts",
      expected: {
        outcome: "ok",
        value: {
          kind: "complete",
          hits: [
            {
              check: ADDRESS,
              anchor: { line: 1, column: 0 },
              snippet: "forbidden categorical filename: types.ts",
            },
            {
              check: ADDRESS,
              anchor: { line: 1, column: 0 },
              snippet: "forbidden categorical folder: scripts",
            },
          ],
        },
      },
    },
    {
      name: "values folder",
      fileName: "src/values/money.ts",
      expected: {
        outcome: "ok",
        value: {
          kind: "complete",
          hits: [
            {
              check: ADDRESS,
              anchor: { line: 1, column: 0 },
              snippet: "forbidden categorical folder: values",
            },
          ],
        },
      },
    },
    {
      name: "root tests folder",
      fileName: "tests/money.ts",
      expected: {
        outcome: "ok",
        value: {
          kind: "complete",
          hits: [
            {
              check: ADDRESS,
              anchor: { line: 1, column: 0 },
              snippet: "forbidden categorical folder: tests",
            },
          ],
        },
      },
    },
    {
      name: "root test folder",
      fileName: "test/money.ts",
      expected: {
        outcome: "ok",
        value: {
          kind: "complete",
          hits: [
            {
              check: ADDRESS,
              anchor: { line: 1, column: 0 },
              snippet: "forbidden categorical folder: test",
            },
          ],
        },
      },
    },
    {
      name: "nested __tests__ folder",
      fileName: "src/__tests__/money.ts",
      expected: {
        outcome: "ok",
        value: {
          kind: "complete",
          hits: [
            {
              check: ADDRESS,
              anchor: { line: 1, column: 0 },
              snippet: "forbidden categorical folder: __tests__",
            },
          ],
        },
      },
    },
    {
      name: "scripts folder",
      fileName: "src/scripts/run.ts",
      expected: {
        outcome: "ok",
        value: {
          kind: "complete",
          hits: [
            {
              check: ADDRESS,
              anchor: { line: 1, column: 0 },
              snippet: "forbidden categorical folder: scripts",
            },
          ],
        },
      },
    },
    {
      name: "test source",
      fileName: "src/example.test.ts",
      expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
    },
    {
      name: "declaration source",
      fileName: "src/example.d.ts",
      expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
    },
    {
      name: "non-TypeScript candidate",
      fileName: "src/types.js",
      expected: { outcome: "ok", value: { kind: "skipped" } },
    },
  ])("preserves path-family eligibility and findings for $name", ({ fileName, expected }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "file-unreadable", file, detail: "unexpected read" },
    });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual(expected);
    expect(readText).not.toHaveBeenCalled();
  });
});
