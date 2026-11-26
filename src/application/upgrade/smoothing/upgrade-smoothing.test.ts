import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type { SmoothingCommands } from "../../ports/upgrade/smoothing-commands.ts";
import { runSmoothing } from "./upgrade-smoothing.ts";

describe("runSmoothing", () => {
  it("projects, removes carried records that answer nothing, projects, records debt, projects, prunes debt and projects, each over the files written so far", async () => {
    const nothing = { write: [], remove: [] };
    const settings = repoPathOf("hone.config.json");
    const firstProjected = repoPathOf("a.mjs");
    const secondProjected = repoPathOf("b.mjs");
    const thirdProjected = repoPathOf("c.mjs");
    const commands: SmoothingCommands = {
      project: vi
        .fn<SmoothingCommands["project"]>()
        .mockResolvedValueOnce({
          outcome: "ok",
          value: { write: [{ file: repoPathOf("a.mjs"), text: "a" }], remove: [] },
        })
        .mockResolvedValueOnce({
          outcome: "ok",
          value: { write: [{ file: repoPathOf("b.mjs"), text: "b" }], remove: [] },
        })
        .mockResolvedValueOnce({
          outcome: "ok",
          value: { write: [{ file: repoPathOf("c.mjs"), text: "c" }], remove: [] },
        })
        .mockResolvedValueOnce({
          outcome: "ok",
          value: { write: [{ file: repoPathOf("d.mjs"), text: "d" }], remove: [] },
        }),
      removeCarried: vi
        .fn<SmoothingCommands["removeCarried"]>()
        .mockResolvedValue({ outcome: "ok", value: { changes: nothing, done: [] } }),
      recordDebt: vi
        .fn<SmoothingCommands["recordDebt"]>()
        .mockResolvedValue({ outcome: "ok", value: { changes: nothing, done: [] } }),
      pruneDebt: vi
        .fn<SmoothingCommands["pruneDebt"]>()
        .mockResolvedValue({ outcome: "ok", value: { changes: nothing, done: [] } }),
    };
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce({
        outcome: "all-applied",
        settled: [
          {
            effect: { kind: "create-file", path: absoluteRootOf("/repo/a.mjs"), text: "a" },
            outcome: "applied",
          },
        ],
      })
      .mockReturnValueOnce({
        outcome: "all-applied",
        settled: [
          {
            effect: { kind: "create-file", path: absoluteRootOf("/repo/b.mjs"), text: "b" },
            outcome: "applied",
          },
        ],
      })
      .mockReturnValueOnce({
        outcome: "all-applied",
        settled: [
          {
            effect: { kind: "create-file", path: absoluteRootOf("/repo/c.mjs"), text: "c" },
            outcome: "applied",
          },
        ],
      })
      .mockReturnValueOnce({
        outcome: "all-applied",
        settled: [
          {
            effect: { kind: "create-file", path: absoluteRootOf("/repo/d.mjs"), text: "d" },
            outcome: "applied",
          },
        ],
      });

    await runSmoothing({
      queries: {
        fileText: { read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>() },
        entryKind: {
          kindOf: vi
            .fn<EntryKindPort["kindOf"]>()
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("directory")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("directory")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("directory")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("directory"),
        },
        path: {
          join: vi
            .fn<PathPort["join"]>()
            .mockReturnValueOnce("/repo/a.mjs")
            .mockReturnValueOnce("/repo/b.mjs")
            .mockReturnValueOnce("/repo/c.mjs")
            .mockReturnValueOnce("/repo/d.mjs"),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValue("/repo"),
        },
      },
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
    const nothing = { write: [], remove: [] };
    const debtFile = repoPathOf("hone-records/debt/loop-keyword.json");
    const debtPath = absoluteRootOf("/repo/hone-records/debt/loop-keyword.json");
    const recorded = {
      address: "loop-keyword#loops",
      file: repoPathOf("src/c.ts"),
      ruleSet: TOOL_RULE_SET,
      effect: "recorded",
    } as const;
    const commands: SmoothingCommands = {
      project: vi
        .fn<SmoothingCommands["project"]>()
        .mockResolvedValue({ outcome: "ok", value: nothing }),
      removeCarried: vi
        .fn<SmoothingCommands["removeCarried"]>()
        .mockResolvedValue({ outcome: "ok", value: { changes: nothing, done: [] } }),
      recordDebt: vi.fn<SmoothingCommands["recordDebt"]>().mockResolvedValue({
        outcome: "ok",
        value: {
          changes: { write: [{ file: debtFile, text: "the debt" }], remove: [] },
          done: [recorded],
        },
      }),
      pruneDebt: vi
        .fn<SmoothingCommands["pruneDebt"]>()
        .mockResolvedValue({ outcome: "ok", value: { changes: nothing, done: [] } }),
    };
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce({
      outcome: "all-applied",
      settled: [
        { effect: { kind: "create-file", path: debtPath, text: "the debt" }, outcome: "applied" },
      ],
    });
    const settings = repoPathOf("hone.config.json");

    const smoothed = await runSmoothing({
      queries: {
        fileText: { read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>() },
        entryKind: {
          kindOf: vi
            .fn<EntryKindPort["kindOf"]>()
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("directory"),
        },
        path: {
          join: vi.fn<PathPort["join"]>().mockReturnValueOnce(debtPath),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi
            .fn<PathPort["directoryOf"]>()
            .mockReturnValueOnce("/repo/hone-records/debt"),
        },
      },
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
    const nothing = { write: [], remove: [] };
    const stale = {
      kind: "run-failed",
      failure: {
        kind: "projection-stale",
        problem: { scope: "projection", engine: { name: "eslint" }, state: "out-of-date" },
        projectCommand: "hone project --repo /repo",
        projectionKind: "mjs",
      },
    } as const;
    const commands: SmoothingCommands = {
      project: vi
        .fn<SmoothingCommands["project"]>()
        .mockResolvedValue({ outcome: "ok", value: nothing }),
      removeCarried: vi
        .fn<SmoothingCommands["removeCarried"]>()
        .mockResolvedValue({ outcome: "ok", value: { changes: nothing, done: [] } }),
      recordDebt: vi
        .fn<SmoothingCommands["recordDebt"]>()
        .mockResolvedValue({ outcome: "ok", value: { changes: nothing, done: [] } }),
      pruneDebt: vi
        .fn<SmoothingCommands["pruneDebt"]>()
        .mockResolvedValue({ outcome: "failed", error: stale }),
    };
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValueOnce([
      {
        written: "file-created",
        path: absoluteRootOf("/repo/hone.config.json"),
        detail: "EBUSY",
      },
    ]);

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
      effects: { apply: vi.fn<ProofEffects["apply"]>(), undo },
      commands,
      repoRoot: absoluteRootOf("/repo"),
      writes: [
        { kind: "directory-created", path: absoluteRootOf("/repo/hone-records") },
        { kind: "file-created", path: absoluteRootOf("/repo/hone.config.json") },
      ],
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
          unrestored: [
            {
              written: "file-created",
              path: absoluteRootOf("/repo/hone.config.json"),
              detail: "EBUSY",
            },
          ],
          removedByVersionOne: [],
        },
      },
      projectedOver: [
        [{ written: [repoPathOf("hone.config.json")] }],
        [{ written: [repoPathOf("hone.config.json")] }],
        [{ written: [repoPathOf("hone.config.json")] }],
      ],
      undone: [
        [
          {
            writes: [
              { kind: "file-created", path: absoluteRootOf("/repo/hone.config.json") },
              { kind: "directory-created", path: absoluteRootOf("/repo/hone-records") },
            ],
          },
        ],
      ],
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
    const nothing = { write: [], remove: [] };
    const debtPath = absoluteRootOf("/repo/hone-records/debt/loop-keyword.json");
    const commands: SmoothingCommands = {
      project: vi.fn<SmoothingCommands["project"]>().mockResolvedValue({
        outcome: "ok",
        value: {
          write: [{ file: repoPathOf("hone-records/debt/loop-keyword.json"), text: "new" }],
          remove: [],
        },
      }),
      removeCarried: vi
        .fn<SmoothingCommands["removeCarried"]>()
        .mockResolvedValue({ outcome: "ok", value: { changes: nothing, done: [] } }),
      recordDebt: vi.fn<SmoothingCommands["recordDebt"]>(),
      pruneDebt: vi.fn<SmoothingCommands["pruneDebt"]>(),
    };
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValueOnce([]);

    const smoothed = await runSmoothing({
      queries: {
        fileText: {
          read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: "old" }),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file") },
        path: {
          join: vi.fn<PathPort["join"]>().mockReturnValueOnce(debtPath),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>(),
        },
      },
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
