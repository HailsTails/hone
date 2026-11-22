import { describe, expect, it, vi } from "vitest";
import { createDirectoryRemovalPort, type DirectoryRemovalSurface } from "./directory-removal-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const FOLDER = absoluteRootOf("/repo/discipline-exceptions");

describe("createDirectoryRemovalPort", () => {
  it("removes the empty directory at the path through the surface", () => {
    const removeEmpty = vi.fn<DirectoryRemovalSurface["removeEmpty"]>();

    expect(createDirectoryRemovalPort({ surface: { removeEmpty } }).removeEmpty({ path: FOLDER })).toEqual({ outcome: "ok", value: undefined });
    expect(removeEmpty).toHaveBeenCalledWith({ path: FOLDER });
  });

  it("reports a removal the surface refuses as unremovable with its detail", () => {
    const removeEmpty = vi.fn<DirectoryRemovalSurface["removeEmpty"]>().mockThrow(new Error("ENOTEMPTY: directory not empty"));

    expect(createDirectoryRemovalPort({ surface: { removeEmpty } }).removeEmpty({ path: FOLDER })).toEqual({
      outcome: "failed",
      error: { kind: "directory-unremovable", path: FOLDER, detail: "ENOTEMPTY: directory not empty" },
    });
  });
});
