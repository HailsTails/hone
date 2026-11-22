import { describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type { LoadedStandaloneRunner, RunRequest } from "../../../../application/ports/engine/runner-module.ts";
import { runMechanism } from "./standalone-mechanism-dispatch.ts";
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

const HIT_IN_A = {
  clause: CLASS_SYNTAX_OBJECT,
  file: "src/a.ts",
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

const EXPECTATION_IN_A = {
  kind: "inline-disable",
  clause: CLASS_SYNTAX_OBJECT,
  file: "src/a.ts",
  line: 2,
  text: "// @ts-expect-error legacy",
  reach: "one-clause",
};

const standaloneRunner = (request: { readonly run: LoadedStandaloneRunner["run"] }): LoadedStandaloneRunner => ({
  exceptionPath: "standalone",
  run: request.run,
  conform: vi.fn<LoadedStandaloneRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const runResolving = (returned: unknown): LoadedStandaloneRunner["run"] =>
  vi.fn<LoadedStandaloneRunner["run"]>().mockResolvedValue(returned);

const dispatchRun = (request: { readonly runner: LoadedStandaloneRunner }) =>
  runMechanism({ runner: request.runner, mechanism: WALKER, run: RUN_REQUEST });

describe("runMechanism with a standalone runner", () => {
  it("returns the runner's hits with no native exceptions, inline disables coverable and no projection", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [] } }) }) }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "audit",
        hits: [HIT_IN_A],
        nativeExceptions: [],
        coverableKinds: ["inline-disable"],
        projection: "none",
        slices: [],
        unprojectedFolders: [],
        measured: [],
      },
    });
  });

  it("returns no hits when the runner flags nothing", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [] } }) }) }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "audit", hits: [], nativeExceptions: [], coverableKinds: ["inline-disable"], projection: "none", slices: [], unprojectedFolders: [], measured: [] },
    });
  });

  it("calls run once with the run request it was given", async () => {
    const run = runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [] } });
    await dispatchRun({ runner: standaloneRunner({ run }) });
    expect(run).toHaveBeenCalledExactlyOnceWith(RUN_REQUEST);
  });

  it("passes a runner failure through unchanged", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "failed", error: { kind: "tool-failed", detail: "the parser crashed" } }),
        }),
      }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "tool-failed", detail: "the parser crashed" } });
  });

  it("is runner-invalid-output when run throws synchronously", async () => {
    const run = vi.fn<LoadedStandaloneRunner["run"]>().mockThrow(new Error("the runner threw"));
    await expect(dispatchRun({ runner: standaloneRunner({ run }) })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner threw") },
    });
  });

  it("is runner-invalid-output when run rejects", async () => {
    const run = vi.fn<LoadedStandaloneRunner["run"]>().mockRejectedValue(new Error("the runner rejected"));
    await expect(dispatchRun({ runner: standaloneRunner({ run }) })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner rejected") },
    });
  });

  it("names the { hits, nativeExceptions } shape when a runner still returns a bare list of hits", async () => {
    await expect(dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: [] }) }) })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("a standalone run's value is { hits, nativeExceptions }") },
    });
  });

  it("returns the runner's inline disables, which a standalone run can always have covered", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [EXPECTATION_IN_A] } }) }) }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "audit", hits: [], nativeExceptions: [EXPECTATION_IN_A], coverableKinds: ["inline-disable"], projection: "none", slices: [], unprojectedFolders: [], measured: [] },
    });
  });

  it("is runner-invalid-output when run returns the bare hit list a standalone run used to return", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: [HIT_IN_A] }) }) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when an inline disable names a clause the request did not hold", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [{ ...EXPECTATION_IN_A, clause: ABSTRACT_SYNTAX_OBJECT }] } }),
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a native exception names CD-14#abstract-syntax in src/a.ts, which the request did not hold") } });
  });

  it("is runner-invalid-output when an inline disable names a file that is not tracked", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [{ ...EXPECTATION_IN_A, file: "src/untracked.ts" }] } }),
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a native exception names CD-14#class-syntax in src/untracked.ts, which the request did not hold") } });
  });

  it("is runner-invalid-output when run returns a value that is not a result", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving([HIT_IN_A]) }) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when a hit's file is not a repo path", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [{ ...HIT_IN_A, file: "/repo/src/a.ts" }], nativeExceptions: [] } }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("→ at value.hits[0].file") } });
  });

  it("is runner-invalid-output when the runner returns a failure of an unknown kind", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "failed", error: { kind: "gave-up", detail: "no" } }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when a hit names a clause the request did not hold", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "ok", value: { hits: [{ ...HIT_IN_A, clause: ABSTRACT_SYNTAX_OBJECT }], nativeExceptions: [] } }),
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#abstract-syntax in src/a.ts, which the request did not hold") } });
  });

  it("accepts a hit in a tracked file that is not in files, since a standalone runner walks every tracked path", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [{ ...HIT_IN_A, file: "README.md" }], nativeExceptions: [] } }) }),
      }),
    ).resolves.toMatchObject({ outcome: "ok", value: { hits: [{ ...HIT_IN_A, file: "README.md" }] } });
  });

  it("is runner-invalid-output when a hit names a file that is not tracked", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [{ ...HIT_IN_A, file: "src/untracked.ts" }], nativeExceptions: [] } }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#class-syntax in src/untracked.ts, which the request did not hold") } });
  });
});

const MEASURED_A = { clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts" };

describe("runMechanism with a standalone runner, the pairs it measured", () => {
  it("returns each clause and file the runner says it measured, in a tracked file outside files too", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [MEASURED_A, { ...MEASURED_A, file: "README.md" }] } }),
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "audit",
        hits: [],
        nativeExceptions: [],
        coverableKinds: ["inline-disable"],
        projection: "none",
        slices: [],
        unprojectedFolders: [],
        measured: [MEASURED_A, { clause: CLASS_SYNTAX_OBJECT, file: "README.md" }],
      },
    });
  });

  it("is runner-invalid-output when a measured pair names a clause the request did not hold", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [{ ...MEASURED_A, clause: ABSTRACT_SYNTAX_OBJECT }] } }),
        }),
      }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "runner-invalid-output", detail: "a measured pair names CD-14#abstract-syntax in src/a.ts, which the request did not hold" } });
  });

  it("is runner-invalid-output when a measured pair names a file that is not tracked", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [{ ...MEASURED_A, file: "src/excluded.ts" }] } }),
        }),
      }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "runner-invalid-output", detail: "a measured pair names CD-14#class-syntax in src/excluded.ts, which the request did not hold" } });
  });
});
