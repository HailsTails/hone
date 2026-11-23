import { describe, expect, it, vi } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import { moduleOriginOf, ownPackageNamesOf } from "./own-modules.ts";

describe("own package names", () => {
  it("names every tracked package.json outside generated folders", () => {
    expect(
      ownPackageNamesOf({
        repository: {
          files: [
            repoPathOf("package.json"),
            repoPathOf("packages/paths/package.json"),
            repoPathOf("node_modules/react/package.json"),
            repoPathOf("packages/paths/dist/package.json"),
            repoPathOf("src/a.test.ts"),
          ],
          exists: vi.fn().mockReturnValue("present"),
          disk: textsDisk({
            root: "/repo",
            texts: {
              "package.json": '{ "name": "app" }',
              "packages/paths/package.json": '{ "name": "@app/paths" }',
              "node_modules/react/package.json": '{ "name": "react" }',
              "packages/paths/dist/package.json": '{ "name": "@app/paths-dist" }',
              "src/a.test.ts": "",
            },
          }),
        },
      }),
    ).toEqual(["app", "@app/paths"]);
  });

  it("names nothing for a manifest without a name or that does not parse", () => {
    expect(
      ownPackageNamesOf({
        repository: {
          files: [repoPathOf("package.json"), repoPathOf("packages/paths/package.json")],
          exists: vi.fn().mockReturnValue("present"),
          disk: textsDisk({
            root: "/repo",
            texts: {
              "package.json": '{ "private": true }',
              "packages/paths/package.json": "{ name",
            },
          }),
        },
      }),
    ).toEqual([]);
  });
});

describe("module origin", () => {
  it.each([
    { specifier: "./paths.ts", origin: "own" },
    { specifier: "#src/paths.ts", origin: "own" },
    { specifier: "@app/paths", origin: "own" },
    { specifier: "@app/paths/posix", origin: "own" },
    { specifier: "@app/paths-extra", origin: "outside" },
    { specifier: "node:path", origin: "outside" },
  ])("places $specifier as $origin", ({ specifier, origin }) => {
    expect(moduleOriginOf({ specifier, ownPackageNames: ["@app/paths"] })).toBe(origin);
  });
});
