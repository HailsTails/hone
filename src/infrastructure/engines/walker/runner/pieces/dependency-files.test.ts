import { describe, expect, it, vi } from "vitest";

import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import {
  dependencySourceOf,
  fieldsOf,
  packageManifestOf,
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

describe("packageManifestOf", () => {
  it("reports a manifest with a trailing comma as unparseable", () => {
    const file = repoPathSchema.parse("packages/example/package.json");
    expect(
      packageManifestOf({
        file,
        readText: () => ({ outcome: "ok", value: '{"name": "example",}' }),
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "file-unparseable", file } });
  });
});

describe("fieldsOf", () => {
  it.each([null, "name", 7, ["name"]])("returns no fields for %j", (value: unknown) => {
    expect(fieldsOf(value)).toEqual([]);
  });
});
