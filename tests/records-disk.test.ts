import { describe, expect, it } from "vitest";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../src/infrastructure/hone-records-folder/repo-path.ts";
import { recordsDisk } from "./records-disk.ts";

const FOLDER = absolutePathSchema.parse("/repo/records");

const NESTED = absolutePathSchema.parse("/repo/records/nested");

describe("recordsDisk working files", () => {
  it("reads a held file, says a folder holding files is present, and lists a folder's children by name", () => {
    const disk = recordsDisk({ working: { "records/b.json": "b", "records/nested/a.json": "a" }, base: {} });

    expect({
      read: disk.ports.fileText.read({ path: "/repo/records/b.json" }),
      folder: disk.ports.fileText.exists({ path: "/repo/records" }),
      missing: disk.ports.fileText.exists({ path: "/repo/elsewhere" }),
      listed: disk.ports.directory.list({ path: FOLDER }),
    }).toEqual({
      read: { outcome: "ok", value: "b" },
      folder: "present",
      missing: "absent",
      listed: { outcome: "ok", value: [{ name: "b.json", kind: "file" }, { name: "nested", kind: "directory" }] },
    });
  });

  it("keeps what is written, forgets what is removed, and counts a created folder as present", () => {
    const disk = recordsDisk({ working: { "old.json": "old" }, base: {} });

    disk.ports.fileText.write({ path: "/repo/new.json", text: "new" });
    disk.ports.fileRemoval.remove({ path: "/repo/old.json" });
    disk.ports.directory.create({ path: NESTED });

    expect({ texts: disk.texts(), created: disk.ports.fileText.exists({ path: "/repo/records/nested" }) }).toEqual({
      texts: { "new.json": "new" },
      created: "present",
    });
  });
});

describe("recordsDisk base revision", () => {
  it("lists the base's paths and reads its texts", () => {
    const disk = recordsDisk({ working: {}, base: { "records/a.json": "a" } });
    const file = repoPathSchema.parse("records/a.json");

    expect({
      paths: disk.ports.gitTree.pathsAt({ repoRoot: disk.repoRoot, revision: "main" }),
      text: disk.ports.git.textInBase({ repoRoot: disk.repoRoot, baseRevision: "main", file }),
      missing: disk.ports.git.textInBase({ repoRoot: disk.repoRoot, baseRevision: "main", file: repoPathSchema.parse("records/b.json") }),
    }).toEqual({
      paths: { outcome: "ok", value: ["records/a.json"] },
      text: { outcome: "ok", value: { presence: "present-in-base", text: "a" } },
      missing: { outcome: "ok", value: { presence: "absent-from-base" } },
    });
  });
});
