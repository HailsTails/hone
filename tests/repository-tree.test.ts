import { afterAll, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultScratchFilesPort } from "../delivery/install-proof/install-proof-ports.ts";
import { listedPathsOf, treeOf } from "./repository-tree.ts";
import { scratchRepositoriesUnder } from "./scratch-repositories.ts";
import { repositoryWithSubfolder } from "./subfolder-scratch-repository.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

afterAll(() => {
  repositories.removeAll();
});

const repository = (): string =>
  repositoryWithSubfolder({ repositories, scratch, fileText, files: { "b.txt": "b\n", "a.txt": "a\n" }, subfolder: "src", subfolderFiles: { "c.ts": "c\n" } });

describe("listedPathsOf", () => {
  it("lists every file and folder under the repository in sorted order, folders with a trailing slash", () => {
    expect(listedPathsOf({ repo: repository() })).toEqual(["a.txt", "b.txt", "src/", "src/c.ts"]);
  });
});

describe("treeOf", () => {
  it("maps each listed path to the text of the file, or a folder mark", () => {
    expect(treeOf({ repo: repository() })).toEqual({ "a.txt": "a\n", "b.txt": "b\n", "src/": "<folder>", "src/c.ts": "c\n" });
  });
});
