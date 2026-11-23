import { describe, expect, it } from "vitest";

import {
  folderScope,
  javaScriptTestEligibility,
  testFileEligibility,
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

describe("testFileEligibility", () => {
  it.each([
    { file: "src/order.test.ts", expected: "eligible" },
    { file: "src/order.test.tsx", expected: "eligible" },
    { file: "src/order.spec.ts", expected: "eligible" },
    { file: "src/order.spec.tsx", expected: "eligible" },
    { file: "src/order.spec.mts", expected: "eligible" },
    { file: "src/order.spec.cts", expected: "eligible" },
    { file: "src/order.test.mts", expected: "eligible" },
    { file: "src/order.test.cts", expected: "eligible" },
    { file: "src/order.d.ts", expected: "skipped" },
    { file: "node_modules/order.test.ts", expected: "skipped" },
  ])("scopes $file as $expected", ({ file, expected }) => {
    expect(testFileEligibility({ file })).toBe(expected);
  });
});

describe("javaScriptTestEligibility", () => {
  it.each([
    { file: "src/order.test.js", expected: "eligible" },
    { file: "src/order.test.mjs", expected: "eligible" },
    { file: "src/order.spec.mjs", expected: "eligible" },
    { file: "src/order.spec.js", expected: "skipped" },
    { file: "build/order.test.js", expected: "skipped" },
  ])("classifies $file as $expected", ({ file, expected }) => {
    expect(javaScriptTestEligibility({ file })).toBe(expected);
  });
});

describe("TypeScript source eligibility", () => {
  it.each([
    { file: "src/route.ts", kind: "production" },
    { file: "src/route.spec.tsx", kind: "test" },
    { file: "src/route.test.mts", kind: "test" },
    { file: "src/route.test.cts", kind: "test" },
    { file: "src/route.cts", kind: "production" },
    { file: "src/route.d.mts", kind: "skipped" },
    { file: "src/route.d.tsx", kind: "production" },
    { file: "dist/route.spec.ts", kind: "skipped" },
    { file: "src/route.js", kind: "skipped" },
  ])("classifies $file as $kind", ({ file, kind }) => {
    expect(typeScriptSourceKindOf({ file })).toBe(kind);
  });
});
