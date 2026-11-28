import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import {
  patchedProjectionsOf,
  restoredAfterRefusal,
  restoredOriginalProjections,
} from "./projection-patching.ts";

const REPO = absoluteRootOf("/repo");

const VERSION_ONE_IMPORT =
  'import piece0 from "@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";\n';

const VERSION_TWO_IMPORT =
  'import piece0 from "@hailstails/hone/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.js";\n';

const BODY = 'export default [{ rules: { "hone/no-class-authoring": "error" } }];\n';

const ORIGINAL = `${VERSION_ONE_IMPORT}${BODY}`;

const PATCHED = `${VERSION_TWO_IMPORT}${BODY}`;

const PROJECTION = repoPathOf("disciplines.eslint.mjs");

const PROJECTION_PATH = absoluteRootOf("/repo/disciplines.eslint.mjs");

const CREATED = absoluteRootOf("/repo/acme/rules/principles/acme.md");

const UNPLACEABLE = {
  kind: "unplaceable-path",
  file: PROJECTION,
  removedByVersionOne: [],
} as const;

describe("patchedProjectionsOf", () => {
  it("rewrites the version 1 plugin import of a tracked version 1 projection, reading it again for the original it keeps, and reads no other file", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: ORIGINAL })
      .mockReturnValueOnce({ outcome: "ok", value: ORIGINAL });
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce({
      outcome: "all-applied",
      settled: [
        {
          effect: {
            kind: "replace-file",
            path: PROJECTION_PATH,
            text: PATCHED,
            original: ORIGINAL,
          },
          outcome: "applied",
        },
      ],
    });

    expect(
      patchedProjectionsOf({
        queries: {
          fileText: {
            read,
            exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
          },
          entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
          path: {
            join: vi.fn<PathPort["join"]>().mockReturnValueOnce(PROJECTION_PATH),
            relative: vi.fn<PathPort["relative"]>(),
            directoryOf: vi.fn<PathPort["directoryOf"]>(),
          },
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
        repoRoot: REPO,
        trackedPaths: [PROJECTION, repoPathOf("eslint.config.mjs")],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ kind: "file-replaced", path: PROJECTION_PATH, original: ORIGINAL }],
    });
    expect([read.mock.calls, apply.mock.calls]).toEqual([
      [[{ path: PROJECTION_PATH }], [{ path: PROJECTION_PATH }]],
      [
        [
          {
            effects: [
              { kind: "replace-file", path: PROJECTION_PATH, text: PATCHED, original: ORIGINAL },
            ],
          },
        ],
      ],
    ]);
  });

  it("patches nothing for a tracked projection missing from the working tree", () => {
    const read = vi.fn<FileTextPort["read"]>();
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce({ outcome: "all-applied", settled: [] });

    const patched = patchedProjectionsOf({
      queries: {
        fileText: { read, exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent") },
        entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
        path: {
          join: vi.fn<PathPort["join"]>().mockReturnValueOnce(PROJECTION_PATH),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>(),
        },
      },
      effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
      repoRoot: REPO,
      trackedPaths: [PROJECTION],
    });

    expect(patched).toEqual({ outcome: "ok", value: [] });
    expect([read.mock.calls, apply.mock.calls]).toEqual([[], [[{ effects: [] }]]]);
  });

  it("refuses naming a tracked projection it cannot read, applying nothing", () => {
    const apply = vi.fn<ProofEffects["apply"]>();

    expect(
      patchedProjectionsOf({
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
              outcome: "failed",
              error: { kind: "unreadable", path: PROJECTION_PATH, detail: "ENOENT" },
            }),
            exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
          },
          entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
          path: {
            join: vi.fn<PathPort["join"]>().mockReturnValueOnce(PROJECTION_PATH),
            relative: vi.fn<PathPort["relative"]>(),
            directoryOf: vi.fn<PathPort["directoryOf"]>(),
          },
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
        repoRoot: REPO,
        trackedPaths: [PROJECTION],
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "plan-refused",
        refusal: {
          kind: "team-config-refused",
          refusal: { kind: "config-candidate-unreadable", file: PROJECTION, detail: "ENOENT" },
        },
        removedByVersionOne: [],
      },
    });
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("restoredOriginalProjections", () => {
  it("puts the original bytes of the projection back when the upgrade refuses", () => {
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValueOnce([]);

    expect(
      restoredOriginalProjections({
        queries: {
          path: {
            join: vi.fn<PathPort["join"]>(),
            relative: vi.fn<PathPort["relative"]>(),
            directoryOf: vi.fn<PathPort["directoryOf"]>(),
          },
        },
        effects: { undo },
        repoRoot: REPO,
        writes: [{ kind: "file-replaced", path: PROJECTION_PATH, original: ORIGINAL }],
        refusal: UNPLACEABLE,
      }),
    ).toEqual(UNPLACEABLE);
    expect(undo.mock.calls).toEqual([
      [{ writes: [{ kind: "file-replaced", path: PROJECTION_PATH, original: ORIGINAL }] }],
    ]);
  });

  it("deletes what version 1's own project created, then puts back its rewrite, then the original bytes, newest first", () => {
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValueOnce([]);

    const restored = restoredOriginalProjections({
      queries: {
        path: {
          join: vi.fn<PathPort["join"]>(),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>(),
        },
      },
      effects: { undo },
      repoRoot: REPO,
      writes: [
        { kind: "file-replaced", path: PROJECTION_PATH, original: ORIGINAL },
        { kind: "file-replaced", path: PROJECTION_PATH, original: PATCHED },
        { kind: "file-created", path: CREATED },
      ],
      refusal: UNPLACEABLE,
    });

    expect(restored).toEqual(UNPLACEABLE);
    expect(undo.mock.calls).toEqual([
      [
        {
          writes: [
            { kind: "file-created", path: CREATED },
            { kind: "file-replaced", path: PROJECTION_PATH, original: PATCHED },
            { kind: "file-replaced", path: PROJECTION_PATH, original: ORIGINAL },
          ],
        },
      ],
    ]);
  });

  it("puts back nothing for a projection that version 1's own project removed", () => {
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValueOnce([]);
    const refusal = { ...UNPLACEABLE, removedByVersionOne: [PROJECTION] };

    const restored = restoredOriginalProjections({
      queries: {
        path: {
          join: vi.fn<PathPort["join"]>().mockReturnValueOnce(PROJECTION_PATH),
          relative: vi.fn<PathPort["relative"]>(),
          directoryOf: vi.fn<PathPort["directoryOf"]>(),
        },
      },
      effects: { undo },
      repoRoot: REPO,
      writes: [{ kind: "file-replaced", path: PROJECTION_PATH, original: ORIGINAL }],
      refusal,
    });

    expect(restored).toEqual(refusal);
    expect(undo.mock.calls).toEqual([[{ writes: [] }]]);
  });
});

describe("restoredAfterRefusal", () => {
  it("undoes each write it is given and returns the refusal with what it could not restore", () => {
    const undo = vi
      .fn<ProofEffects["undo"]>()
      .mockReturnValueOnce([{ written: "file-created", path: CREATED, detail: "EBUSY" }]);

    expect(
      restoredAfterRefusal({
        effects: { undo },
        writes: [{ kind: "file-created", path: CREATED }],
        refusal: {
          kind: "check-failed",
          failing: ["findings (1)"],
          unrestored: [],
          removedByVersionOne: [],
        },
      }),
    ).toEqual({
      kind: "check-failed",
      failing: ["findings (1)"],
      unrestored: [{ written: "file-created", path: CREATED, detail: "EBUSY" }],
      removedByVersionOne: [],
    });
    expect(undo.mock.calls).toEqual([[{ writes: [{ kind: "file-created", path: CREATED }] }]]);
  });

  it("adds what it could not restore to a smoothing step's refusal", () => {
    const undo = vi
      .fn<ProofEffects["undo"]>()
      .mockReturnValueOnce([{ written: "file-created", path: CREATED, detail: "EBUSY" }]);
    const refusal = {
      kind: "smoothing-failed",
      step: "prune-debt",
      failure: { kind: "run-failed", failure: { kind: "config-absent", repo: "/repo" } },
      unrestored: [],
      removedByVersionOne: [],
    } as const;

    const restored = restoredAfterRefusal({
      effects: { undo },
      writes: [{ kind: "file-created", path: CREATED }],
      refusal,
    });

    expect(restored).toEqual({
      ...refusal,
      unrestored: [{ written: "file-created", path: CREATED, detail: "EBUSY" }],
    });
  });

  it("restores nothing after a removal failed, since the proof had already passed", () => {
    const undo = vi.fn<ProofEffects["undo"]>();
    const refusal = {
      kind: "removal-failed",
      failure: {
        kind: "unremovable",
        path: CREATED,
        detail: "EBUSY",
        removed: { files: [], folders: [] },
      },
      remaining: [],
      written: [],
      replaced: [],
    } as const;

    expect(
      restoredAfterRefusal({
        effects: { undo },
        writes: [{ kind: "file-created", path: CREATED }],
        refusal,
      }),
    ).toEqual(refusal);
    expect(undo).not.toHaveBeenCalled();
  });
});
