import { describe, expect, it, vi } from "vitest";

import type { Check, Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { NamedEnginePort } from "../../ports/engine/engine-port.ts";
import type { NamedEngineRun, ParsedNamedRunner } from "../../ports/engine/engine-run.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { namedEngineRunsOf } from "./named-engines-run.ts";

const REPO = absoluteRootOf("/repo");
const INSTALL = absoluteRootOf("/install");
const TYPESCRIPT = repoPathOf("src/source.ts");
const MANIFEST = repoPathOf("package.json");
const FIRST_EDITION = editionOf("1");

const SYMPTOM: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "held-value",
  title: "Held value",
  seen: "A value is held.",
  mayIndicate: [],
  breachUsuallySits: "at the holder",
  recipes: [],
  correctUses: [],
};
const CHECK: Check = {
  name: "named-check",
  symptom: SYMPTOM,
  page: "held-value/named-check.md",
  engines: [{ name: "walker" }],
  forms: [],
};
const BINDING: CheckBinding = {
  address: "held-value#named-check",
  ruleSet: TOOL_RULE_SET,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/held-value/named-check",
  settings: { module: "named-check.ts" },
  checkSettings: {},
  edition: FIRST_EDITION,
};

describe("namedEngineRunsOf", () => {
  it("sends each engine the selected bindings, the declared test files and every tracked file as context", async () => {
    const runner: ParsedNamedRunner = {
      fileScope: "tracked",
      run: vi.fn(),
      conform: vi.fn(),
      project: vi.fn(),
      projectedKinds: [],
    };
    const engine: NamedEnginePort = {
      load: vi.fn<NamedEnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: runner }),
      run: vi.fn<NamedEnginePort["run"]>().mockResolvedValue({
        outcome: "failed",
        error: {
          kind: "runner-failed",
          mechanism: "walker",
          failure: { kind: "tool-failed", detail: "stopped" },
        },
      }),
      project: vi.fn<NamedEnginePort["project"]>(),
    };

    await namedEngineRunsOf({
      settings: {
        selection: { selected: [{ binding: BINDING }] },
        eslintConfigLookup: { lookup: "detected" },
        conventions: { testFiles: { suffixes: ["spec"], folders: ["__tests__"] } },
      },
      repoRoot: REPO,
      installRoot: INSTALL,
      moduleExtension: ".ts",
      path: { join: vi.fn<PathPort["join"]>() },
      modules: { load: vi.fn() },
      engine,
      checks: [CHECK],
      answered: [],
      tree: { tracked: [TYPESCRIPT, MANIFEST], declaredConfigRoots: [] },
    });

    expect(engine.load).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ mechanism: "walker" }),
    );
    expect(engine.run).toHaveBeenCalledExactlyOnceWith({
      mechanism: "walker",
      runner,
      request: {
        repoRoot: REPO,
        installRoot: INSTALL,
        files: [TYPESCRIPT],
        trackedPaths: [TYPESCRIPT, MANIFEST],
        checks: [CHECK],
        bindings: [BINDING],
        answered: [],
        declaredConfigRoots: [],
        declaredConfigLookup: undefined,
        testFiles: { suffixes: ["spec"], folders: ["__tests__"] },
      },
    });
  });

  it("gives back each engine's run", async () => {
    const measured: NamedEngineRun = {
      mechanism: "walker",
      coverableKinds: [],
      projection: "none",
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
      hits: [],
      nativeExceptions: [],
      measured: [{ check: "held-value#named-check", file: TYPESCRIPT }],
    };
    const engine: NamedEnginePort = {
      load: vi.fn<NamedEnginePort["load"]>().mockResolvedValue({
        outcome: "ok",
        value: {
          fileScope: "tracked",
          run: vi.fn(),
          conform: vi.fn(),
          project: vi.fn(),
          projectedKinds: [],
        },
      }),
      run: vi.fn<NamedEnginePort["run"]>().mockResolvedValue({ outcome: "ok", value: measured }),
      project: vi.fn<NamedEnginePort["project"]>(),
    };

    const report = await namedEngineRunsOf({
      settings: {
        selection: { selected: [{ binding: BINDING }] },
        eslintConfigLookup: { lookup: "detected" },
        conventions: { testFiles: { suffixes: ["spec"], folders: ["__tests__"] } },
      },
      repoRoot: REPO,
      installRoot: INSTALL,
      moduleExtension: ".ts",
      path: { join: vi.fn<PathPort["join"]>() },
      modules: { load: vi.fn() },
      engine,
      checks: [CHECK],
      answered: [],
      tree: { tracked: [TYPESCRIPT], declaredConfigRoots: [] },
    });

    expect(report).toEqual({ outcome: "ok", value: [measured] });
  });
});
