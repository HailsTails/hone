import { describe, expect, it, vi } from "vitest";
import type { ChecksRunRequest, ChecksRunner } from "../checks/checks-runner-types.ts";
import type { EmbeddedRunner } from "../embedded/embedded-runner-module-schema.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { ProjectionRequest } from "../embedded/embedded-runner-module-schema.ts";
import type { RunRequest, RunnerClause, StandaloneRunner } from "../runner-module/runner-module-schema.ts";
import { toolchainBoundChecksRunner, toolchainBoundEmbeddedRunner, toolchainBoundStandaloneRunner } from "./toolchain-bound-runner.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../domain/result.ts";
import { FIRST_EDITION } from "../../../content-files/edition.ts";

type Toolchain = { readonly name: "loaded-toolchain" };

const LOADED: Result<Toolchain, RunnerFailure> = { outcome: "ok", value: { name: "loaded-toolchain" } };

const UNAVAILABLE: Result<Toolchain, RunnerFailure> = {
  outcome: "failed",
  error: { kind: "toolchain-unavailable", peers: [{ packageName: "eslint", peer: "optional", supported: "^9.39.5 || ^10.15.0", found: "not installed" }] },
};

const REPO = absolutePathSchema.parse("/repo");

const CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-14#class-syntax"),
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/eslint/CD-14",
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: {},
};

const RUN: RunRequest = { repoRoot: REPO, installRoot: REPO, files: [], trackedPaths: [], clauses: [CLAUSE] };

const PROJECTION: ProjectionRequest = { repoRoot: REPO, installRoot: REPO, declaredConfigRoots: [], trackedPaths: [], clauses: [CLAUSE], records: [] };

const standaloneOver = (): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<StandaloneRunner["run"]>().mockResolvedValue({ outcome: "ok", value: { hits: [], nativeExceptions: [] } }),
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
    value: [{ path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "written" }],
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
    const bound = toolchainBoundStandaloneRunner({ toolchain: Promise.resolve(UNAVAILABLE), runnerOf });
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
      run: { outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current", slices: [] } },
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

const CHECKS_RUN: ChecksRunRequest = { repoRoot: REPO, installRoot: REPO, files: [], trackedPaths: [], checks: [], bindings: [], answered: [], declaredConfigRoots: [], declaredConfigLookup: undefined };

const CHECKS_REPORT = { hits: [], nativeExceptions: [], measured: [], projection: "current", slices: [], misnamedRuleIds: [] } as const;

const WRITTEN = { file: repoPathSchema.parse("hone.eslint.mjs"), text: "export default [];\n" };

const checksOver = (): ChecksRunner => ({
  run: vi.fn<ChecksRunner["run"]>().mockResolvedValue({ outcome: "ok", value: CHECKS_REPORT }),
  conform: vi.fn<ChecksRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  project: vi.fn<ChecksRunner["project"]>().mockResolvedValue({ outcome: "ok", value: [WRITTEN] }),
});

describe("toolchainBoundChecksRunner", () => {
  it("declares the projected kinds it is given and delegates every run to the runner built once from the toolchain", async () => {
    const inner = checksOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => ChecksRunner>().mockReturnValue(inner);
    const bound = toolchainBoundChecksRunner({ toolchain: Promise.resolve(LOADED), projectedKinds: ["config-override"], runnerOf });
    expect({
      projectedKinds: bound.projectedKinds,
      first: await bound.run(CHECKS_RUN),
      second: await bound.run(CHECKS_RUN),
      built: runnerOf.mock.calls.length,
      delegated: vi.mocked(inner.run).mock.calls,
    }).toEqual({
      projectedKinds: ["config-override"],
      first: { outcome: "ok", value: CHECKS_REPORT },
      second: { outcome: "ok", value: CHECKS_REPORT },
      built: 1,
      delegated: [[CHECKS_RUN], [CHECKS_RUN]],
    });
  });

  it("answers run with the toolchain failure and never builds the runner when the toolchain is unavailable", async () => {
    const runnerOf = vi.fn<(toolchain: Toolchain) => ChecksRunner>();
    const bound = toolchainBoundChecksRunner({ toolchain: Promise.resolve(UNAVAILABLE), projectedKinds: ["config-override"], runnerOf });
    expect({ run: await bound.run(CHECKS_RUN), built: runnerOf.mock.calls.length }).toEqual({ run: UNAVAILABLE, built: 0 });
  });

  it("delegates conform to the runner built once, and answers it with the toolchain failure, building nothing, when the toolchain is unavailable", async () => {
    const inner = checksOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => ChecksRunner>().mockReturnValue(inner);
    const bound = toolchainBoundChecksRunner({ toolchain: Promise.resolve(LOADED), projectedKinds: ["config-override"], runnerOf });
    const unbuilt = vi.fn<(toolchain: Toolchain) => ChecksRunner>();
    const unavailable = toolchainBoundChecksRunner({ toolchain: Promise.resolve(UNAVAILABLE), projectedKinds: ["config-override"], runnerOf: unbuilt });
    expect({
      conformed: await bound.conform({ clause: CLAUSE, cases: [] }),
      built: runnerOf.mock.calls.length,
      delegated: vi.mocked(inner.conform).mock.calls,
      refused: await unavailable.conform({ clause: CLAUSE, cases: [] }),
      unbuilt: unbuilt.mock.calls.length,
    }).toEqual({ conformed: { outcome: "ok", value: [] }, built: 1, delegated: [[{ clause: CLAUSE, cases: [] }]], refused: UNAVAILABLE, unbuilt: 0 });
  });

  it("delegates project to the runner built once, and answers it with the toolchain failure, building nothing, when the toolchain is unavailable", async () => {
    const inner = checksOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => ChecksRunner>().mockReturnValue(inner);
    const bound = toolchainBoundChecksRunner({ toolchain: Promise.resolve(LOADED), projectedKinds: ["config-override"], runnerOf });
    const unbuilt = vi.fn<(toolchain: Toolchain) => ChecksRunner>();
    const unavailable = toolchainBoundChecksRunner({ toolchain: Promise.resolve(UNAVAILABLE), projectedKinds: ["config-override"], runnerOf: unbuilt });
    expect({
      projected: await bound.project(CHECKS_RUN),
      built: runnerOf.mock.calls.length,
      delegated: vi.mocked(inner.project).mock.calls,
      refused: await unavailable.project(CHECKS_RUN),
      unbuilt: unbuilt.mock.calls.length,
    }).toEqual({ projected: { outcome: "ok", value: [WRITTEN] }, built: 1, delegated: [[CHECKS_RUN]], refused: UNAVAILABLE, unbuilt: 0 });
  });
});
