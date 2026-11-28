import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { mapChangesToEffects } from "./smoothing-effects.ts";

describe("mapChangesToEffects", () => {
  it("plans file creation after its parent and keeps the text of a removed file", () => {
    const created = repoPathOf("hone-records/debt/loop-keyword.json");
    const removed = repoPathOf("hone-records/debt/rebinding.json");
    const createdPath = absoluteRootOf("/repo/hone-records/debt/loop-keyword.json");
    const removedPath = absoluteRootOf("/repo/hone-records/debt/rebinding.json");
    const folder = absoluteRootOf("/repo/hone-records/debt");

    const planned = mapChangesToEffects({
      queries: {
        fileText: {
          read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "pruned" }),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: {
          kindOf: vi
            .fn<EntryKindPort["kindOf"]>()
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("directory"),
        },
        path: {
          join: vi
            .fn<PathPort["join"]>()
            .mockReturnValueOnce(createdPath)
            .mockReturnValueOnce(removedPath),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi
            .fn<PathPort["directoryOf"]>()
            .mockReturnValueOnce(folder)
            .mockReturnValueOnce("/repo/hone-records"),
        },
      },
      repoRoot: absoluteRootOf("/repo"),
      changes: { write: [{ file: created, text: "debt" }], remove: [removed] },
    });

    expect(planned).toEqual({
      outcome: "ok",
      value: {
        effects: [
          { kind: "create-directory", path: folder },
          { kind: "create-file", path: createdPath, text: "debt" },
          { kind: "remove-restorable-file", path: removedPath, original: "pruned" },
        ],
        created: [created],
        changed: [],
        removed: [removed],
      },
    });
  });

  it("keeps the original text of a replacement and skips an unchanged file", () => {
    const projection = repoPathOf("hone.eslint.mjs");
    const projectionPath = absoluteRootOf("/repo/hone.eslint.mjs");
    const declaration = repoPathOf("hone.eslint.d.mts");

    const planned = mapChangesToEffects({
      queries: {
        fileText: {
          read: vi
            .fn<FileTextPort["read"]>()
            .mockReturnValueOnce({ outcome: "ok", value: "old projection" })
            .mockReturnValueOnce({ outcome: "ok", value: "same declaration" }),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValue("file") },
        path: {
          join: vi
            .fn<PathPort["join"]>()
            .mockReturnValueOnce(projectionPath)
            .mockReturnValueOnce("/repo/hone.eslint.d.mts"),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>(),
        },
      },
      repoRoot: absoluteRootOf("/repo"),
      changes: {
        write: [
          { file: projection, text: "new projection" },
          { file: declaration, text: "same declaration" },
        ],
        remove: [],
      },
    });

    expect(planned).toEqual({
      outcome: "ok",
      value: {
        effects: [
          {
            kind: "replace-file",
            path: projectionPath,
            text: "new projection",
            original: "old projection",
          },
        ],
        created: [],
        changed: [projection],
        removed: [],
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
        failure: {
          kind: "removed-file-unreadable",
          path: absoluteRootOf("/repo/hone-records/debt/rebinding.json"),
          detail: "EACCES",
        },
        unrestored: [],
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
          unrestored: [],
          removedByVersionOne: [],
        },
      },
      read: [],
    });
  });
});
