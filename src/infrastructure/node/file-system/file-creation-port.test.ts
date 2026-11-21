import { describe, expect, it, vi } from "vitest";
import { systemErrorOf } from "../../../../tests/system-error.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { createFileCreationPort, type FileCreationSurface } from "./file-creation-port.ts";

const FILE = absolutePathSchema.parse("/repo/hone.eslint.mjs");

const NAME_TAKEN = systemErrorOf({ code: "EEXIST", message: "EEXIST: file already exists" });

describe("createFileCreationPort", () => {
  it("creates the file through the surface, which refuses a name already taken", () => {
    const createExclusively = vi.fn<FileCreationSurface["createExclusively"]>();

    expect(createFileCreationPort({ surface: { createExclusively } }).createNew({ path: FILE, text: "projection" })).toEqual({ outcome: "ok", value: undefined });
    expect(createExclusively).toHaveBeenCalledWith({ path: FILE, text: "projection" });
  });

  it("reports a name already taken, a link included, as already existing", () => {
    const createExclusively = vi.fn<FileCreationSurface["createExclusively"]>().mockThrow(NAME_TAKEN);

    expect(createFileCreationPort({ surface: { createExclusively } }).createNew({ path: FILE, text: "projection" })).toEqual({
      outcome: "failed",
      error: { kind: "already-exists", path: FILE },
    });
  });

  it("reports any other refusal as uncreatable with its detail", () => {
    const createExclusively = vi.fn<FileCreationSurface["createExclusively"]>().mockThrow(new Error("EACCES: permission denied"));

    expect(createFileCreationPort({ surface: { createExclusively } }).createNew({ path: FILE, text: "projection" })).toEqual({
      outcome: "failed",
      error: { kind: "uncreatable", path: FILE, detail: "EACCES: permission denied" },
    });
  });
});
