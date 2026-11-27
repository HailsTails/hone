import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import { DEFAULT_TEST_FILES } from "../../../../domain/settings/test-files.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import type { runConfiguredOxlint } from "../../../node/process/configured-oxlint.ts";
import type { RunOxlint } from "../../../node/process/oxlint-port.ts";
import { createOxlintRunner } from "./runner.ts";

const INSTALL_ROOT = absolutePathSchema.parse(
  createDefaultPathPort({}).join({ segments: [import.meta.dirname, "../../../../.."] }),
);

const BINDINGS = [
  {
    ruleSet: TOOL_RULE_SET,
    engine: "oxlint",
    pieceRoot: "/hone",
    checkSettings: {},
    edition: editionOf("1"),
    address: "untyped-value#explicit-any",
    anchor: { kind: "keyword", keyword: "any" },
    settings: { rule: "typescript/no-explicit-any" },
  },
  {
    ruleSet: TOOL_RULE_SET,
    engine: "oxlint",
    pieceRoot: "/hone",
    checkSettings: {},
    edition: editionOf("1"),
    address: "positional-parameters#parameter-count",
    anchor: { kind: "keyword", keyword: "function" },
    settings: { rule: "eslint/max-params" },
  },
] satisfies readonly CheckBinding[];

describe("createOxlintRunner", () => {
  it("maps Oxlint sites to named source cases by index", async () => {
    const fileName = repoPathOf("src/value.ts");
    const binding: CheckBinding = {
      address: "untyped-value#explicit-any",
      ruleSet: TOOL_RULE_SET,
      engine: "oxlint",
      anchor: { kind: "keyword", keyword: "any" },
      pieceRoot: "/hone/explicit-any",
      settings: { rule: "typescript/no-explicit-any" },
      checkSettings: {},
      edition: editionOf("1"),
    };
    const cases = [
      { name: "explicit", fileName, source: "let value: any;", expectedLines: [1] },
      { name: "unknown", fileName, source: "let value: unknown;", expectedLines: [] },
    ];
    const lint = vi.fn<RunOxlint>().mockResolvedValue({
      outcome: "ok",
      value: [{ rule: "typescript/no-explicit-any", index: 0, line: 1, column: 12 }],
    });

    const report = await createOxlintRunner({
      lint,
      configured: vi.fn<typeof runConfiguredOxlint>(),
      fileText: {
        read: vi.fn<FileTextPort["read"]>(),
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      },
    }).conform({ binding, cases });

    expect(lint).toHaveBeenCalledWith({
      resolveFrom: expect.not.stringContaining("/hone/explicit-any"),
      nativeOptions: new Map([["typescript/no-explicit-any", []]]),
      rules: ["typescript/no-explicit-any"],
      sources: cases,
    });
    expect(report).toEqual({
      outcome: "ok",
      value: [
        { caseName: "explicit", flaggedLines: [1] },
        { caseName: "unknown", flaggedLines: [] },
      ],
    });
  });

  it("passes a shared lint rule and its requested edition to Oxlint", async () => {
    const lint = vi.fn<RunOxlint>().mockResolvedValue({ outcome: "ok", value: [] });
    const runner = createOxlintRunner({
      lint,
      configured: vi.fn<typeof runConfiguredOxlint>(),
      fileText: {
        read: vi.fn<FileTextPort["read"]>(),
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      },
    });
    const binding: CheckBinding = {
      address: "test-switched-off#skipped-tests",
      engine: "oxlint",
      ruleSet: TOOL_RULE_SET,
      anchor: { kind: "keyword", keyword: "skip" },
      pieceRoot: "/hone/skipped-tests",
      settings: { plugin: "eslint" },
      checkSettings: {},
      edition: editionOf("2"),
    };

    const report = await runner.conform({ binding, cases: [] });

    expect(report).toEqual({ outcome: "ok", value: [] });
    expect(lint).toHaveBeenCalledWith({
      resolveFrom: expect.not.stringContaining("/hone/skipped-tests"),
      nativeOptions: new Map(),
      rules: [],
      sources: [],
      pluginRules: [
        {
          kind: "plugin",
          id: "hone-test-switched-off-focused-tests/skipped-tests",
          namespace: "hone-test-switched-off-focused-tests",
          module: expect.stringMatching(/focused-tests[/\\]eslint-plugin\.ts$/u),
          options: ["conditional-and-todo"],
        },
      ],
    });
  });

  it("requires the generated projection before checking the configured files", async () => {
    const file = repoPathOf("src/value.ts");
    const root = absoluteRootOf("/repo");
    const configured = vi.fn<typeof runConfiguredOxlint>();
    const runner = createOxlintRunner({
      lint: vi.fn<RunOxlint>(),
      configured,
      fileText: {
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
        read: vi.fn<FileTextPort["read"]>().mockReturnValue({
          outcome: "failed",
          error: {
            kind: "unreadable",
            path: "/repo/hone.oxlint.json",
            detail: "Missing projection",
          },
        }),
      },
    });

    const report = await runner.run({
      repoRoot: root,
      installRoot: INSTALL_ROOT,
      files: [file],
      trackedPaths: [repoPathOf(".oxlintrc.json"), file],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      testFiles: DEFAULT_TEST_FILES,
      bindings: BINDINGS,
    });

    expect(configured).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      outcome: "ok",
      value: { projection: "missing", projectionFile: "hone.oxlint.json", hits: [] },
    });
  });
});
