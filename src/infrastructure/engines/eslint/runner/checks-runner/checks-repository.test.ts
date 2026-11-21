import { describe, expect, it, vi } from "vitest";
import type { FileRemovalPort } from "../../../../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { checksRepositoryOver } from "./checks-repository.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const PACKAGE_JSON = repoPathSchema.parse("packages/a/package.json");

const SUPPRESSIONS = repoPathSchema.parse("ci/lint-suppressions.json");

const SOURCE = repoPathSchema.parse("src/a.ts");

const REMOVED: FileRemovalPort = { remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue({ outcome: "ok", value: undefined }) };

const fileTextReading = (text: string): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: text }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

describe("checksRepositoryOver", () => {
  it("reads a package's scripts under the repository root", () => {
    const fileText = fileTextReading('{ "scripts": { "lint": "eslint ." } }');
    const repository = checksRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toEqual({ outcome: "ok", value: { lint: "eslint ." } });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/packages/a/package.json" });
  });

  it("reads a suppressions file under the repository root", () => {
    const fileText = fileTextReading("{}");
    const repository = checksRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.suppressionsAt({ location: SUPPRESSIONS })).toEqual({ outcome: "ok", value: {} });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/ci/lint-suppressions.json" });
  });

  it("reads a source file's lines under the repository root", () => {
    const fileText = fileTextReading("const a = 1;\nconst b = 2;\n");
    const repository = checksRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.sourceLines({ file: SOURCE })).toEqual({ outcome: "ok", value: ["const a = 1;", "const b = 2;", ""] });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/src/a.ts" });
  });

  it("reads the projection files through the file text port under the repository root", () => {
    const fileText = fileTextReading("export default [];\n");
    const repository = checksRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    repository.projectionFiles.currentOf({ files: [repoPathSchema.parse("disciplines.eslint.mjs")] });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/disciplines.eslint.mjs" });
  });
});
