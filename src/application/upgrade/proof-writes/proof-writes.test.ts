import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import {
  type PlannedFile,
  type ProofWrites,
  proofWriteEffectsOf,
  proofWritesAppliedOf,
  rolledBackWrites,
  writtenProofFiles,
} from "./proof-writes.ts";

const REPO = absoluteRootOf("/repo");

const RECORDS_FOLDER = absoluteRootOf("/repo/hone-records");

const DEBT_FOLDER = absoluteRootOf("/repo/hone-records/debt");

const DEBT_FILE: PlannedFile = {
  path: absoluteRootOf("/repo/hone-records/debt/loop-keyword.json"),
  text: "debt text",
};

const CONFIG = absoluteRootOf("/repo/eslint.config.mjs");

const REWRITTEN_CONFIG: PlannedFile = { path: CONFIG, text: "rewritten config" };

const PACKAGE_CONFIG = absoluteRootOf("/repo/packages/a/eslint.config.mjs");

const REWRITTEN_PACKAGE_CONFIG: PlannedFile = {
  path: PACKAGE_CONFIG,
  text: "rewritten package config",
};

const PROJECTION_FILE = absoluteRootOf("/repo/hone.eslint.mjs");

const ORIGINAL_CONFIG = "original config";

const WRITTEN: ProofWrites = [
  { kind: "directory-created", path: RECORDS_FOLDER },
  { kind: "directory-created", path: DEBT_FOLDER },
  { kind: "file-created", path: DEBT_FILE.path },
  { kind: "file-replaced", path: CONFIG, original: ORIGINAL_CONFIG },
];

describe("proofWriteEffectsOf", () => {
  it("creates the missing folders shallowest first, then the new files, then replaces each config with its original kept", () => {
    const kindOf = vi
      .fn<EntryKindPort["kindOf"]>()
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("directory");
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValue({ outcome: "ok", value: ORIGINAL_CONFIG });
    const directoryOf = vi
      .fn<PathPort["directoryOf"]>()
      .mockReturnValueOnce(DEBT_FOLDER)
      .mockReturnValueOnce(RECORDS_FOLDER)
      .mockReturnValueOnce(REPO);

    expect(
      proofWriteEffectsOf({
        queries: { fileText: { read }, entryKind: { kindOf }, path: { directoryOf } },
        files: [DEBT_FILE],
        replacements: [REWRITTEN_CONFIG, REWRITTEN_PACKAGE_CONFIG],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "create-directory", path: RECORDS_FOLDER },
        { kind: "create-directory", path: DEBT_FOLDER },
        { kind: "create-file", path: DEBT_FILE.path, text: "debt text" },
        { kind: "replace-file", path: CONFIG, text: "rewritten config", original: ORIGINAL_CONFIG },
        {
          kind: "replace-file",
          path: PACKAGE_CONFIG,
          text: "rewritten package config",
          original: ORIGINAL_CONFIG,
        },
      ],
    });
    expect(kindOf.mock.calls).toEqual([
      [{ path: DEBT_FILE.path }],
      [{ path: DEBT_FOLDER }],
      [{ path: RECORDS_FOLDER }],
      [{ path: REPO }],
    ]);
    expect(read.mock.calls).toEqual([[{ path: CONFIG }], [{ path: PACKAGE_CONFIG }]]);
  });

  it("creates no folder that already exists", () => {
    const kindOf = vi
      .fn<EntryKindPort["kindOf"]>()
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("directory");

    expect(
      proofWriteEffectsOf({
        queries: {
          fileText: { read: vi.fn<FileTextPort["read"]>() },
          entryKind: { kindOf },
          path: { directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValueOnce(REPO) },
        },
        files: [{ path: PROJECTION_FILE, text: "projection" }],
        replacements: [],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ kind: "create-file", path: PROJECTION_FILE, text: "projection" }],
    });
    expect(kindOf.mock.calls).toEqual([[{ path: PROJECTION_FILE }], [{ path: REPO }]]);
  });

  it("refuses a planned file that already exists, reading nothing", () => {
    const read = vi.fn<FileTextPort["read"]>();

    expect(
      proofWriteEffectsOf({
        queries: {
          fileText: { read },
          entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file") },
          path: { directoryOf: vi.fn<PathPort["directoryOf"]>() },
        },
        files: [DEBT_FILE],
        replacements: [REWRITTEN_CONFIG],
      }),
    ).toEqual({ outcome: "failed", error: { kind: "path-already-exists", path: DEBT_FILE.path } });
    expect(read).not.toHaveBeenCalled();
  });

  it("refuses a file it would replace that cannot be read", () => {
    expect(
      proofWriteEffectsOf({
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue({
              outcome: "failed",
              error: { kind: "unreadable", path: CONFIG, detail: "ENOENT" },
            }),
          },
          entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("absent") },
          path: { directoryOf: vi.fn<PathPort["directoryOf"]>() },
        },
        files: [DEBT_FILE],
        replacements: [REWRITTEN_CONFIG],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "replaced-file-unreadable", path: CONFIG, detail: "ENOENT" },
    });
  });
});

describe("proofWritesAppliedOf", () => {
  it("records each applied effect as the write it made", () => {
    expect(
      proofWritesAppliedOf({
        applied: {
          outcome: "all-applied",
          settled: [
            { effect: { kind: "create-directory", path: RECORDS_FOLDER }, outcome: "applied" },
            { effect: { kind: "create-directory", path: DEBT_FOLDER }, outcome: "applied" },
            {
              effect: { kind: "create-file", path: DEBT_FILE.path, text: "debt text" },
              outcome: "applied",
            },
            {
              effect: {
                kind: "replace-file",
                path: CONFIG,
                text: "rewritten config",
                original: ORIGINAL_CONFIG,
              },
              outcome: "applied",
            },
          ],
        },
      }),
    ).toEqual({ outcome: "written", writes: WRITTEN });
  });

  it.each([
    {
      name: "a folder that cannot be created",
      stopped: {
        effect: { kind: "create-directory", path: RECORDS_FOLDER },
        outcome: "failed",
        detail: "EACCES",
      },
      failure: { kind: "directory-uncreatable", path: RECORDS_FOLDER, detail: "EACCES" },
      attempted: [],
    },
    {
      name: "a file that cannot be created",
      stopped: {
        effect: { kind: "create-file", path: DEBT_FILE.path, text: "debt text" },
        outcome: "failed",
        detail: "ENOSPC",
      },
      failure: { kind: "unwritable", path: DEBT_FILE.path, detail: "ENOSPC" },
      attempted: [],
    },
    {
      name: "a name taken after the check, a link included",
      stopped: {
        effect: { kind: "create-file", path: DEBT_FILE.path, text: "debt text" },
        outcome: "already-exists",
        detail: "it already exists",
      },
      failure: { kind: "path-already-exists", path: DEBT_FILE.path },
      attempted: [],
    },
    {
      name: "a config that cannot be rewritten, counted as attempted so its original is restored",
      stopped: {
        effect: {
          kind: "replace-file",
          path: CONFIG,
          text: "rewritten config",
          original: ORIGINAL_CONFIG,
        },
        outcome: "failed",
        detail: "EPERM",
      },
      failure: { kind: "unwritable", path: CONFIG, detail: "EPERM" },
      attempted: [{ kind: "file-replaced", path: CONFIG, original: ORIGINAL_CONFIG }],
    },
    {
      name: "a file that cannot be removed",
      stopped: {
        effect: { kind: "remove-restorable-file", path: CONFIG, original: ORIGINAL_CONFIG },
        outcome: "failed",
        detail: "EBUSY",
      },
      failure: { kind: "unremovable", path: CONFIG, detail: "EBUSY" },
      attempted: [],
    },
    {
      name: "a file that cannot be removed for good",
      stopped: {
        effect: { kind: "remove-file", path: CONFIG },
        outcome: "failed",
        detail: "EBUSY",
      },
      failure: { kind: "unremovable", path: CONFIG, detail: "EBUSY" },
      attempted: [],
    },
    {
      name: "a folder that cannot be removed",
      stopped: {
        effect: { kind: "remove-directory-if-empty", path: DEBT_FOLDER },
        outcome: "failed",
        detail: "EBUSY",
      },
      failure: { kind: "unremovable", path: DEBT_FOLDER, detail: "EBUSY" },
      attempted: [],
    },
  ] as const)("stops at $name", ({ stopped, failure, attempted }) => {
    expect(
      proofWritesAppliedOf({
        applied: {
          outcome: "stopped",
          settled: [{ effect: { kind: "create-directory", path: REPO }, outcome: "applied" }],
          stopped,
        },
      }),
    ).toEqual({
      outcome: "stopped",
      failure,
      attempted: [{ kind: "directory-created", path: REPO }, ...attempted],
    });
  });
});

describe("proofWritesAppliedOf on a removal", () => {
  it("records a removed file with its original, so undoing it puts the file back", () => {
    const applied = proofWritesAppliedOf({
      applied: {
        outcome: "all-applied",
        settled: [
          {
            effect: { kind: "remove-restorable-file", path: CONFIG, original: ORIGINAL_CONFIG },
            outcome: "applied",
          },
          { effect: { kind: "remove-directory-if-empty", path: DEBT_FOLDER }, outcome: "applied" },
        ],
      },
    });

    expect(applied).toEqual({
      outcome: "written",
      writes: [{ kind: "file-removed", path: CONFIG, original: ORIGINAL_CONFIG }],
    });
  });

  it("records nothing for a final removal, since it cannot be undone", () => {
    const applied = proofWritesAppliedOf({
      applied: {
        outcome: "all-applied",
        settled: [{ effect: { kind: "remove-file", path: CONFIG }, outcome: "applied" }],
      },
    });

    expect(applied).toEqual({ outcome: "written", writes: [] });
  });
});

describe("rolledBackWrites", () => {
  it("undoes the writes in reverse: the config's original bytes, the created file, then the created folders deepest first", () => {
    const undo = vi
      .fn<ProofEffects["undo"]>()
      .mockReturnValueOnce([{ written: "file-created", path: DEBT_FILE.path, detail: "EBUSY" }]);

    expect(rolledBackWrites({ effects: { undo }, writes: WRITTEN })).toEqual([
      { written: "file-created", path: DEBT_FILE.path, detail: "EBUSY" },
    ]);
    expect(undo.mock.calls).toEqual([
      [
        {
          writes: [
            { kind: "file-replaced", path: CONFIG, original: ORIGINAL_CONFIG },
            { kind: "file-created", path: DEBT_FILE.path },
            { kind: "directory-created", path: DEBT_FOLDER },
            { kind: "directory-created", path: RECORDS_FOLDER },
          ],
        },
      ],
    ]);
  });
});

describe("writtenProofFiles", () => {
  it("applies the planned effects and records what it wrote", () => {
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce({
      outcome: "all-applied",
      settled: [
        {
          effect: { kind: "create-file", path: PROJECTION_FILE, text: "projection" },
          outcome: "applied",
        },
      ],
    });
    const kindOf = vi
      .fn<EntryKindPort["kindOf"]>()
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("directory");

    expect(
      writtenProofFiles({
        queries: {
          fileText: { read: vi.fn<FileTextPort["read"]>() },
          entryKind: { kindOf },
          path: { directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValueOnce(REPO) },
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
        files: [{ path: PROJECTION_FILE, text: "projection" }],
        replacements: [],
      }),
    ).toEqual({ outcome: "ok", value: [{ kind: "file-created", path: PROJECTION_FILE }] });
    expect(apply.mock.calls).toEqual([
      [{ effects: [{ kind: "create-file", path: PROJECTION_FILE, text: "projection" }] }],
    ]);
  });

  it("undoes what it wrote when an effect stops it, naming what it could not restore", () => {
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce({
      outcome: "stopped",
      settled: [{ effect: { kind: "create-directory", path: DEBT_FOLDER }, outcome: "applied" }],
      stopped: {
        effect: { kind: "create-file", path: DEBT_FILE.path, text: "debt text" },
        outcome: "failed",
        detail: "ENOSPC",
      },
    });
    const undo = vi
      .fn<ProofEffects["undo"]>()
      .mockReturnValueOnce([{ written: "directory-created", path: DEBT_FOLDER, detail: "EBUSY" }]);
    const kindOf = vi
      .fn<EntryKindPort["kindOf"]>()
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("directory");
    const directoryOf = vi
      .fn<PathPort["directoryOf"]>()
      .mockReturnValueOnce(DEBT_FOLDER)
      .mockReturnValueOnce(RECORDS_FOLDER);

    expect(
      writtenProofFiles({
        queries: {
          fileText: { read: vi.fn<FileTextPort["read"]>() },
          entryKind: { kindOf },
          path: { directoryOf },
        },
        effects: { apply, undo },
        files: [DEBT_FILE],
        replacements: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        failure: { kind: "unwritable", path: DEBT_FILE.path, detail: "ENOSPC" },
        unrestored: [{ written: "directory-created", path: DEBT_FOLDER, detail: "EBUSY" }],
      },
    });
    expect(undo.mock.calls).toEqual([
      [{ writes: [{ kind: "directory-created", path: DEBT_FOLDER }] }],
    ]);
  });

  it("applies nothing when the plan is refused", () => {
    const apply = vi.fn<ProofEffects["apply"]>();

    expect(
      writtenProofFiles({
        queries: {
          fileText: { read: vi.fn<FileTextPort["read"]>() },
          entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file") },
          path: { directoryOf: vi.fn<PathPort["directoryOf"]>() },
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
        files: [DEBT_FILE],
        replacements: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: { failure: { kind: "path-already-exists", path: DEBT_FILE.path }, unrestored: [] },
    });
    expect(apply).not.toHaveBeenCalled();
  });
});
