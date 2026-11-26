import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { NamedEnginePort } from "../../ports/engine/engine-port.ts";
import type {
  EngineCheck,
  NamedEngineRun,
  ParsedNamedRunner,
} from "../../ports/engine/engine-run.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { mapEnginesRequestToRunRequest, namedEngineRunsOf } from "./named-engines-run.ts";

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

describe("mapEnginesRequestToRunRequest", () => {
  it("judges the TypeScript among the tracked files, leaving the config lookup to the engine when none is declared", () => {
    const mapped = mapEnginesRequestToRunRequest({
      repoRoot: REPO,
      installRoot: INSTALL,
      tree: { tracked: [TYPESCRIPT, MANIFEST], declaredConfigRoots: [] },
      settings: {
        selection: { selected: [] },
        eslintConfigLookup: { lookup: "detected" },
        conventions: { testFiles: { suffixes: ["test"], folders: [] } },
      },
      checks: [CHECK],
      answered: [],
    });

    expect(mapped).toEqual({
      repoRoot: REPO,
      installRoot: INSTALL,
      files: [TYPESCRIPT],
      trackedPaths: [TYPESCRIPT, MANIFEST],
      checks: [CHECK],
      bindings: [],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      testFiles: { suffixes: ["test"], folders: [] },
    });
  });

  it("hands on the declared config lookup", () => {
    const mapped = mapEnginesRequestToRunRequest({
      repoRoot: REPO,
      installRoot: INSTALL,
      tree: { tracked: [], declaredConfigRoots: [] },
      settings: {
        selection: { selected: [] },
        eslintConfigLookup: { lookup: "declared", value: "nearest-to-file" },
        conventions: { testFiles: { suffixes: ["test"], folders: [] } },
      },
      checks: [],
      answered: [],
    });

    expect(mapped).toEqual({
      repoRoot: REPO,
      installRoot: INSTALL,
      files: [],
      trackedPaths: [],
      checks: [],
      bindings: [],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: "nearest-to-file",
      testFiles: { suffixes: ["test"], folders: [] },
    });
  });

  it("passes on the selected bindings, the declared test files and the declared config roots", () => {
    const mapped = mapEnginesRequestToRunRequest({
      repoRoot: REPO,
      installRoot: INSTALL,
      tree: { tracked: [], declaredConfigRoots: [repoPathOf("packages/app")] },
      settings: {
        selection: { selected: [{ binding: BINDING }] },
        eslintConfigLookup: { lookup: "detected" },
        conventions: { testFiles: { suffixes: ["spec"], folders: ["__tests__"] } },
      },
      checks: [],
      answered: [],
    });

    expect(mapped).toEqual({
      repoRoot: REPO,
      installRoot: INSTALL,
      files: [],
      trackedPaths: [],
      checks: [],
      bindings: [BINDING],
      answered: [],
      declaredConfigRoots: [repoPathOf("packages/app")],
      declaredConfigLookup: undefined,
      testFiles: { suffixes: ["spec"], folders: ["__tests__"] },
    });
  });
});

describe("namedEngineRunsOf", () => {
  it("loads each selected engine once and runs it over the mapped request", async () => {
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
      project: vi.fn<NamedEnginePort["project"]>().mockResolvedValue({ outcome: "ok", value: [] }),
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
    expect(vi.mocked(engine.run).mock.calls).toMatchObject([
      [{ mechanism: "walker", runner, request: { files: [TYPESCRIPT] } }],
    ]);
  });

  it("runs every engine over the files no engine projects", async () => {
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
      run: vi.fn<NamedEnginePort["run"]>().mockResolvedValue({
        outcome: "failed",
        error: {
          kind: "runner-failed",
          mechanism: "walker",
          failure: { kind: "tool-failed", detail: "stopped" },
        },
      }),
      project: vi
        .fn<NamedEnginePort["project"]>()
        .mockResolvedValueOnce({ outcome: "ok", value: [] })
        .mockResolvedValueOnce({
          outcome: "ok",
          value: [{ file: repoPathOf("hone.eslint.mjs"), text: "export default [];" }],
        }),
    };

    await namedEngineRunsOf({
      settings: {
        selection: {
          selected: [{ binding: BINDING }, { binding: { ...BINDING, engine: "eslint" } }],
        },
        eslintConfigLookup: { lookup: "detected" },
        conventions: { testFiles: { suffixes: ["spec"], folders: [] } },
      },
      repoRoot: REPO,
      installRoot: INSTALL,
      moduleExtension: ".ts",
      path: { join: vi.fn<PathPort["join"]>() },
      modules: { load: vi.fn() },
      engine,
      checks: [CHECK],
      answered: [],
      tree: { tracked: [TYPESCRIPT, repoPathOf("hone.eslint.mjs")], declaredConfigRoots: [] },
    });

    expect(vi.mocked(engine.run).mock.calls).toMatchObject([
      [{ mechanism: "walker", request: { trackedPaths: [TYPESCRIPT] } }],
      [{ mechanism: "eslint", request: { trackedPaths: [TYPESCRIPT] } }],
    ]);
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
      project: vi.fn<NamedEnginePort["project"]>().mockResolvedValue({ outcome: "ok", value: [] }),
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
