import { describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type { LoadedRunner, RunRequest } from "../../../../application/ports/engine/runner-module.ts";
import { runnerModuleSchema } from "../runner-module/runner-module-schema.ts";
import type { ExceptionRecord } from "../../../../domain/records/discipline-exceptions/exception-record.ts";
import { projectMechanism, runMechanismWithRecords } from "./embedded-mechanism-dispatch.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";

const WALKER = "audit" as const;
const REPO_ROOT = absoluteRootOf("/repo");
const INSTALL_ROOT = absoluteRootOf("/install");
const CLASS_SYNTAX = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") };
const CLASS_SYNTAX_OBJECT = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };
const ABSTRACT_SYNTAX_OBJECT = { ruleSet: "hone", discipline: "CD-14", clause: "abstract-syntax" };

const CLASS_SYNTAX_CLAUSE: RunnerClause = {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/audit/CD-14",
  clauseSettings: {},
  edition: editionOf("1"),
  settings: { module: "class-syntax.ts" },
};

const RUN_REQUEST: RunRequest = {
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  files: [repoPathOf("src/a.ts"), repoPathOf("src/b.ts")],
  trackedPaths: [repoPathOf("README.md"), repoPathOf("src/a.ts"), repoPathOf("src/b.ts")],
  clauses: [CLASS_SYNTAX_CLAUSE],
};

const CARVE_OUT: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/mechanism-dispatch.test.ts#CARVE_OUT; not historical authorisation" },
  clause: CLASS_SYNTAX,
  mechanism: WALKER,
  file: repoPathOf("src/a.ts"),
  reason: "the wrapping factory for the library",
};

const HIT_IN_A = {
  clause: CLASS_SYNTAX_OBJECT,
  file: "src/a.ts",
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

const standaloneRunner = (request: { readonly run: LoadedRunner["run"] }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: request.run,
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const runResolving = (returned: unknown): LoadedRunner["run"] =>
  vi.fn<LoadedRunner["run"]>().mockResolvedValue(returned);

describe("runMechanismWithRecords with a standalone runner", () => {
  it("runs it as runMechanism does", async () => {
    const run = runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [] } });
    const mechanismRun = await runMechanismWithRecords({
      runner: standaloneRunner({ run }),
      mechanism: WALKER,
      run: RUN_REQUEST,
      declaredConfigRoots: [],
      records: [CARVE_OUT],
    });
    expect({ mechanismRun, runCalls: vi.mocked(run).mock.calls }).toEqual({
      mechanismRun: {
        outcome: "ok",
        value: { mechanism: WALKER, hits: [], nativeExceptions: [], coverableKinds: ["inline-disable"], projection: "none", slices: [], unprojectedFolders: [], measured: [] },
      },
      runCalls: [[RUN_REQUEST]],
    });
  });
});

describe("projectMechanism with a standalone runner", () => {
  it("returns no projection writes without calling run or conform", async () => {
    const runner = standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [] } }) });
    const writes = await projectMechanism({
      runner,
      request: { repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, declaredConfigRoots: [], trackedPaths: [], clauses: [CLASS_SYNTAX_CLAUSE], records: [] },
    });
    expect({ writes, runCalls: vi.mocked(runner.run).mock.calls, conformCalls: vi.mocked(runner.conform).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [] },
      runCalls: [],
      conformCalls: [],
    });
  });
});

const ESLINT = "eslint" as const;

const ESLINT_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/mechanism-dispatch.test.ts#ESLINT_LOCATION; not historical authorisation" },
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: repoPathOf("src/a.ts"),
  reason: "the wrapping factory for the library",
};

const IGNORED_B = { kind: "ignore", clause: CLASS_SYNTAX_OBJECT, file: "src/b.ts" };

const SLICE_WRITES = [
  { path: "disciplines.eslint.mjs", effect: "unchanged" },
  { path: "packages/a/disciplines.eslint.mjs", effect: "written" },
  { path: "packages/old/disciplines.eslint.mjs", effect: "removed" },
  { path: "packages/hand/disciplines.eslint.mjs", effect: "left-in-place" },
];

const PROJECTION_REQUEST = {
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  declaredConfigRoots: [],
  trackedPaths: [],
  clauses: [CLASS_SYNTAX_CLAUSE],
  records: [ESLINT_LOCATION],
};

type EmbeddedCall = (request: unknown) => Promise<unknown>;

const embeddedResolving = (returned: unknown) => vi.fn<EmbeddedCall>().mockResolvedValue(returned);

const embeddedRunner = (request: { readonly run: EmbeddedCall; readonly project: EmbeddedCall }): LoadedRunner =>
  runnerModuleSchema.parse({
    exceptionPath: "embedded",
    projectedKinds: ["config-override"],
    run: request.run,
    conform: embeddedResolving({ outcome: "ok", value: [] }),
    project: request.project,
  });

const UNCALLED_PROJECT = embeddedResolving({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] });

const dispatchEmbeddedRun = (request: { readonly run: EmbeddedCall }) =>
  runMechanismWithRecords({
    runner: embeddedRunner({ run: request.run, project: UNCALLED_PROJECT }),
    mechanism: ESLINT,
    run: RUN_REQUEST,
    declaredConfigRoots: [],
    records: [ESLINT_LOCATION],
  });

const UNCALLED_RUN = embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } });

const dispatchEmbeddedProject = (request: { readonly project: EmbeddedCall }) =>
  projectMechanism({
    runner: embeddedRunner({ run: UNCALLED_RUN, project: request.project }),
    request: PROJECTION_REQUEST,
  });

const MEASURED_A = { clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts" };

describe("runMechanismWithRecords with an embedded runner", () => {
  it("returns the report's hits, native exceptions and projection with the runner's projected kinds", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [HIT_IN_A], nativeExceptions: [IGNORED_B], projection: "current" },
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [HIT_IN_A],
        nativeExceptions: [IGNORED_B],
        coverableKinds: ["config-override"],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: [],
      },
    });
  });

  it("returns a not-included projection with its empty lists", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "not-included" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "eslint", hits: [], nativeExceptions: [], coverableKinds: ["config-override"], projection: "not-included", slices: [], unprojectedFolders: [], measured: [] },
    });
  });

  it("returns a missing projection with its empty lists", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "missing" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "eslint", hits: [], nativeExceptions: [], coverableKinds: ["config-override"], projection: "missing", slices: [], unprojectedFolders: [], measured: [] },
    });
  });

  it("returns an out-of-date projection beside the report's hits", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [], projection: "out-of-date" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [HIT_IN_A],
        nativeExceptions: [],
        coverableKinds: ["config-override"],
        projection: "out-of-date",
        slices: [],
        unprojectedFolders: [],
        measured: [],
      },
    });
  });

  it("calls run once with the run request and the mechanism's records, and never calls project", async () => {
    const run = embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } });
    const project = embeddedResolving({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] });
    await runMechanismWithRecords({
      runner: embeddedRunner({ run, project }),
      mechanism: ESLINT,
      run: RUN_REQUEST,
      declaredConfigRoots: [],
      records: [ESLINT_LOCATION],
    });
    expect({ runCalls: run.mock.calls, projectCalls: project.mock.calls }).toEqual({
      runCalls: [[{ ...RUN_REQUEST, declaredConfigRoots: [], records: [ESLINT_LOCATION] }]],
      projectCalls: [],
    });
  });

  it("passes a runner failure through unchanged", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "failed", error: { kind: "plugin-conflict", detail: "Cannot redefine plugin" } }),
      }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "plugin-conflict", detail: "Cannot redefine plugin" } });
  });

  it("is runner-invalid-output when run throws synchronously", async () => {
    await expect(
      dispatchEmbeddedRun({ run: vi.fn<EmbeddedCall>().mockThrow(new Error("the runner threw")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner threw") } });
  });

  it("is runner-invalid-output when run rejects", async () => {
    await expect(
      dispatchEmbeddedRun({ run: vi.fn<EmbeddedCall>().mockRejectedValue(new Error("the runner rejected")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner rejected") } });
  });

  it("is runner-invalid-output when run returns a standalone hit list instead of a report", async () => {
    await expect(
      dispatchEmbeddedRun({ run: embeddedResolving({ outcome: "ok", value: [HIT_IN_A] }) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when the report's projection is the standalone none", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "none" } }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when a native exception has an unknown kind", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: {
            hits: [],
            nativeExceptions: [{ kind: "baseline", clause: CLASS_SYNTAX_OBJECT, file: "src/b.ts" }],
            projection: "current",
          },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when a hit names a clause the request did not hold", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [{ ...HIT_IN_A, clause: ABSTRACT_SYNTAX_OBJECT }], nativeExceptions: [], projection: "current" },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#abstract-syntax in src/a.ts, which the request did not hold") } });
  });

  it("is runner-invalid-output when a hit names a tracked file that is not in files", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [{ ...HIT_IN_A, file: "README.md" }], nativeExceptions: [], projection: "current" },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#class-syntax in README.md, which the request did not hold") } });
  });
});

describe("runMechanismWithRecords with an embedded runner, the pairs it measured", () => {
  it("returns each clause and file the runner says it measured", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current", measured: [MEASURED_A] } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [],
        nativeExceptions: [],
        coverableKinds: ["config-override"],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: [MEASURED_A],
      },
    });
  });

  it("is runner-invalid-output when a measured pair names a tracked file that is not in files", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [], nativeExceptions: [], projection: "current", measured: [{ ...MEASURED_A, file: "README.md" }] },
        }),
      }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "runner-invalid-output", detail: "a measured pair names CD-14#class-syntax in README.md, which the request did not hold" } });
  });
});

describe("projectMechanism with an embedded runner", () => {
  it("returns the runner's projection writes, one per slice it wrote, kept or removed", async () => {
    await expect(
      dispatchEmbeddedProject({ project: embeddedResolving({ outcome: "ok", value: SLICE_WRITES }) }),
    ).resolves.toEqual({ outcome: "ok", value: SLICE_WRITES });
  });

  it("calls project once with the projection request and never calls run", async () => {
    const run = embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } });
    const project = embeddedResolving({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] });
    await projectMechanism({ runner: embeddedRunner({ run, project }), request: PROJECTION_REQUEST });
    expect({ projectCalls: project.mock.calls, runCalls: run.mock.calls }).toEqual({
      projectCalls: [[PROJECTION_REQUEST]],
      runCalls: [],
    });
  });

  it("passes a runner failure through unchanged", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({
          outcome: "failed",
          error: { kind: "file-unreadable", file: "disciplines.eslint.mjs", detail: "EACCES" },
        }),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "disciplines.eslint.mjs", detail: "EACCES" },
    });
  });

  it("is runner-invalid-output when project throws synchronously", async () => {
    await expect(
      dispatchEmbeddedProject({ project: vi.fn<EmbeddedCall>().mockThrow(new Error("the projection threw")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the projection threw") } });
  });

  it("is runner-invalid-output when project rejects", async () => {
    await expect(
      dispatchEmbeddedProject({ project: vi.fn<EmbeddedCall>().mockRejectedValue(new Error("the projection rejected")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the projection rejected") } });
  });

  it("is runner-invalid-output when the write's path is not a repo path", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({ outcome: "ok", value: [{ path: "/repo/disciplines.eslint.mjs", effect: "written" }] }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("→ at value[0].path") } });
  });

  it("is runner-invalid-output when project returns one write instead of a list", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({ outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });
});

describe("runMechanismWithRecords with an embedded runner, native exceptions against the request", () => {
  it("is runner-invalid-output when a native exception names a clause the request did not hold", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: {
            hits: [],
            nativeExceptions: [{ kind: "ignore", clause: ABSTRACT_SYNTAX_OBJECT, file: "src/b.ts" }],
            projection: "current",
          },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a native exception names CD-14#abstract-syntax, which the request did not hold") } });
  });

  it("returns a native exception whose file is not among the files under check", async () => {
    const suppression = {
      kind: "suppression-entry",
      clause: CLASS_SYNTAX_OBJECT,
      file: "src/legacy.js",
      location: "eslint-suppressions.json",
    };
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [suppression], projection: "current" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [],
        nativeExceptions: [suppression],
        coverableKinds: ["config-override"],
        projection: "current",
        slices: [],
        unprojectedFolders: [],
        measured: [],
      },
    });
  });
});
