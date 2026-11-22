import { describe, expect, it, vi } from "vitest";
import type { DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../node/path-port.ts";
import { createEngineBindingsRepository } from "./piece-engines.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";

const INSTALL = absoluteRootOf("/install");

const TEAM = absoluteRootOf("/repo/team-rules");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => INSTALL });

const AUDIT_PIECE_TEXT =
  '{ "version": 1, "discipline": "CD-17", "mechanism": "walker", "clauses": [{ "clause": "clock-sources", "settings": {} }, { "clause": "timers", "settings": {} }] }';

const ESLINT_PIECE_TEXT = '{ "version": 1, "discipline": "CD-17", "mechanism": "eslint", "clauses": [{ "clause": "clock-sources", "settings": {} }] }';

describe("createEngineBindingsRepository", () => {
  it("gives each clause the engines whose pieces under a team's mechanisms folder run it, in the order of the registry, passing over folders that hold no piece", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("absent")
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: AUDIT_PIECE_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: ESLINT_PIECE_TEXT }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "runner", kind: "directory" },
            { name: "README.md", kind: "file" },
            { name: "CD-17", kind: "directory" },
          ],
        })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "CD-17", kind: "directory" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(createEngineBindingsRepository({ fileText, directory, path: PATH, ruleSetRoot: TEAM, installRoot: INSTALL }).read({})).toEqual({
      outcome: "ok",
      value: new Map([
        [
          "CD-17#clock-sources",
          [
            { name: "walker" },
            { name: "eslint" },
          ],
        ],
        ["CD-17#timers", [{ name: "walker" }]],
      ]),
    });
    expect(fileText.exists).toHaveBeenNthCalledWith(1, { path: "/repo/team-rules/mechanisms/audit" });
    expect(fileText.exists).toHaveBeenNthCalledWith(2, { path: "/repo/team-rules/mechanisms/audit/CD-17/piece.json" });
    expect(fileText.exists).toHaveBeenNthCalledWith(3, { path: "/repo/team-rules/mechanisms/audit/runner/piece.json" });
    expect(directory.list).toHaveBeenNthCalledWith(2, { path: "/repo/team-rules/mechanisms/eslint" });
  });

  it("reads a team's pieces from the mechanisms folder of its rule set", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValueOnce("present").mockReturnValueOnce("absent"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: ESLINT_PIECE_TEXT }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "ok", value: [{ name: "CD-17", kind: "directory" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(createEngineBindingsRepository({ fileText, directory, path: PATH, ruleSetRoot: TEAM, installRoot: INSTALL }).read({})).toEqual({
      outcome: "ok",
      value: new Map([["CD-17#clock-sources", [{ name: "walker" }]]]),
    });
    expect(fileText.exists).toHaveBeenNthCalledWith(1, { path: "/repo/team-rules/mechanisms/audit" });
    expect(fileText.exists).toHaveBeenNthCalledWith(3, { path: "/repo/team-rules/mechanisms/eslint" });
  });

  it("gives no bindings, listing nothing, when no engine has a folder", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() };
    expect(createEngineBindingsRepository({ fileText, directory, path: PATH, ruleSetRoot: TEAM, installRoot: INSTALL }).read({})).toEqual({
      outcome: "ok",
      value: new Map(),
    });
    expect(directory.list).not.toHaveBeenCalled();
  });

  it("fails file-malformed naming a piece whose file is not a piece", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: '{ "version": 1, "discipline": "CD-17" }' }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "CD-17", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(createEngineBindingsRepository({ fileText, directory, path: PATH, ruleSetRoot: TEAM, installRoot: INSTALL }).read({})).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/repo/team-rules/mechanisms/audit/CD-17/piece.json" },
    });
  });

  it("fails file-unreadable when an engine's folder cannot be listed", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({
          outcome: "failed",
          error: { kind: "directory-unreadable", path: absoluteRootOf("/repo/team-rules/mechanisms/audit"), detail: "EACCES" },
        })
        .mockReturnValueOnce({ outcome: "ok", value: [] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(createEngineBindingsRepository({ fileText, directory, path: PATH, ruleSetRoot: TEAM, installRoot: INSTALL }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/repo/team-rules/mechanisms/audit", detail: "EACCES" },
    });
  });
});
