import { describe, expect, it, vi } from "vitest";
import type { ProjectedFile } from "../../domain/runner/checks-run-report.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { projectedFilesWrittenOf } from "./projected-files-written.ts";

const REPO = absolutePathSchema.parse("/repo");

const FILE: ProjectedFile = { file: repoPathSchema.parse("hone.eslint.mjs"), text: "export default [];\n" };

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

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

const writtenOver = (request: { readonly fileText: FileTextPort; readonly files: readonly ProjectedFile[] }) =>
  projectedFilesWrittenOf({ fileText: request.fileText, path: POSIX_PATH, repoRoot: REPO, files: request.files });

describe("projectedFilesWrittenOf", () => {
  it("writes a file the repository does not hold, and reports it written", () => {
    const fileText = fileTextAbsent();
    expect({ outcome: writtenOver({ fileText, files: [FILE] }), writes: vi.mocked(fileText.write).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: [{ path: "hone.eslint.mjs", effect: "written" }] },
      writes: [[{ path: "/repo/hone.eslint.mjs", text: "export default [];\n" }]],
    });
  });

  it("writes a file whose text differs, and reports it written", () => {
    const fileText = fileTextHolding({ current: "export default [{}];\n" });
    expect({ outcome: writtenOver({ fileText, files: [FILE] }), writes: vi.mocked(fileText.write).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: [{ path: "hone.eslint.mjs", effect: "written" }] },
      writes: [[{ path: "/repo/hone.eslint.mjs", text: "export default [];\n" }]],
    });
  });

  it("leaves a file already holding the text, and reports it unchanged", () => {
    const fileText = fileTextHolding({ current: "export default [];\n" });
    expect({ outcome: writtenOver({ fileText, files: [FILE] }), writes: vi.mocked(fileText.write).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: [{ path: "hone.eslint.mjs", effect: "unchanged" }] },
      writes: [],
    });
  });

  it("reads a file with Windows line endings as the same text", () => {
    const fileText = fileTextHolding({ current: "export default [];\r\n" });
    expect(writtenOver({ fileText, files: [FILE] })).toEqual({ outcome: "ok", value: [{ path: "hone.eslint.mjs", effect: "unchanged" }] });
  });

  it("writes nothing and reports nothing when there are no files", () => {
    const fileText = fileTextAbsent();
    expect({ outcome: writtenOver({ fileText, files: [] }), writes: vi.mocked(fileText.write).mock.calls }).toEqual({ outcome: { outcome: "ok", value: [] }, writes: [] });
  });

  it("fails as a file unreadable when the existing file cannot be read", () => {
    const fileText: FileTextPort = {
      ...fileTextHolding({ current: "x" }),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/hone.eslint.mjs", detail: "EACCES" } }),
    };
    expect(writtenOver({ fileText, files: [FILE] })).toEqual({ outcome: "failed", error: { kind: "file-unreadable", path: "/repo/hone.eslint.mjs", detail: "EACCES" } });
  });

  it("fails as a file unwritable when the file cannot be written", () => {
    const fileText: FileTextPort = {
      ...fileTextAbsent(),
      write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "failed", error: { kind: "unwritable", path: "/repo/hone.eslint.mjs", detail: "ENOSPC" } }),
    };
    expect(writtenOver({ fileText, files: [FILE] })).toEqual({ outcome: "failed", error: { kind: "file-unwritable", path: "/repo/hone.eslint.mjs", detail: "ENOSPC" } });
  });
});
