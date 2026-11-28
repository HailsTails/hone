import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { mapChangesToEffects } from "./smoothing-effects.ts";

describe("mapChangesToEffects", () => {
  it("creates a new file with its missing folder, replaces a changed file keeping its original, leaves an unchanged file alone, and removes a file keeping its text", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: "old projection" })
      .mockReturnValueOnce({ outcome: "ok", value: "same declaration" })
      .mockReturnValueOnce({ outcome: "ok", value: "pruned records" });
    const changes = {
      write: [
        { file: repoPathOf("hone-records/debt/loop-keyword.json"), text: "debt" },
        { file: repoPathOf("hone.eslint.mjs"), text: "new projection" },
        { file: repoPathOf("hone.eslint.d.mts"), text: "same declaration" },
      ],
      remove: [repoPathOf("hone-records/debt/rebinding.json")],
    };

    const planned = mapChangesToEffects({
      queries: {
        fileText: { read, exists: vi.fn<FileTextPort["exists"]>() },
        entryKind: {
          kindOf: vi
            .fn<EntryKindPort["kindOf"]>()
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("file")
            .mockReturnValueOnce("file")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("directory"),
        },
        path: {
          join: vi
            .fn<PathPort["join"]>()
            .mockReturnValueOnce("/repo/hone-records/debt/loop-keyword.json")
            .mockReturnValueOnce("/repo/hone.eslint.mjs")
            .mockReturnValueOnce("/repo/hone.eslint.d.mts")
            .mockReturnValueOnce("/repo/hone-records/debt/rebinding.json"),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi
            .fn<PathPort["directoryOf"]>()
            .mockReturnValueOnce("/repo/hone-records/debt")
            .mockReturnValueOnce("/repo/hone-records"),
        },
      },
      repoRoot: absoluteRootOf("/repo"),
      changes,
    });

    expect(planned).toEqual({
      outcome: "ok",
      value: {
        effects: [
          { kind: "create-directory", path: absoluteRootOf("/repo/hone-records/debt") },
          {
            kind: "create-file",
            path: absoluteRootOf("/repo/hone-records/debt/loop-keyword.json"),
            text: "debt",
          },
          {
            kind: "replace-file",
            path: absoluteRootOf("/repo/hone.eslint.mjs"),
            text: "new projection",
            original: "old projection",
          },
          {
            kind: "remove-restorable-file",
            path: absoluteRootOf("/repo/hone-records/debt/rebinding.json"),
            original: "pruned records",
          },
        ],
        created: [repoPathOf("hone-records/debt/loop-keyword.json")],
        changed: [repoPathOf("hone.eslint.mjs")],
        removed: [repoPathOf("hone-records/debt/rebinding.json")],
      },
    });
  });

  it("refuses a file it would remove that cannot be read", () => {
    const changes = { write: [], remove: [repoPathOf("hone-records/debt/rebinding.json")] };

    const planned = mapChangesToEffects({
      queries: {
        fileText: {
          read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
            outcome: "failed",
            error: {
              kind: "unreadable",
              path: "/repo/hone-records/debt/rebinding.json",
              detail: "EACCES",
            },
          }),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
        path: {
          join: vi
            .fn<PathPort["join"]>()
            .mockReturnValueOnce("/repo/hone-records/debt/rebinding.json"),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>(),
        },
      },
      repoRoot: absoluteRootOf("/repo"),
      changes,
    });

    expect(planned).toEqual({
      outcome: "failed",
      error: {
        kind: "write-refused",
        refusal: {
          failure: {
            kind: "removed-file-unreadable",
            path: absoluteRootOf("/repo/hone-records/debt/rebinding.json"),
            detail: "EACCES",
          },
          unrestored: [],
        },
        removedByVersionOne: [],
      },
    });
  });

  it("refuses a file that cannot be placed in the repository, reading nothing", () => {
    const read = vi.fn<FileTextPort["read"]>();
    const changes = {
      write: [{ file: repoPathOf("hone.eslint.mjs"), text: "projection" }],
      remove: [],
    };

    const planned = mapChangesToEffects({
      queries: {
        fileText: { read, exists: vi.fn<FileTextPort["exists"]>() },
        entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
        path: {
          join: vi.fn<PathPort["join"]>().mockReturnValueOnce("hone.eslint.mjs"),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>(),
        },
      },
      repoRoot: absoluteRootOf("/repo"),
      changes,
    });

    expect({ planned, read: read.mock.calls }).toEqual({
      planned: {
        outcome: "failed",
        error: {
          kind: "unplaceable-path",
          file: repoPathOf("hone.eslint.mjs"),
          removedByVersionOne: [],
        },
      },
      read: [],
    });
  });
});
