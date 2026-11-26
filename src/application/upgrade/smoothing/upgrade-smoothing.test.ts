import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type { SmoothingCommands } from "../../ports/upgrade/smoothing-commands.ts";
import type { ProofQueries } from "../proof-writes/proof-writes.ts";
import { runSmoothing } from "./upgrade-smoothing.ts";

const EMPTY_CHANGES = { write: [], remove: [] };

const commandsWith = (overrides: Partial<SmoothingCommands>): SmoothingCommands => ({
  project: vi
    .fn<SmoothingCommands["project"]>()
    .mockResolvedValue({ outcome: "ok", value: EMPTY_CHANGES }),
  removeCarried: vi
    .fn<SmoothingCommands["removeCarried"]>()
    .mockResolvedValue({ outcome: "ok", value: { changes: EMPTY_CHANGES, done: [] } }),
  recordDebt: vi
    .fn<SmoothingCommands["recordDebt"]>()
    .mockResolvedValue({ outcome: "ok", value: { changes: EMPTY_CHANGES, done: [] } }),
  pruneDebt: vi
    .fn<SmoothingCommands["pruneDebt"]>()
    .mockResolvedValue({ outcome: "ok", value: { changes: EMPTY_CHANGES, done: [] } }),
  ...overrides,
});

const queryWith = (
  request: Partial<{
    readonly read: FileTextPort["read"];
    readonly kindOf: EntryKindPort["kindOf"];
    readonly join: PathPort["join"];
    readonly directoryOf: PathPort["directoryOf"];
  }>,
): ProofQueries => ({
  fileText: { read: request.read ?? vi.fn(), exists: vi.fn() },
  entryKind: { kindOf: request.kindOf ?? vi.fn() },
  path: {
    join: request.join ?? vi.fn(),
    relative: vi.fn(),
    directoryOf: request.directoryOf ?? vi.fn(),
  },
});

const createFilesAt = (request: {
  readonly root: string;
  readonly files: readonly string[];
}): ProofQueries => {
  const absences = new Map(
    request.files.map((file) => [`${request.root}/${file}`, "absent"] as const),
  );
  return queryWith({
    kindOf: ({ path }) => absences.get(path) ?? "directory",
    join: ({ segments }) => segments.join("/"),
    directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValue(request.root),
  });
};

const addedFile = (path: string, text: string): ReturnType<ProofEffects["apply"]> => ({
  outcome: "all-applied",
  settled: [
    { effect: { kind: "create-file", path: absoluteRootOf(path), text }, outcome: "applied" },
  ],
});

const projectionWriting = (
  file: string,
  text: string,
): Awaited<ReturnType<SmoothingCommands["project"]>> => ({
  outcome: "ok",
  value: { write: [{ file: repoPathOf(file), text }], remove: [] },
});

describe("runSmoothing", () => {
  it("projects, removes carried records that answer nothing, projects, records debt, projects, prunes debt and projects, each over the files written so far", async () => {
    const settings = repoPathOf("hone.config.json");
    const firstProjected = repoPathOf("a.mjs");
    const secondProjected = repoPathOf("b.mjs");
    const thirdProjected = repoPathOf("c.mjs");
    const commands = commandsWith({
      project: vi
        .fn<SmoothingCommands["project"]>()
        .mockResolvedValueOnce(projectionWriting("a.mjs", "a"))
        .mockResolvedValueOnce(projectionWriting("b.mjs", "b"))
        .mockResolvedValueOnce(projectionWriting("c.mjs", "c"))
        .mockResolvedValueOnce(projectionWriting("d.mjs", "d")),
    });
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(addedFile("/repo/a.mjs", "a"))
      .mockReturnValueOnce(addedFile("/repo/b.mjs", "b"))
      .mockReturnValueOnce(addedFile("/repo/c.mjs", "c"))
      .mockReturnValueOnce(addedFile("/repo/d.mjs", "d"));

    await runSmoothing({
      queries: createFilesAt({ root: "/repo", files: ["a.mjs", "b.mjs", "c.mjs", "d.mjs"] }),
      effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
      commands,
      repoRoot: absoluteRootOf("/repo"),
      writes: [],
      written: [settings],
    });

    expect({
      projectedOver: vi.mocked(commands.project).mock.calls,
      removedOver: vi.mocked(commands.removeCarried).mock.calls,
      recordedOver: vi.mocked(commands.recordDebt).mock.calls,
      prunedOver: vi.mocked(commands.pruneDebt).mock.calls,
    }).toEqual({
      projectedOver: [
        [{ written: [settings] }],
        [{ written: [settings, firstProjected] }],
        [{ written: [settings, firstProjected, secondProjected] }],
        [{ written: [settings, firstProjected, secondProjected, thirdProjected] }],
      ],
      removedOver: [[{ written: [settings, firstProjected] }]],
      recordedOver: [[{ written: [settings, firstProjected, secondProjected] }]],
      prunedOver: [[{ written: [settings, firstProjected, secondProjected, thirdProjected] }]],
    });
  });

  it("applies the files a step writes, hands them to every later step, and keeps what the step did", async () => {
    const debtFile = repoPathOf("hone-records/debt/loop-keyword.json");
    const debtPath = absoluteRootOf("/repo/hone-records/debt/loop-keyword.json");
    const recorded = {
      address: "loop-keyword#loops",
      file: repoPathOf("src/c.ts"),
      ruleSet: TOOL_RULE_SET,
      effect: "recorded",
    } as const;
    const commands = commandsWith({
      recordDebt: vi.fn<SmoothingCommands["recordDebt"]>().mockResolvedValue({
        outcome: "ok",
        value: {
          changes: { write: [{ file: debtFile, text: "the debt" }], remove: [] },
          done: [recorded],
        },
      }),
    });
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(addedFile(debtPath, "the debt"));
    const settings = repoPathOf("hone.config.json");

    const smoothed = await runSmoothing({
      queries: queryWith({
        kindOf: vi
          .fn<EntryKindPort["kindOf"]>()
          .mockReturnValueOnce("absent")
          .mockReturnValueOnce("absent")
          .mockReturnValueOnce("directory"),
        join: vi.fn<PathPort["join"]>().mockReturnValueOnce(debtPath),
        directoryOf: vi
          .fn<PathPort["directoryOf"]>()
          .mockReturnValueOnce("/repo/hone-records/debt"),
      }),
      effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
      commands,
      repoRoot: absoluteRootOf("/repo"),
      writes: [],
      written: [settings],
    });

    expect({
      smoothed,
      applied: apply.mock.calls,
      prunedOver: vi.mocked(commands.pruneDebt).mock.calls,
    }).toEqual({
      smoothed: {
        outcome: "ok",
        value: {
          writes: [{ kind: "file-created", path: debtPath }],
          written: [settings, debtFile],
          smoothed: {
            removedCarried: [],
            recordedDebt: [recorded],
            prunedDebt: [],
            projected: [],
          },
        },
      },
      applied: [[{ effects: [{ kind: "create-file", path: debtPath, text: "the debt" }] }]],
      prunedOver: [[{ written: [settings, debtFile] }]],
    });
  });

  it("stops at a prune-debt that finds the projection stale, runs no later step, and undoes what was written", async () => {
    const stale = {
      kind: "run-failed",
      failure: {
        kind: "projection-stale",
        problem: {
          scope: "projection",
          engine: { name: "eslint" },
          state: "out-of-date",
          file: repoPathOf("hone.eslint.mjs"),
        },
        projectCommand: "hone project --repo /repo",
      },
    } as const;
    const commands = commandsWith({
      pruneDebt: vi
        .fn<SmoothingCommands["pruneDebt"]>()
        .mockResolvedValue({ outcome: "failed", error: stale }),
    });
    const originalSettings = {
      kind: "file-created",
      path: absoluteRootOf("/repo/hone.config.json"),
    } as const;
    const recordsDirectory = {
      kind: "directory-created",
      path: absoluteRootOf("/repo/hone-records"),
    } as const;
    const unrestored = [
      { written: "file-created", path: originalSettings.path, detail: "EBUSY" },
    ] as const;
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValueOnce(unrestored);

    const smoothed = await runSmoothing({
      queries: queryWith({}),
      effects: { apply: vi.fn<ProofEffects["apply"]>(), undo },
      commands,
      repoRoot: absoluteRootOf("/repo"),
      writes: [recordsDirectory, originalSettings],
      written: [repoPathOf("hone.config.json")],
    });

    expect({
      smoothed,
      projectedOver: vi.mocked(commands.project).mock.calls,
      undone: undo.mock.calls,
    }).toEqual({
      smoothed: {
        outcome: "failed",
        error: {
          kind: "smoothing-failed",
          step: "prune-debt",
          failure: stale,
          unrestored,
          removedByVersionOne: [],
        },
      },
      projectedOver: [
        [{ written: [repoPathOf("hone.config.json")] }],
        [{ written: [repoPathOf("hone.config.json")] }],
        [{ written: [repoPathOf("hone.config.json")] }],
      ],
      undone: [[{ writes: [originalSettings, recordsDirectory] }]],
    });
  });

  it("names a command that throws as the step's failed run", async () => {
    const nothing = { write: [], remove: [] };
    const commands: SmoothingCommands = {
      project: vi
        .fn<SmoothingCommands["project"]>()
        .mockResolvedValue({ outcome: "ok", value: nothing }),
      removeCarried: vi
        .fn<SmoothingCommands["removeCarried"]>()
        .mockRejectedValue(new Error("the run threw")),
      recordDebt: vi.fn<SmoothingCommands["recordDebt"]>(),
      pruneDebt: vi.fn<SmoothingCommands["pruneDebt"]>(),
    };

    const smoothed = await runSmoothing({
      queries: {
        fileText: { read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>() },
        entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
        path: {
          join: vi.fn<PathPort["join"]>(),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>(),
        },
      },
      effects: {
        apply: vi.fn<ProofEffects["apply"]>(),
        undo: vi.fn<ProofEffects["undo"]>().mockReturnValueOnce([]),
      },
      commands,
      repoRoot: absoluteRootOf("/repo"),
      writes: [],
      written: [],
    });

    expect(smoothed).toEqual({
      outcome: "failed",
      error: {
        kind: "smoothing-failed",
        step: "remove-carried",
        failure: {
          kind: "run-failed",
          failure: { kind: "unexpected-error", detail: "the run threw" },
        },
        unrestored: [],
        removedByVersionOne: [],
      },
    });
  });

  it("undoes what was written, the step's attempt included, when applying a step's files stops", async () => {
    const debtPath = absoluteRootOf("/repo/hone-records/debt/loop-keyword.json");
    const commands = commandsWith({
      project: vi
        .fn<SmoothingCommands["project"]>()
        .mockResolvedValue(projectionWriting("hone-records/debt/loop-keyword.json", "new")),
    });
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValueOnce([]);

    const smoothed = await runSmoothing({
      queries: queryWith({
        read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: "old" }),
        kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file"),
        join: vi.fn<PathPort["join"]>().mockReturnValueOnce(debtPath),
      }),
      effects: {
        apply: vi.fn<ProofEffects["apply"]>().mockReturnValueOnce({
          outcome: "stopped",
          settled: [],
          stopped: {
            effect: { kind: "replace-file", path: debtPath, text: "new", original: "old" },
            outcome: "failed",
            detail: "EPERM",
          },
        }),
        undo,
      },
      commands,
      repoRoot: absoluteRootOf("/repo"),
      writes: [{ kind: "file-created", path: absoluteRootOf("/repo/hone.config.json") }],
      written: [],
    });

    expect({ smoothed, undone: undo.mock.calls }).toEqual({
      smoothed: {
        outcome: "failed",
        error: {
          kind: "write-refused",
          refusal: {
            failure: { kind: "unwritable", path: debtPath, detail: "EPERM" },
            unrestored: [],
          },
          removedByVersionOne: [],
        },
      },
      undone: [
        [
          {
            writes: [
              { kind: "file-replaced", path: debtPath, original: "old" },
              { kind: "file-created", path: absoluteRootOf("/repo/hone.config.json") },
            ],
          },
        ],
      ],
    });
  });
});
