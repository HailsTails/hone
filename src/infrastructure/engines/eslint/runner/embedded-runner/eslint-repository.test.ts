import { describe, expect, it, vi } from "vitest";
import type { FileRemovalPort } from "../../../../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { Result } from "../../../../../domain/result.ts";
import { eslintRepositoryOver } from "./eslint-repository.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const PACKAGE_JSON = repoPathOf("packages/a/package.json");

const SUPPRESSIONS = repoPathOf("ci/lint-suppressions.json");

const PACKAGE_A = repoPathOf("packages/a");

const SLICE = repoPathOf("packages/a/disciplines.eslint.mjs");

const ROOT_PROJECTION = repoPathOf("disciplines.eslint.mjs");

const SOURCE = repoPathOf("src/a.ts");

const ESLINT_9_PACKAGE = '{ "version": "9.39.5" }';

type ReadAnswer = ReturnType<FileTextPort["read"]>;

const fileTextReading = (answer: ReadAnswer) => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue(answer),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const removalAnswering = (answer: Result<void, { readonly kind: "unremovable"; readonly path: string; readonly detail: string }>) => ({
  remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(answer),
});

const REMOVED = removalAnswering({ outcome: "ok", value: undefined });

const UNREADABLE: ReadAnswer = { outcome: "failed", error: { kind: "unreadable", path: "/repo/packages/a/package.json", detail: "EACCES" } };

describe("eslintRepositoryOver, package scripts", () => {
  it("reads a package's package.json under the repository root and gives its scripts", () => {
    const fileText = fileTextReading({ outcome: "ok", value: '{ "name": "a", "scripts": { "lint": "eslint ." } }' });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toEqual({ outcome: "ok", value: { lint: "eslint ." } });
    expect(fileText.read.mock.calls).toEqual([[{ path: "/repo/packages/a/package.json" }]]);
  });

  it("gives no scripts for a package.json without a scripts field", () => {
    const repository = eslintRepositoryOver({
      fileText: fileTextReading({ outcome: "ok", value: '{ "name": "a" }' }),
      fileRemoval: REMOVED,
      path: posixPath,
      repoRoot: REPO_ROOT,
    });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toEqual({ outcome: "ok", value: {} });
  });

  it("fails as file-unreadable, naming the package.json, when it cannot be read", () => {
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "packages/a/package.json", detail: "EACCES" },
    });
  });

  it("fails as tool-failed, naming the package.json, when it is not JSON", () => {
    const repository = eslintRepositoryOver({
      fileText: fileTextReading({ outcome: "ok", value: '{ "scripts": ' }),
      fileRemoval: REMOVED,
      path: posixPath,
      repoRoot: REPO_ROOT,
    });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toMatchObject({
      outcome: "failed",
      error: { kind: "tool-failed" },
    });
  });
});

describe("eslintRepositoryOver, suppressions", () => {
  it("reads a suppressions file under the repository root and gives its entries", () => {
    const fileText = fileTextReading({ outcome: "ok", value: '{ "src/a.ts": { "hone/no-class-authoring": { "count": 1 } } }' });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.suppressionsAt({ location: SUPPRESSIONS })).toEqual({
      outcome: "ok",
      value: { "src/a.ts": { "hone/no-class-authoring": { count: 1 } } },
    });
    expect(fileText.read.mock.calls).toEqual([[{ path: "/repo/ci/lint-suppressions.json" }]]);
  });

  it("fails as file-unreadable, naming the suppressions file, when it cannot be read", () => {
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.suppressionsAt({ location: SUPPRESSIONS })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "ci/lint-suppressions.json", detail: "EACCES" },
    });
  });
});

describe("eslintRepositoryOver, a folder's own ESLint config", () => {
  it("asks for every eslint.config name ESLint looks up in the folder, and finds none there unconfigured", () => {
    const fileText = { ...fileTextReading(UNREADABLE), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.folderConfiguration({ folder: PACKAGE_A })).toBe("unconfigured");
    expect(fileText.exists.mock.calls).toEqual([
      [{ path: "/repo/packages/a/eslint.config.js" }],
      [{ path: "/repo/packages/a/eslint.config.mjs" }],
      [{ path: "/repo/packages/a/eslint.config.cjs" }],
      [{ path: "/repo/packages/a/eslint.config.ts" }],
      [{ path: "/repo/packages/a/eslint.config.mts" }],
      [{ path: "/repo/packages/a/eslint.config.cts" }],
    ]);
  });

  it("finds a folder holding any one of those names configured", () => {
    const fileText = {
      ...fileTextReading(UNREADABLE),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("present").mockReturnValue("absent"),
    };
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.folderConfiguration({ folder: PACKAGE_A })).toBe("configured");
  });
});

describe("eslintRepositoryOver, projection files", () => {
  it("reads each asked projection under the repository root and gives its state keyed by its path", () => {
    const fileText = fileTextReading({ outcome: "ok", value: "export default [];\n" });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.projectionFiles.currentOf({ files: [ROOT_PROJECTION, SLICE] })).toEqual({
      outcome: "ok",
      value: new Map([
        [ROOT_PROJECTION, { presence: "present", text: "export default [];\n" }],
        [SLICE, { presence: "present", text: "export default [];\n" }],
      ]),
    });
    expect(fileText.read).toHaveBeenNthCalledWith(1, { path: "/repo/disciplines.eslint.mjs" });
    expect(fileText.read).toHaveBeenNthCalledWith(2, { path: "/repo/packages/a/disciplines.eslint.mjs" });
  });

  it("gives a projection that is not on disk as absent", () => {
    const fileText = { ...fileTextReading(UNREADABLE), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.projectionFiles.currentOf({ files: [SLICE] })).toEqual({
      outcome: "ok",
      value: new Map([[SLICE, { presence: "absent" }]]),
    });
  });

  it("fails as file-unreadable, naming the projection, when one asked projection cannot be read", () => {
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.projectionFiles.currentOf({ files: [SLICE] })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "packages/a/disciplines.eslint.mjs", detail: "EACCES" },
    });
  });

  it("writes a projection under the repository root when its bytes differ", () => {
    const fileText = fileTextReading({ outcome: "ok", value: "export default [];\n" });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.projectionFiles.writeAt({ file: SLICE, text: "export default [{}];\n" })).toEqual({
      outcome: "ok",
      value: { path: "packages/a/disciplines.eslint.mjs", effect: "written" },
    });
    expect(fileText.write.mock.calls).toEqual([[{ path: "/repo/packages/a/disciplines.eslint.mjs", text: "export default [{}];\n" }]]);
  });

  it("removes a projection under the repository root", () => {
    const fileRemoval = removalAnswering({ outcome: "ok", value: undefined });
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.projectionFiles.removeAt({ file: SLICE })).toEqual({ outcome: "ok", value: undefined });
    expect(fileRemoval.remove.mock.calls).toEqual([[{ path: "/repo/packages/a/disciplines.eslint.mjs" }]]);
  });

  it("fails as tool-failed with the port's detail when a projection cannot be removed", () => {
    const repository = eslintRepositoryOver({
      fileText: fileTextReading(UNREADABLE),
      fileRemoval: removalAnswering({
        outcome: "failed",
        error: { kind: "unremovable", path: "/repo/packages/a/disciplines.eslint.mjs", detail: "EPERM" },
      }),
      path: posixPath,
      repoRoot: REPO_ROOT,
    });
    expect(repository.projectionFiles.removeAt({ file: SLICE })).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "EPERM" },
    });
  });

  it("reads the projection and a suppressions file at their Windows forms under the repository root", () => {
    const fileText = fileTextReading({ outcome: "ok", value: "{}" });
    const repository = eslintRepositoryOver({
      fileText,
      fileRemoval: REMOVED,
      path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" }),
      repoRoot: absoluteRootOf("C:\\repo"),
    });
    repository.projectionFiles.currentOf({ files: [ROOT_PROJECTION] });
    repository.suppressionsAt({ location: repoPathOf("src/eslint-suppressions.json") });
    expect(fileText.read.mock.calls).toEqual([
      [{ path: "C:\\repo\\disciplines.eslint.mjs" }],
      [{ path: "C:\\repo\\src\\eslint-suppressions.json" }],
    ]);
  });

  it("writes a package slice at its Windows form under the repository root", () => {
    const fileText = { ...fileTextReading(UNREADABLE), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    const repository = eslintRepositoryOver({
      fileText,
      fileRemoval: REMOVED,
      path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" }),
      repoRoot: absoluteRootOf("C:\\repo"),
    });
    repository.projectionFiles.writeAt({ file: SLICE, text: "export default [];\n" });
    expect(fileText.write.mock.calls).toEqual([[{ path: "C:\\repo\\packages\\a\\disciplines.eslint.mjs", text: "export default [];\n" }]]);
  });
});

describe("eslintRepositoryOver, the config lookup", () => {
  it("decides the repository-root lookup when ESLint 9 is installed and disciplines.json declares none, reading both under the root", () => {
    const fileText = fileTextReading({ outcome: "ok", value: ESLINT_9_PACKAGE });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.configLookup({ trackedPaths: [] })).toBe("repository-root");
    expect(fileText.read).toHaveBeenNthCalledWith(1, { path: "/repo/disciplines.json" });
    expect(fileText.read).toHaveBeenNthCalledWith(2, { path: "/repo/node_modules/eslint/package.json" });
  });

  it("decides nearest-to-file when the installed ESLint cannot be read", () => {
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.configLookup({ trackedPaths: [] })).toBe("nearest-to-file");
  });

  it("takes the lookup disciplines.json declares over the one ESLint 9 would give", () => {
    const fileText = fileTextReading({ outcome: "ok", value: '{ "version": "9.39.5", "eslintConfigLookup": "nearest-to-file" }' });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.configLookup({ trackedPaths: [] })).toBe("nearest-to-file");
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/disciplines.json" });
  });

  it("falls back to detection when disciplines.json declares a lookup that is not one of the two settings", () => {
    const fileText = fileTextReading({ outcome: "ok", value: '{ "version": "10.11.0", "eslintConfigLookup": "anywhere" }' });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.configLookup({ trackedPaths: [] })).toBe("nearest-to-file");
  });

  it("names disciplines.json when the repository root has no config for a root-only lookup", () => {
    const fileText = {
      ...fileTextReading({ outcome: "ok", value: '{ "version": "9.39.5", "eslintConfigLookup": "repository-root" }' }),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
    };
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.teamConfigLookup({ trackedPaths: [] })).toMatchObject({
      outcome: "failed",
      error: { kind: "team-config-unloadable", detail: expect.stringContaining("nearest-to-file in disciplines.json") },
    });
  });

  it("names the repository root's eslint.config.js as the team config under the repository-root lookup", () => {
    const fileText = fileTextReading({ outcome: "ok", value: ESLINT_9_PACKAGE });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.teamConfigLookup({ trackedPaths: [] })).toEqual({
      outcome: "ok",
      value: { kind: "repository-root", configFile: "/repo/eslint.config.js" },
    });
    expect(fileText.exists).toHaveBeenCalledExactlyOnceWith({ path: "/repo/eslint.config.js" });
  });

  it("gives the nearest-to-file team config lookup when the installed ESLint cannot be read", () => {
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.teamConfigLookup({ trackedPaths: [] })).toEqual({ outcome: "ok", value: { kind: "nearest-to-file" } });
  });
});

describe("eslintRepositoryOver, source lines", () => {
  it("reads a source file under the repository root and gives its lines", () => {
    const fileText = fileTextReading({ outcome: "ok", value: "class A {}\r\nxs.forEach(visit);\n" });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.sourceLines({ file: SOURCE })).toEqual({ outcome: "ok", value: ["class A {}", "xs.forEach(visit);", ""] });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/src/a.ts" });
  });

  it("fails as file-unreadable, naming the source file, when it cannot be read", () => {
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.sourceLines({ file: SOURCE })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "src/a.ts", detail: "EACCES" },
    });
  });
});
