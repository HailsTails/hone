import { describe, expect, it } from "vitest";

import { DEFAULT_TEST_FILES, type TestFiles } from "../../../../../domain/settings/test-files.ts";
import {
  fileRoleOf,
  folderScope,
  testFileEligibility,
  typeScriptSourceEligibility,
  typeScriptSourceKindOf,
} from "./source-scope.ts";

describe("folderScope", () => {
  it.each([
    { name: "node_modules at root", file: "node_modules/a.ts", expected: "generated" },
    { name: "node_modules nested", file: "src/a/node_modules/b.ts", expected: "generated" },
    { name: "dist at root", file: "dist/a.ts", expected: "generated" },
    { name: "dist nested", file: "src/a/dist/b.ts", expected: "generated" },
    { name: "build at root", file: "build/a.ts", expected: "generated" },
    { name: "build nested", file: "src/a/build/b.ts", expected: "generated" },
    { name: "coverage at root", file: "coverage/a.ts", expected: "generated" },
    { name: "coverage nested", file: "src/a/coverage/b.ts", expected: "generated" },
    { name: ".git at root", file: ".git/a.ts", expected: "generated" },
    { name: ".git nested", file: "src/a/.git/b.ts", expected: "generated" },
    { name: "vendor at root", file: "vendor/a.ts", expected: "generated" },
    { name: "vendor at root with depth", file: "vendor/a/b.ts", expected: "generated" },
    { name: "vendor nested", file: "src/vendor/a.ts", expected: "authored" },
    { name: "plain file", file: "src/a/b.ts", expected: "authored" },
    { name: "root file", file: "a.ts", expected: "authored" },
    { name: "file named like a generated folder", file: "src/dist.ts", expected: "authored" },
  ])("scopes $name as $expected", ({ file, expected }) => {
    expect(folderScope({ file })).toBe(expected);
  });
});

describe("fileRoleOf", () => {
  it.each<{ readonly file: string; readonly testFiles: TestFiles; readonly role: string }>([
    { file: "src/order.test.ts", testFiles: { suffixes: ["test"], folders: [] }, role: "test" },
    { file: "src/order.spec.ts", testFiles: { suffixes: ["test"], folders: [] }, role: "source" },
    { file: "src/order.spec.ts", testFiles: { suffixes: ["spec"], folders: [] }, role: "test" },
    { file: "src/order.test.ts", testFiles: { suffixes: ["spec"], folders: [] }, role: "source" },
    { file: "src/order.test.mjs", testFiles: { suffixes: ["test"], folders: [] }, role: "test" },
    { file: "src/test.ts", testFiles: { suffixes: ["test"], folders: [] }, role: "source" },
    { file: "test/order.ts", testFiles: { suffixes: ["test"], folders: [] }, role: "source" },
    {
      file: "src/__tests__/order.ts",
      testFiles: { suffixes: ["test"], folders: ["__tests__"] },
      role: "test",
    },
    {
      file: "src/__tests__/order.ts",
      testFiles: { suffixes: ["test"], folders: [] },
      role: "source",
    },
    {
      file: "src/__tests__.ts",
      testFiles: { suffixes: ["test"], folders: ["__tests__"] },
      role: "source",
    },
  ])("names $file a $role file under $testFiles", ({ file, testFiles, role }) => {
    expect(fileRoleOf({ file, testFiles })).toBe(role);
  });
});

describe("testFileEligibility", () => {
  it.each([
    { file: "src/order.test.ts", expected: "eligible" },
    { file: "src/order.test.tsx", expected: "eligible" },
    { file: "src/order.spec.ts", expected: "eligible" },
    { file: "src/order.spec.tsx", expected: "eligible" },
    { file: "src/order.spec.mts", expected: "skipped" },
    { file: "src/order.spec.cts", expected: "skipped" },
    { file: "src/order.test.mts", expected: "skipped" },
    { file: "src/order.test.cts", expected: "skipped" },
    { file: "src/order.d.ts", expected: "skipped" },
    { file: "src/__tests__/order.ts", expected: "skipped" },
    { file: "node_modules/order.test.ts", expected: "skipped" },
  ])("scopes $file as $expected under the default test files", ({ file, expected }) => {
    expect(testFileEligibility({ file, testFiles: DEFAULT_TEST_FILES })).toBe(expected);
  });

  it.each([
    { file: "src/order.spec.ts", expected: "eligible" },
    { file: "src/__tests__/order.ts", expected: "eligible" },
    { file: "src/__tests__/order.tsx", expected: "eligible" },
    { file: "src/__tests__/order.mts", expected: "skipped" },
    { file: "src/order.test.ts", expected: "skipped" },
  ])("scopes $file as $expected under declared test files", ({ file, expected }) => {
    expect(
      testFileEligibility({ file, testFiles: { suffixes: ["spec"], folders: ["__tests__"] } }),
    ).toBe(expected);
  });
});

describe("TypeScript source eligibility", () => {
  it.each([
    { file: "src/route.ts", kind: "production", eligibility: "eligible" },
    { file: "src/route.spec.tsx", kind: "test", eligibility: "eligible" },
    { file: "src/route.test.ts", kind: "test", eligibility: "eligible" },
    { file: "src/route.test.mts", kind: "skipped", eligibility: "eligible" },
    { file: "src/route.spec.cts", kind: "skipped", eligibility: "eligible" },
    { file: "src/route.check.ts", kind: "production", eligibility: "eligible" },
    { file: "src/route.cts", kind: "production", eligibility: "eligible" },
    { file: "src/route.d.mts", kind: "skipped", eligibility: "skipped" },
    { file: "src/route.d.tsx", kind: "production", eligibility: "eligible" },
    { file: "dist/route.spec.ts", kind: "skipped", eligibility: "skipped" },
    { file: "src/route.js", kind: "skipped", eligibility: "skipped" },
  ])("classifies $file as $kind", ({ file, kind, eligibility }) => {
    expect(typeScriptSourceKindOf({ file, testFiles: DEFAULT_TEST_FILES })).toBe(kind);
    expect(typeScriptSourceEligibility({ file })).toBe(eligibility);
  });
});
