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

export const testFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" =>
  typeScriptSourceKindOf(request) === "test" ? "eligible" : "skipped";

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;
const DECLARATION_FILE = /\.d\.(?:ts|mts|cts)$/;
const TEST_FILE = /\.test\.tsx?$/;

export const typeScriptSourceKindOf = (request: {
  readonly file: string;
}): "production" | "test" | "skipped" => {
  const { file } = request;
  if (
    !TYPESCRIPT_FILE.test(file) ||
    DECLARATION_FILE.test(file) ||
    folderScope(request) === "generated"
  )
    return "skipped";
  return TEST_FILE.test(file) ? "test" : "production";
};
