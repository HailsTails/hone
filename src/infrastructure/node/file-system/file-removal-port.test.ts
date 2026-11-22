import { describe, expect, it, vi } from "vitest";

import { createFileRemovalPort, type FileRemovalSurface } from "./file-removal-port.ts";

describe("createFileRemovalPort", () => {
  it("removes the file at the path through the surface", () => {
    const removeFile = vi.fn<FileRemovalSurface["removeFile"]>();

    expect(
      createFileRemovalPort({ fileSystem: { removeFile } }).remove({ path: "/repo/a.mjs" }),
    ).toEqual({
      outcome: "ok",
      value: undefined,
    });
    expect(removeFile).toHaveBeenCalledWith({ path: "/repo/a.mjs" });
  });

  it("reports a removal the surface refuses as unremovable with its detail", () => {
    const removeFile = vi
      .fn<FileRemovalSurface["removeFile"]>()
      .mockThrow(new Error("EPERM: operation not permitted"));

    expect(
      createFileRemovalPort({ fileSystem: { removeFile } }).remove({ path: "/repo/a.mjs" }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unremovable", path: "/repo/a.mjs", detail: "EPERM: operation not permitted" },
    });
  });
});
