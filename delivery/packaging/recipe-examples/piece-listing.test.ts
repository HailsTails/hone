import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../../src/application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../src/domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { readListedPieces } from "./piece-listing.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("readListedPieces", () => {
  it("lists each piece file under each engine's symptom and check folders, with the editions it declares, passing over a folder with none", () => {
    const list = vi
      .fn<DirectoryPort["list"]>()
      .mockReturnValueOnce({
        outcome: "ok",
        value: [
          { name: "rebinding", kind: "directory" },
          { name: "notes.md", kind: "file" },
          { name: "runner", kind: "directory" },
        ],
      })
      .mockReturnValueOnce({ outcome: "ok", value: [{ name: "test-body", kind: "directory" }] })
      .mockReturnValueOnce({ outcome: "ok", value: [{ name: "pieces", kind: "directory" }] })
      .mockReturnValueOnce({ outcome: "ok", value: [{ name: "untyped-value", kind: "directory" }] })
      .mockReturnValueOnce({ outcome: "ok", value: [{ name: "explicit-any", kind: "directory" }] })
      .mockReturnValueOnce({ outcome: "ok", value: [] });
    const exists = vi
      .fn<FileTextPort["exists"]>()
      .mockReturnValueOnce("present")
      .mockReturnValueOnce("present")
      .mockReturnValueOnce("present")
      .mockReturnValueOnce("absent")
      .mockReturnValue("present");
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({
        outcome: "ok",
        value:
          '{ "version": 2, "anchor": { "kind": "file" }, "settings": {}, "editions": ["1", "2"] }',
      })
      .mockReturnValueOnce({
        outcome: "ok",
        value: '{ "version": 2, "anchor": { "kind": "file" }, "settings": {} }',
      });

    const pieces = readListedPieces({
      repoRoot: "/repo",
      directory: { list },
      fileText: { exists, read },
      path: PATH,
    });

    expect(pieces).toEqual({
      outcome: "ok",
      value: [
        { engine: "walker", check: "rebinding#test-body", editions: ["1", "2"] },
        { engine: "eslint", check: "untyped-value#explicit-any", editions: ["1"] },
      ],
    });
    expect(list.mock.calls).toEqual([
      [{ path: "/repo/src/infrastructure/engines/walker" }],
      [{ path: "/repo/src/infrastructure/engines/walker/rebinding" }],
      [{ path: "/repo/src/infrastructure/engines/walker/runner" }],
      [{ path: "/repo/src/infrastructure/engines/eslint" }],
      [{ path: "/repo/src/infrastructure/engines/eslint/untyped-value" }],
      [{ path: "/repo/src/infrastructure/engines/oxlint" }],
    ]);
  });

  it("fails naming a folder it cannot list", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "directory-unreadable",
        path: absoluteRootOf("/repo/walker"),
        detail: "EACCES",
      },
    });

    const pieces = readListedPieces({
      repoRoot: "/repo",
      directory: { list },
      fileText: { exists: vi.fn<FileTextPort["exists"]>(), read: vi.fn<FileTextPort["read"]>() },
      path: PATH,
    });

    expect(pieces).toEqual({ outcome: "failed", error: "/repo/walker: EACCES" });
  });
});
