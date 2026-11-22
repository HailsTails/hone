import { describe, expect, it, vi } from "vitest";
import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { readBoundCatalogue } from "./bound-catalogue.ts";

const INSTALL_ROOT = absolutePathSchema.parse("/install");

const TEAM_ROOT = absolutePathSchema.parse("/repo/team-rules");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("readBoundCatalogue", () => {
  it("reads a team's content from its rules folder and its pieces from its mechanisms folder", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>(),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("absent").mockReturnValueOnce("present").mockReturnValueOnce("absent"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unreadable", path: absolutePathSchema.parse("/repo/team-rules/mechanisms/audit"), detail: "EACCES" } }),
      create: vi.fn<DirectoryPort["create"]>(),
    };

    expect(readBoundCatalogue({ fileText, directory, path: PATH, ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/repo/team-rules/mechanisms/audit", detail: "EACCES" },
    });
    expect(fileText.exists).toHaveBeenNthCalledWith(1, { path: "/repo/team-rules/src/infrastructure/disciplines-file/version-one-names.json" });
    expect(fileText.exists).toHaveBeenNthCalledWith(2, { path: "/repo/team-rules/rules" });
    expect(fileText.exists).toHaveBeenNthCalledWith(3, { path: "/repo/team-rules/mechanisms/audit" });
  });

  it("holds no catalogue when the rule set holds neither content nor pieces", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>(),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() };

    expect(readBoundCatalogue({ fileText, directory, path: PATH, ruleSetRoot: INSTALL_ROOT, installRoot: INSTALL_ROOT })).toEqual({ outcome: "ok", value: { held: "none" } });
    expect(fileText.exists).toHaveBeenNthCalledWith(3, { path: "/install/src/infrastructure/engines/audit" });
  });
});
