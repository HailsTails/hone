import { describe, expect, it } from "vitest";
import { directoryOf, relativeSpecifierOf, resolvedPathOf } from "./relative-specifier.ts";

describe("directoryOf", () => {
  it.each([
    { file: "eslint.config.mjs", directory: [] },
    { file: "web/eslint.config.mjs", directory: ["web"] },
    { file: "packages/web/eslint.config.mjs", directory: ["packages", "web"] },
  ])("gives the folders above $file", ({ file, directory }) => {
    expect(directoryOf({ file })).toEqual(directory);
  });
});

describe("resolvedPathOf", () => {
  it.each([
    { directory: [], specifier: "./disciplines.eslint.mjs", path: "disciplines.eslint.mjs" },
    { directory: ["web"], specifier: "../disciplines.eslint.mjs", path: "disciplines.eslint.mjs" },
    { directory: ["packages", "web"], specifier: "../../disciplines.eslint.mjs", path: "disciplines.eslint.mjs" },
    { directory: ["web"], specifier: "./rules/local.mjs", path: "web/rules/local.mjs" },
    { directory: ["web"], specifier: "../web/./local.mjs", path: "web/local.mjs" },
  ])("resolves $specifier from $directory to $path", ({ directory, specifier, path }) => {
    expect(resolvedPathOf({ directory, specifier })).toBe(path);
  });

  it("resolves nothing for a specifier that climbs out of the repository", () => {
    expect(resolvedPathOf({ directory: ["web"], specifier: "../../outside.mjs" })).toBeUndefined();
  });
});

describe("relativeSpecifierOf", () => {
  it.each([
    { directory: [], target: "hone.eslint.mjs", specifier: "./hone.eslint.mjs" },
    { directory: ["web"], target: "hone.eslint.mjs", specifier: "../hone.eslint.mjs" },
    { directory: ["packages", "web"], target: "hone.eslint.mjs", specifier: "../../hone.eslint.mjs" },
    { directory: ["web"], target: "web/rules/local.mjs", specifier: "./rules/local.mjs" },
    { directory: ["packages", "web"], target: "packages/api/hone.eslint.mjs", specifier: "../api/hone.eslint.mjs" },
  ])("writes $target from $directory as $specifier", ({ directory, target, specifier }) => {
    expect(relativeSpecifierOf({ directory, target })).toBe(specifier);
  });
});
