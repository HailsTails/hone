import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultScratchFilesPort } from "../delivery/install-proof/install-proof-ports.ts";
import { scratchRepositoriesUnder } from "./scratch-repositories.ts";

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const parent = scratch.createTemporaryDirectory({ prefix: "hone-scratch-repositories-" });

assert(parent.outcome === "ok", "a parent folder is made for the scratch repositories");

const repositories = scratchRepositoriesUnder({ parent: parent.value, fileText, scratch });

describe("scratchRepositoriesUnder", () => {
  it("writes each named file into a folder of its own", () => {
    const folder = repositories.repositoryWith({ files: { "a.txt": "first", "b.txt": "second" } });
    expect([fileText.read({ path: `${folder}/a.txt` }), fileText.read({ path: `${folder}/b.txt` })]).toEqual([
      { outcome: "ok", value: "first" },
      { outcome: "ok", value: "second" },
    ]);
  });

  it("gives each repository its own folder", () => {
    expect(repositories.repositoryWith({ files: {} })).not.toBe(repositories.repositoryWith({ files: {} }));
  });

  it("removes every repository it made", () => {
    const folder = repositories.repositoryWith({ files: { "a.txt": "first" } });
    repositories.removeAll();
    expect(fileText.exists({ path: `${folder}/a.txt` })).toBe("absent");
  });
});

scratch.removeTree({ path: parent.value });
