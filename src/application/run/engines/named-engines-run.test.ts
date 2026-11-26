import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { TestFiles } from "../../../domain/settings/test-files.ts";
import type { NamedEnginePort } from "../../ports/engine/engine-port.ts";
import type {
  EngineCheck,
  NamedEngineRun,
  ParsedNamedRunner,
} from "../../ports/engine/engine-run.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { type NamedEnginesRequest, namedEngineRunsOf } from "./named-engines-run.ts";

const REPO = absoluteRootOf("/repo");
const INSTALL = absoluteRootOf("/install");
const TYPESCRIPT = repoPathOf("src/source.ts");
const MANIFEST = repoPathOf("package.json");
const FIRST_EDITION = editionOf("1");

const CHECK: EngineCheck = {
  name: "named-check",
  symptom: { ruleSet: TOOL_RULE_SET, name: "held-value", title: "Held value" },
  engines: [{ name: "walker" }],
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
const ESLINT_BINDING: CheckBinding = { ...BINDING, engine: "eslint" };

const ROOT_PROJECTION = repoPathOf("hone.eslint.mjs");
const ROOT_DECLARATION = repoPathOf("hone.eslint.d.mts");
const AUTHORED_DECLARATION = repoPathOf("src/hone.eslint.d.mts");
const TEST_FILES: TestFiles = { suffixes: ["spec"], folders: ["__tests__"] };

const RUNNER: ParsedNamedRunner = {
  fileScope: "tracked",
  run: vi.fn(),
  conform: vi.fn(),
  project: vi.fn(),
  outputPaths: vi.fn(),
  projectedKinds: [],
};

const STOPPED: Awaited<ReturnType<NamedEnginePort["run"]>> = {
  outcome: "failed",
  error: {
    kind: "runner-failed",
    mechanism: "walker",
    failure: { kind: "tool-failed", detail: "stopped" },
  },
};

const NO_OUTPUTS: Awaited<ReturnType<NamedEnginePort["outputPaths"]>> = {
  outcome: "ok",
  value: [],
};

const ROOT_OUTPUTS: Awaited<ReturnType<NamedEnginePort["outputPaths"]>> = {
  outcome: "ok",
  value: [ROOT_PROJECTION, ROOT_DECLARATION],
};

const WALKER_ONLY: Omit<NamedEnginesRequest, "engine" | "tree"> = {
  settings: {
    selection: { selected: [{ binding: BINDING }] },
    eslintConfigLookup: { lookup: "detected" },
    eslintProjectionKind: "ts",
    conventions: { testFiles: TEST_FILES },
  },
  repoRoot: REPO,
  installRoot: INSTALL,
  moduleExtension: ".ts",
  path: { join: vi.fn<PathPort["join"]>() },
  modules: { load: vi.fn() },
  checks: [CHECK],
  answered: [],
};

const WALKER_AND_ESLINT: Omit<NamedEnginesRequest, "engine" | "tree"> = {
  ...WALKER_ONLY,
  settings: {
    ...WALKER_ONLY.settings,
    selection: { selected: [{ binding: BINDING }, { binding: ESLINT_BINDING }] },
  },
};

const TREE_WITH_OUTPUTS = {
  tracked: [TYPESCRIPT, ROOT_PROJECTION, ROOT_DECLARATION, AUTHORED_DECLARATION, MANIFEST],
  declaredConfigRoots: [],
};

const BOTH_ENGINES_REQUEST = {
  repoRoot: REPO,
  installRoot: INSTALL,
  checks: [CHECK],
  bindings: [BINDING, ESLINT_BINDING],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
  projectionKind: "ts",
  testFiles: TEST_FILES,
};

describe("namedEngineRunsOf", () => {
  it("sends each engine the selected bindings, the declared test files, the projection kind and every tracked file as context", async () => {
    const engine: NamedEnginePort = {
      load: vi.fn<NamedEnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: RUNNER }),
      run: vi.fn<NamedEnginePort["run"]>().mockResolvedValue(STOPPED),
      project: vi.fn<NamedEnginePort["project"]>(),
      outputPaths: vi.fn<NamedEnginePort["outputPaths"]>().mockResolvedValue(NO_OUTPUTS),
    };

    await namedEngineRunsOf({
      ...WALKER_ONLY,
      engine,
      tree: { tracked: [TYPESCRIPT, MANIFEST], declaredConfigRoots: [] },
    });

    expect(engine.load).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ mechanism: "walker" }),
    );
    expect(engine.run).toHaveBeenCalledExactlyOnceWith({
      mechanism: "walker",
      runner: RUNNER,
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
        projectionKind: "ts",
        testFiles: TEST_FILES,
      },
    });
  });

  it("asks every engine for the outputs it compares over the whole tree", async () => {
    const engine: NamedEnginePort = {
      load: vi.fn<NamedEnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: RUNNER }),
      run: vi.fn<NamedEnginePort["run"]>().mockResolvedValue(STOPPED),
      project: vi.fn<NamedEnginePort["project"]>(),
      outputPaths: vi
        .fn<NamedEnginePort["outputPaths"]>()
        .mockResolvedValueOnce(NO_OUTPUTS)
        .mockResolvedValueOnce(ROOT_OUTPUTS),
    };

    await namedEngineRunsOf({ ...WALKER_AND_ESLINT, engine, tree: TREE_WITH_OUTPUTS });

    expect(vi.mocked(engine.outputPaths).mock.calls).toEqual([
      [
        {
          mechanism: "walker",
          runner: RUNNER,
          request: {
            ...BOTH_ENGINES_REQUEST,
            files: [TYPESCRIPT, ROOT_DECLARATION, AUTHORED_DECLARATION],
            trackedPaths: TREE_WITH_OUTPUTS.tracked,
          },
        },
      ],
      [
        {
          mechanism: "eslint",
          runner: RUNNER,
          request: {
            ...BOTH_ENGINES_REQUEST,
            files: [TYPESCRIPT, ROOT_DECLARATION, AUTHORED_DECLARATION],
            trackedPaths: TREE_WITH_OUTPUTS.tracked,
          },
        },
      ],
    ]);
  });

  it("leaves the outputs any engine compares out of what every engine judges, and keeps an authored file of the same name", async () => {
    const engine: NamedEnginePort = {
      load: vi.fn<NamedEnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: RUNNER }),
      run: vi.fn<NamedEnginePort["run"]>().mockResolvedValue(STOPPED),
      project: vi.fn<NamedEnginePort["project"]>(),
      outputPaths: vi
        .fn<NamedEnginePort["outputPaths"]>()
        .mockResolvedValueOnce(NO_OUTPUTS)
        .mockResolvedValueOnce(ROOT_OUTPUTS),
    };

    await namedEngineRunsOf({ ...WALKER_AND_ESLINT, engine, tree: TREE_WITH_OUTPUTS });

    expect(vi.mocked(engine.run).mock.calls).toEqual([
      [
        {
          mechanism: "walker",
          runner: RUNNER,
          request: {
            ...BOTH_ENGINES_REQUEST,
            files: [TYPESCRIPT, AUTHORED_DECLARATION],
            trackedPaths: [TYPESCRIPT, AUTHORED_DECLARATION, MANIFEST],
          },
        },
      ],
      [
        {
          mechanism: "eslint",
          runner: RUNNER,
          request: {
            ...BOTH_ENGINES_REQUEST,
            files: [TYPESCRIPT, AUTHORED_DECLARATION],
            trackedPaths: [TYPESCRIPT, AUTHORED_DECLARATION, MANIFEST],
          },
        },
      ],
    ]);
  });

  it("runs no engine when an engine cannot name the outputs it compares", async () => {
    const engine: NamedEnginePort = {
      load: vi.fn<NamedEnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: RUNNER }),
      run: vi.fn<NamedEnginePort["run"]>(),
      project: vi.fn<NamedEnginePort["project"]>(),
      outputPaths: vi.fn<NamedEnginePort["outputPaths"]>().mockResolvedValue(STOPPED),
    };

    const report = await namedEngineRunsOf({
      ...WALKER_ONLY,
      engine,
      tree: { tracked: [TYPESCRIPT], declaredConfigRoots: [] },
    });

    expect({ report, ran: vi.mocked(engine.run).mock.calls }).toEqual({ report: STOPPED, ran: [] });
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
      load: vi.fn<NamedEnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: RUNNER }),
      run: vi.fn<NamedEnginePort["run"]>().mockResolvedValue({ outcome: "ok", value: measured }),
      project: vi.fn<NamedEnginePort["project"]>(),
      outputPaths: vi.fn<NamedEnginePort["outputPaths"]>().mockResolvedValue(NO_OUTPUTS),
    };

    const report = await namedEngineRunsOf({
      ...WALKER_ONLY,
      engine,
      tree: { tracked: [TYPESCRIPT], declaredConfigRoots: [] },
    });

    expect(report).toEqual({ outcome: "ok", value: [measured] });
  });
});
