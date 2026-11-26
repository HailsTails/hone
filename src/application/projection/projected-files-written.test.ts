import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { ProjectedFile, ProjectionEntry } from "../../domain/runner/checks-run-report.ts";
import type { FileRemovalPort } from "../ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import { projectedFilesWrittenOf } from "./projected-files-written.ts";

const REPO = absoluteRootOf("/repo");

const FILE: ProjectedFile = {
  kind: "write",
  file: repoPathOf("hone.eslint.mjs"),
  text: "export default [];\n",
};

const POSIX_PATH: Pick<PathPort, "join"> = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/hone.eslint.mjs"),
};

const fileTextAbsent = (): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
  read: vi.fn<FileTextPort["read"]>(),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const fileTextHolding = (request: { readonly current: string }): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.current }),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const writtenOver = (request: {
  readonly fileText: FileTextPort;
  readonly files: readonly ProjectionEntry[];
}) =>
  projectedFilesWrittenOf({
    fileText: request.fileText,
    fileRemoval: { remove: vi.fn() },
    path: POSIX_PATH,
    repoRoot: REPO,
    files: request.files,
  });

describe("projectedFilesWrittenOf", () => {
  it("removes a projected file and reports it removed", () => {
    const file = repoPathOf("hone.eslint.ts");
    const remove = vi
      .fn<FileRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: undefined });
    const join = vi.fn<PathPort["join"]>().mockReturnValue("/repo/hone.eslint.ts");
    const fileText = fileTextAbsent();

    const written = projectedFilesWrittenOf({
      fileText,
      fileRemoval: { remove },
      path: { join },
      repoRoot: REPO,
      files: [{ kind: "remove", file }],
    });

    expect(written).toEqual({ outcome: "ok", value: [{ path: file, effect: "removed" }] });
    expect(join).toHaveBeenCalledExactlyOnceWith({ segments: ["/repo", file] });
    expect(remove).toHaveBeenCalledExactlyOnceWith({ path: "/repo/hone.eslint.ts" });
    expect(fileText.write).not.toHaveBeenCalled();
  });

  it("reports the remove failure against the projected file", () => {
    const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "unremovable", path: "/repo/hone.eslint.ts", detail: "EACCES" },
    });

    const written = projectedFilesWrittenOf({
      fileText: fileTextAbsent(),
      fileRemoval: { remove },
      path: { join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/hone.eslint.ts") },
      repoRoot: REPO,
      files: [{ kind: "remove", file: repoPathOf("hone.eslint.ts") }],
    });

    expect(written).toEqual({
      outcome: "failed",
      error: { kind: "file-unwritable", path: "/repo/hone.eslint.ts", detail: "EACCES" },
    });
  });

  it("keeps the previous projection when a replacement cannot be written", () => {
    const remove = vi.fn<FileRemovalPort["remove"]>();
    const fileText = {
      ...fileTextAbsent(),
      write: vi.fn<FileTextPort["write"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "unwritable", path: "/repo/hone.eslint.mjs", detail: "ENOSPC" },
      }),
    };

    const written = projectedFilesWrittenOf({
      fileText,
      fileRemoval: { remove },
      path: POSIX_PATH,
      repoRoot: REPO,
      files: [{ kind: "remove", file: repoPathOf("hone.eslint.ts") }, FILE],
    });

    expect(written).toEqual({
      outcome: "failed",
      error: { kind: "file-unwritable", path: "/repo/hone.eslint.mjs", detail: "ENOSPC" },
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("writes a file the repository does not hold, and reports it written", () => {
    const fileText = fileTextAbsent();
    expect({
      outcome: writtenOver({ fileText, files: [FILE] }),
      writes: vi.mocked(fileText.write).mock.calls,
    }).toEqual({
      outcome: { outcome: "ok", value: [{ path: "hone.eslint.mjs", effect: "written" }] },
      writes: [[{ path: "/repo/hone.eslint.mjs", text: "export default [];\n" }]],
    });
  });

  it("writes a file whose text differs, and reports it written", () => {
    const fileText = fileTextHolding({ current: "export default [{}];\n" });
    expect({
      outcome: writtenOver({ fileText, files: [FILE] }),
      writes: vi.mocked(fileText.write).mock.calls,
    }).toEqual({
      outcome: { outcome: "ok", value: [{ path: "hone.eslint.mjs", effect: "written" }] },
      writes: [[{ path: "/repo/hone.eslint.mjs", text: "export default [];\n" }]],
    });
  });

  it("leaves a file already holding the text, and reports it unchanged", () => {
    const fileText = fileTextHolding({ current: "export default [];\n" });
    expect({
      outcome: writtenOver({ fileText, files: [FILE] }),
      writes: vi.mocked(fileText.write).mock.calls,
    }).toEqual({
      outcome: { outcome: "ok", value: [{ path: "hone.eslint.mjs", effect: "unchanged" }] },
      writes: [],
    });
  });

  it("reads a file with Windows line endings as the same text", () => {
    const fileText = fileTextHolding({ current: "export default [];\r\n" });
    expect(writtenOver({ fileText, files: [FILE] })).toEqual({
      outcome: "ok",
      value: [{ path: "hone.eslint.mjs", effect: "unchanged" }],
    });
  });

  it("writes nothing and reports nothing when there are no files", () => {
    const fileText = fileTextAbsent();
    expect({
      outcome: writtenOver({ fileText, files: [] }),
      writes: vi.mocked(fileText.write).mock.calls,
    }).toEqual({ outcome: { outcome: "ok", value: [] }, writes: [] });
  });

  it("fails as a file unreadable when the existing file cannot be read", () => {
    const fileText: FileTextPort = {
      ...fileTextHolding({ current: "x" }),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "unreadable", path: "/repo/hone.eslint.mjs", detail: "EACCES" },
      }),
    };
    expect(writtenOver({ fileText, files: [FILE] })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/repo/hone.eslint.mjs", detail: "EACCES" },
    });
  });

  it("fails as a file unwritable when the file cannot be written", () => {
    const fileText: FileTextPort = {
      ...fileTextAbsent(),
      write: vi.fn<FileTextPort["write"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "unwritable", path: "/repo/hone.eslint.mjs", detail: "ENOSPC" },
      }),
    };
    expect(writtenOver({ fileText, files: [FILE] })).toEqual({
      outcome: "failed",
      error: { kind: "file-unwritable", path: "/repo/hone.eslint.mjs", detail: "ENOSPC" },
    });
  });
});
