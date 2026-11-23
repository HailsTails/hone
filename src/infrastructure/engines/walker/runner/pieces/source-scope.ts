import type { TestFiles } from "../../../../../domain/settings/test-files.ts";

const GENERATED_FOLDER_NAMES: readonly string[] = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
];
const GENERATED_ROOT_FOLDER_NAMES: readonly string[] = ["vendor"];

export const folderScope = (request: { readonly file: string }): "generated" | "authored" => {
  const folders = request.file.split("/").slice(0, -1);
  return GENERATED_ROOT_FOLDER_NAMES.includes(folders[0] ?? "") ||
    folders.some((folder) => GENERATED_FOLDER_NAMES.includes(folder))
    ? "generated"
    : "authored";
};

type TestFilesRequest = { readonly file: string; readonly testFiles: TestFiles };

const NAME_SUFFIX = /\.([^./]+)\.[^./]+$/;

export const fileRoleOf = (request: TestFilesRequest): "test" | "source" => {
  const folders = request.file.split("/").slice(0, -1);
  const suffix = NAME_SUFFIX.exec(request.file)?.[1];
  return folders.some((folder) => request.testFiles.folders.includes(folder)) ||
    (suffix !== undefined && request.testFiles.suffixes.includes(suffix))
    ? "test"
    : "source";
};

export const testFileEligibility = (request: TestFilesRequest): "eligible" | "skipped" =>
  typeScriptSourceKindOf(request) === "test" ? "eligible" : "skipped";

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;
const DECLARATION_FILE = /\.d\.(?:ts|mts|cts)$/;
const TEST_EXTENSION = /\.tsx?$/;

export const typeScriptSourceEligibility = (request: {
  readonly file: string;
}): "eligible" | "skipped" =>
  !TYPESCRIPT_FILE.test(request.file) ||
  DECLARATION_FILE.test(request.file) ||
  folderScope(request) === "generated"
    ? "skipped"
    : "eligible";

export const typeScriptSourceKindOf = (
  request: TestFilesRequest,
): "production" | "test" | "skipped" => {
  if (typeScriptSourceEligibility(request) === "skipped") return "skipped";
  if (fileRoleOf(request) === "source") return "production";
  return TEST_EXTENSION.test(request.file) ? "test" : "skipped";
};
