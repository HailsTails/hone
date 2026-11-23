import { describe, expect, it, vi } from "vitest";

import type { NamedEngineRunRequest } from "../../../../application/ports/engine/engine-run.ts";
import type {
  ProjectionRequest,
  RunRequest,
} from "../../../../application/ports/engine/runner-module.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type { NamedChecksRunReport, NamedChecksRunner } from "../checks/checks-runner-types.ts";
import type { EmbeddedRunner } from "../embedded/embedded-runner-module-schema.ts";
import type { StandaloneRunner } from "../runner-module/runner-module-schema.ts";
import {
  toolchainBoundNamedChecksRunner,
  toolchainBoundEmbeddedRunner,
  toolchainBoundStandaloneRunner,
} from "./toolchain-bound-runner.ts";

type Toolchain = { readonly name: "loaded-toolchain" };

const LOADED: Result<Toolchain, RunnerFailure> = {
  outcome: "ok",
  value: { name: "loaded-toolchain" },
};

const UNAVAILABLE: Result<Toolchain, RunnerFailure> = {
  outcome: "failed",
  error: {
    kind: "toolchain-unavailable",
    peers: [
      {
        packageName: "eslint",
        peer: "optional",
        supported: "^9.39.5 || ^10.15.0",
        found: "not installed",
      },
    ],
  },
};

const REPO = absoluteRootOf("/repo");

const CLAUSE: RunnerClause = {
  address: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-14"),
    clause: clauseIdOf("class-syntax"),
  },
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/eslint/CD-14",
  clauseSettings: {},
  edition: editionOf("1"),
  settings: {},
};

const RUN: RunRequest = {
  repoRoot: REPO,
  installRoot: REPO,
  files: [],
  trackedPaths: [],
  clauses: [CLAUSE],
};

const PROJECTION: ProjectionRequest = {
  repoRoot: REPO,
  installRoot: REPO,
  declaredConfigRoots: [],
  trackedPaths: [],
  clauses: [CLAUSE],
  records: [],
};

const standaloneOver = (): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: vi
    .fn<StandaloneRunner["run"]>()
    .mockResolvedValue({ outcome: "ok", value: { hits: [], nativeExceptions: [] } }),
  conform: vi.fn<StandaloneRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const embeddedOver = (): EmbeddedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: vi.fn<EmbeddedRunner["run"]>().mockResolvedValue({
    outcome: "ok",
    value: { hits: [], nativeExceptions: [], projection: "current", slices: [] },
  }),
  conform: vi.fn<EmbeddedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  project: vi.fn<EmbeddedRunner["project"]>().mockResolvedValue({
    outcome: "ok",
    value: [{ path: repoPathOf("disciplines.eslint.mjs"), effect: "written" }],
  }),
});

describe("toolchainBoundStandaloneRunner", () => {
  it("builds the runner once from the loaded toolchain and delegates every run and conform to it", async () => {
    const inner = standaloneOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => StandaloneRunner>().mockReturnValue(inner);
    const bound = toolchainBoundStandaloneRunner({ toolchain: Promise.resolve(LOADED), runnerOf });
    await bound.run(RUN);
    await bound.run(RUN);
    await bound.conform({ clause: CLAUSE, cases: [] });
    expect({
      exceptionPath: bound.exceptionPath,
      toolchains: runnerOf.mock.calls,
      run: vi.mocked(inner.run).mock.calls,
      conform: vi.mocked(inner.conform).mock.calls,
    }).toEqual({
      exceptionPath: "standalone",
      toolchains: [[{ name: "loaded-toolchain" }]],
      run: [[RUN], [RUN]],
      conform: [[{ clause: CLAUSE, cases: [] }]],
    });
  });

  it("answers run and conform with the toolchain failure and never builds the runner when the toolchain is unavailable", async () => {
    const runnerOf = vi.fn<(toolchain: Toolchain) => StandaloneRunner>();
    const bound = toolchainBoundStandaloneRunner({
      toolchain: Promise.resolve(UNAVAILABLE),
      runnerOf,
    });
    expect({
      run: await bound.run(RUN),
      conform: await bound.conform({ clause: CLAUSE, cases: [] }),
      built: runnerOf.mock.calls.length,
    }).toEqual({ run: UNAVAILABLE, conform: UNAVAILABLE, built: 0 });
  });
});

describe("toolchainBoundEmbeddedRunner", () => {
  it("declares the projected kinds it is given and delegates run, conform and project to the runner built from the toolchain", async () => {
    const inner = embeddedOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => EmbeddedRunner>().mockReturnValue(inner);
    const bound = toolchainBoundEmbeddedRunner({
      toolchain: Promise.resolve(LOADED),
      projectedKinds: ["config-override"],
      runnerOf,
    });
    expect({
      exceptionPath: bound.exceptionPath,
      projectedKinds: bound.projectedKinds,
      run: await bound.run({ ...RUN, declaredConfigRoots: [], records: [] }),
      conform: await bound.conform({ clause: CLAUSE, cases: [] }),
      project: await bound.project(PROJECTION),
      built: runnerOf.mock.calls.length,
    }).toEqual({
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: {
        outcome: "ok",
        value: { hits: [], nativeExceptions: [], projection: "current", slices: [] },
      },
      conform: { outcome: "ok", value: [] },
      project: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      built: 1,
    });
  });

  it("answers run, conform and project with the toolchain failure when the toolchain is unavailable", async () => {
    const runnerOf = vi.fn<(toolchain: Toolchain) => EmbeddedRunner>();
    const bound = toolchainBoundEmbeddedRunner({
      toolchain: Promise.resolve(UNAVAILABLE),
      projectedKinds: ["config-override"],
      runnerOf,
    });
    expect({
      run: await bound.run({ ...RUN, declaredConfigRoots: [], records: [] }),
      conform: await bound.conform({ clause: CLAUSE, cases: [] }),
      project: await bound.project(PROJECTION),
      built: runnerOf.mock.calls.length,
    }).toEqual({ run: UNAVAILABLE, conform: UNAVAILABLE, project: UNAVAILABLE, built: 0 });
  });
});

const CHECKS_RUN: NamedEngineRunRequest = {
  repoRoot: REPO,
  installRoot: REPO,
  files: [],
  trackedPaths: [],
  bindings: [],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
  testFiles: { suffixes: ["test", "spec"], folders: [] },
};

const BINDING: CheckBinding = {
  address: "authored-class-or-this#class-syntax",
  ruleSet: TOOL_RULE_SET,
  engine: "eslint",
  anchor: CLAUSE.anchor,
  pieceRoot: "/install/eslint/authored-class-or-this/class-syntax",
  checkSettings: {},
  edition: CLAUSE.edition,
  settings: {},
};

const CHECKS_REPORT: NamedChecksRunReport = {
  hits: [],
  nativeExceptions: [],
  measured: [],
  projection: "current",
  slices: [],
  nestedConfigurations: [],
  unprojectedFolders: [],
  misnamedRuleIds: [],
};

const WRITTEN = { file: repoPathOf("hone.eslint.mjs"), text: "export default [];\n" };

const checksOver = (): NamedChecksRunner => ({
  run: vi.fn<NamedChecksRunner["run"]>().mockResolvedValue({ outcome: "ok", value: CHECKS_REPORT }),
  conform: vi.fn<NamedChecksRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  project: vi
    .fn<NamedChecksRunner["project"]>()
    .mockResolvedValue({ outcome: "ok", value: [WRITTEN] }),
});

describe("toolchainBoundNamedChecksRunner", () => {
  it("declares the file scope and projected kinds it is given and delegates every run to the runner built once from the toolchain", async () => {
    const inner = checksOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => NamedChecksRunner>().mockReturnValue(inner);
    const bound = toolchainBoundNamedChecksRunner({
      toolchain: Promise.resolve(LOADED),
      fileScope: "typescript",
      projectedKinds: ["config-override"],
      runnerOf,
    });
    expect({
      fileScope: bound.fileScope,
      projectedKinds: bound.projectedKinds,
      first: await bound.run(CHECKS_RUN),
      second: await bound.run(CHECKS_RUN),
      built: runnerOf.mock.calls.length,
      delegated: vi.mocked(inner.run).mock.calls,
    }).toEqual({
      fileScope: "typescript",
      projectedKinds: ["config-override"],
      first: { outcome: "ok", value: CHECKS_REPORT },
      second: { outcome: "ok", value: CHECKS_REPORT },
      built: 1,
      delegated: [[CHECKS_RUN], [CHECKS_RUN]],
    });
  });

  it("answers run with the toolchain failure and never builds the runner when the toolchain is unavailable", async () => {
    const runnerOf = vi.fn<(toolchain: Toolchain) => NamedChecksRunner>();
    const bound = toolchainBoundNamedChecksRunner({
      toolchain: Promise.resolve(UNAVAILABLE),
      fileScope: "typescript",
      projectedKinds: ["config-override"],
      runnerOf,
    });
    expect({ run: await bound.run(CHECKS_RUN), built: runnerOf.mock.calls.length }).toEqual({
      run: UNAVAILABLE,
      built: 0,
    });
  });

  it("delegates conform to the runner built once, and answers it with the toolchain failure, building nothing, when the toolchain is unavailable", async () => {
    const inner = checksOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => NamedChecksRunner>().mockReturnValue(inner);
    const bound = toolchainBoundNamedChecksRunner({
      toolchain: Promise.resolve(LOADED),
      fileScope: "typescript",
      projectedKinds: ["config-override"],
      runnerOf,
    });
    const unbuilt = vi.fn<(toolchain: Toolchain) => NamedChecksRunner>();
    const unavailable = toolchainBoundNamedChecksRunner({
      toolchain: Promise.resolve(UNAVAILABLE),
      fileScope: "typescript",
      projectedKinds: ["config-override"],
      runnerOf: unbuilt,
    });
    expect({
      conformed: await bound.conform({ binding: BINDING, cases: [] }),
      built: runnerOf.mock.calls.length,
      delegated: vi.mocked(inner.conform).mock.calls,
      refused: await unavailable.conform({ binding: BINDING, cases: [] }),
      unbuilt: unbuilt.mock.calls.length,
    }).toEqual({
      conformed: { outcome: "ok", value: [] },
      built: 1,
      delegated: [[{ binding: BINDING, cases: [] }]],
      refused: UNAVAILABLE,
      unbuilt: 0,
    });
  });

  it("delegates project to the runner built once, and answers it with the toolchain failure, building nothing, when the toolchain is unavailable", async () => {
    const inner = checksOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => NamedChecksRunner>().mockReturnValue(inner);
    const bound = toolchainBoundNamedChecksRunner({
      toolchain: Promise.resolve(LOADED),
      fileScope: "typescript",
      projectedKinds: ["config-override"],
      runnerOf,
    });
    const unbuilt = vi.fn<(toolchain: Toolchain) => NamedChecksRunner>();
    const unavailable = toolchainBoundNamedChecksRunner({
      toolchain: Promise.resolve(UNAVAILABLE),
      fileScope: "typescript",
      projectedKinds: ["config-override"],
      runnerOf: unbuilt,
    });
    expect({
      projected: await bound.project(CHECKS_RUN),
      built: runnerOf.mock.calls.length,
      delegated: vi.mocked(inner.project).mock.calls,
      refused: await unavailable.project(CHECKS_RUN),
      unbuilt: unbuilt.mock.calls.length,
    }).toEqual({
      projected: { outcome: "ok", value: [WRITTEN] },
      built: 1,
      delegated: [[CHECKS_RUN]],
      refused: UNAVAILABLE,
      unbuilt: 0,
    });
  });
});
