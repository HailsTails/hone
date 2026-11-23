import { assert, describe, expect, it, vi } from "vitest";

import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import {
  dependencySourceOf,
  locatedPackageManifestOf,
  PACKAGE_MANIFEST,
} from "./dependency-files.ts";
import type { WalkerFile } from "./walker-piece.ts";

describe("dependencySourceOf", () => {
  it.each(["src/index.ts", "packages/example/dist/package.json"])(
    "skips %s without reading it",
    (path) => {
      const readText = vi.fn<WalkerFile["readText"]>();
      expect(
        dependencySourceOf({
          file: repoPathSchema.parse(path),
          readText,
          accepts: PACKAGE_MANIFEST,
        }),
      ).toEqual({ outcome: "ok", value: undefined });
      expect(readText).not.toHaveBeenCalled();
    },
  );
});

describe("locatedPackageManifestOf", () => {
  it("reports a manifest with a trailing comma as unparseable", () => {
    const file = repoPathSchema.parse("packages/example/package.json");
    expect(
      locatedPackageManifestOf({
        file,
        readText: () => ({ outcome: "ok", value: '{"name": "example",}' }),
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "file-unparseable", file } });
  });
  it("locates a namespaced dependency across CRLF lines and omits intervening comments", () => {
    const manifest = locatedPackageManifestOf({
      file: repoPathSchema.parse("package.json"),
      readText: () => ({
        outcome: "ok",
        value:
          '{\r\n  "devDependencies": {\r\n    "@scope/dev.tool": // check the next release\r\n      "^4.0.0"\r\n  }\r\n}',
      }),
    });
    assert(manifest.outcome === "ok");
    assert.isDefined(manifest.value);
    const dependencySection = manifest.value.get("devDependencies");
    assert(dependencySection !== undefined);
    expect(dependencySection.fields.get("@scope/dev.tool")).toMatchObject({
      anchor: { line: 3, column: 4 },
      snippet: '"@scope/dev.tool": "^4.0.0"',
      value: "^4.0.0",
    });
    expect(dependencySection).toMatchObject({
      anchor: { line: 2, column: 2 },
      snippet: '"devDependencies"',
    });
    expect(manifest.value.has("dependencies")).toBe(false);
  });

  it("uses the last value and anchor when a property is repeated", () => {
    const manifest = locatedPackageManifestOf({
      file: repoPathSchema.parse("package.json"),
      readText: () => ({
        outcome: "ok",
        value: '{\n  "packageManager": "pnpm@1.2.3",\n  "packageManager": /* latest */ "pnpm@2"\n}',
      }),
    });
    assert(manifest.outcome === "ok");
    assert.isDefined(manifest.value);
    expect(manifest.value.get("packageManager")).toMatchObject({
      anchor: { line: 3, column: 2 },
      snippet: '"packageManager": "pnpm@2"',
      value: "pnpm@2",
    });
  });
  it.each(["null", '"name"', "7", '["name"]'])("returns no fields for %s", (source) => {
    expect(
      locatedPackageManifestOf({
        file: repoPathSchema.parse("package.json"),
        readText: () => ({ outcome: "ok", value: source }),
      }),
    ).toEqual({ outcome: "ok", value: new Map() });
  });
});
