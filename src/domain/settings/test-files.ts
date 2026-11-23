export type TestFiles = {
  readonly suffixes: readonly [string, ...string[]];
  readonly folders: readonly string[];
};

export const DEFAULT_TEST_FILES: TestFiles = { suffixes: ["test", "spec"], folders: [] };
