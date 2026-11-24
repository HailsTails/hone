import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../../ports/file-system/directory-removal-port.ts";
import type { FileCreationPort } from "../../ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import { appliedEffects, proofEffectsOver, undoneWrites } from "./applied-effects.ts";

const FOLDER = absoluteRootOf("/repo/hone-records");

const FILE = absoluteRootOf("/repo/hone.config.json");

const ok = { outcome: "ok", value: undefined } as const;

describe("appliedEffects", () => {
  it("applies every effect through its port, in order, and says all were applied", () => {
    const create = vi.fn<DirectoryPort["create"]>().mockReturnValue(ok);
    const createNew = vi.fn<FileCreationPort["createNew"]>().mockReturnValue(ok);
    const write = vi.fn<FileTextPort["write"]>().mockReturnValue(ok);
    const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok);
    const ports = {
      fileText: { write },
      fileCreation: { createNew },
      fileRemoval: { remove },
      directory: { list: vi.fn<DirectoryPort["list"]>(), create },
      directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
    };

    expect(
      appliedEffects({
        ports,
        effects: [
          { kind: "create-directory", path: FOLDER },
          { kind: "create-file", path: FILE, text: "settings" },
          { kind: "replace-file", path: FILE, text: "new", original: "old" },
          { kind: "remove-file", path: FILE },
        ],
      }),
    ).toEqual({
      outcome: "all-applied",
      settled: [
        { effect: { kind: "create-directory", path: FOLDER }, outcome: "applied" },
        { effect: { kind: "create-file", path: FILE, text: "settings" }, outcome: "applied" },
        {
          effect: { kind: "replace-file", path: FILE, text: "new", original: "old" },
          outcome: "applied",
        },
        { effect: { kind: "remove-file", path: FILE }, outcome: "applied" },
      ],
    });
    expect([create.mock.calls, createNew.mock.calls, write.mock.calls, remove.mock.calls]).toEqual([
      [[{ path: FOLDER }]],
      [[{ path: FILE, text: "settings" }]],
      [[{ path: FILE, text: "new" }]],
      [[{ path: FILE }]],
    ]);
  });

  it("removes a directory it finds empty, and keeps one that still holds entries", () => {
    const list = vi
      .fn<DirectoryPort["list"]>()
      .mockReturnValueOnce({ outcome: "ok", value: [] })
      .mockReturnValueOnce({ outcome: "ok", value: [{ name: "team.json", kind: "file" }] });
    const removeEmpty = vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(ok);
    const ports = {
      fileText: { write: vi.fn<FileTextPort["write"]>() },
      fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>() },
      fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
      directory: { list, create: vi.fn<DirectoryPort["create"]>() },
      directoryRemoval: { removeEmpty },
    };

    expect(
      appliedEffects({
        ports,
        effects: [
          { kind: "remove-directory-if-empty", path: FOLDER },
          { kind: "remove-directory-if-empty", path: FOLDER },
        ],
      }),
    ).toEqual({
      outcome: "all-applied",
      settled: [
        { effect: { kind: "remove-directory-if-empty", path: FOLDER }, outcome: "applied" },
        { effect: { kind: "remove-directory-if-empty", path: FOLDER }, outcome: "kept" },
      ],
    });
    expect(removeEmpty.mock.calls).toEqual([[{ path: FOLDER }]]);
  });

  it.each([
    {
      name: "a directory that cannot be created",
      create: {
        outcome: "failed",
        error: { kind: "directory-uncreatable", path: FOLDER, detail: "EACCES" },
      },
      createNew: ok,
      list: { outcome: "ok", value: [] },
      effect: { kind: "create-directory", path: FOLDER },
      stopped: { outcome: "failed", detail: "EACCES" },
    },
    {
      name: "a name already taken",
      create: ok,
      createNew: { outcome: "failed", error: { kind: "already-exists", path: FILE } },
      list: { outcome: "ok", value: [] },
      effect: { kind: "create-file", path: FILE, text: "settings" },
      stopped: { outcome: "already-exists", detail: "/repo/hone.config.json already exists" },
    },
    {
      name: "a file that cannot be created",
      create: ok,
      createNew: {
        outcome: "failed",
        error: { kind: "uncreatable", path: FILE, detail: "ENOSPC" },
      },
      list: { outcome: "ok", value: [] },
      effect: { kind: "create-file", path: FILE, text: "settings" },
      stopped: { outcome: "failed", detail: "ENOSPC" },
    },
    {
      name: "a directory that cannot be listed",
      create: ok,
      createNew: ok,
      list: {
        outcome: "failed",
        error: { kind: "directory-unreadable", path: FOLDER, detail: "EACCES" },
      },
      effect: { kind: "remove-directory-if-empty", path: FOLDER },
      stopped: { outcome: "failed", detail: "EACCES" },
    },
  ] as const)(
    "stops at $name, applying nothing after it",
    ({ create, createNew, list, effect, stopped }) => {
      const ports = {
        fileText: { write: vi.fn<FileTextPort["write"]>() },
        fileCreation: {
          createNew: vi.fn<FileCreationPort["createNew"]>().mockReturnValue(createNew),
        },
        fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
        directory: {
          list: vi.fn<DirectoryPort["list"]>().mockReturnValue(list),
          create: vi.fn<DirectoryPort["create"]>().mockReturnValue(create),
        },
        directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
      };

      expect(
        appliedEffects({
          ports,
          effects: [effect, { kind: "remove-file", path: FILE }],
        }),
      ).toEqual({ outcome: "stopped", settled: [], stopped: { effect, ...stopped } });
      expect(ports.fileRemoval.remove).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "creating a file", effect: { kind: "create-file", path: FILE, text: "settings" } },
    {
      name: "replacing a file",
      effect: { kind: "replace-file", path: FILE, text: "new", original: "old" },
    },
  ] as const)("stops at a port that throws while $name", ({ effect }) => {
    const ports = {
      fileText: {
        write: vi.fn<FileTextPort["write"]>().mockThrowOnce(new Error("the write threw")),
      },
      fileCreation: {
        createNew: vi
          .fn<FileCreationPort["createNew"]>()
          .mockThrowOnce(new Error("the write threw")),
      },
      fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
      directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
      directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
    };

    expect(appliedEffects({ ports, effects: [effect] })).toEqual({
      outcome: "stopped",
      settled: [],
      stopped: { effect, outcome: "failed", detail: "the write threw" },
    });
  });
});

describe("undoneWrites", () => {
  it("undoes each write through its port, going on past one that fails or throws, and names those", () => {
    const removeEmpty = vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(ok);
    const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "unremovable", path: FILE, detail: "EBUSY" },
    });
    const write = vi.fn<FileTextPort["write"]>().mockThrowOnce(new Error("the write threw"));
    const ports = {
      fileText: { write },
      fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>() },
      fileRemoval: { remove },
      directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
      directoryRemoval: { removeEmpty },
    };

    expect(
      undoneWrites({
        ports,
        writes: [
          { kind: "file-replaced", path: FILE, original: "old" },
          { kind: "file-created", path: FILE },
          { kind: "directory-created", path: FOLDER },
        ],
      }),
    ).toEqual([
      { written: "file-replaced", path: FILE, detail: "the write threw" },
      { written: "file-created", path: FILE, detail: "EBUSY" },
    ]);
    expect([write.mock.calls, remove.mock.calls, removeEmpty.mock.calls]).toEqual([
      [[{ path: FILE, text: "old" }]],
      [[{ path: FILE }]],
      [[{ path: FOLDER }]],
    ]);
  });
});

describe("proofEffectsOver", () => {
  it("applies and undoes through the ports it was given", () => {
    const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok);
    const effects = proofEffectsOver({
      fileText: { write: vi.fn<FileTextPort["write"]>() },
      fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>() },
      fileRemoval: { remove },
      directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
      directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
    });

    expect([
      effects.apply({ effects: [{ kind: "remove-file", path: FILE }] }),
      effects.undo({ writes: [{ kind: "file-created", path: FILE }] }),
    ]).toEqual([
      {
        outcome: "all-applied",
        settled: [{ effect: { kind: "remove-file", path: FILE }, outcome: "applied" }],
      },
      [],
    ]);
    expect(remove.mock.calls).toEqual([[{ path: FILE }], [{ path: FILE }]]);
  });
});
