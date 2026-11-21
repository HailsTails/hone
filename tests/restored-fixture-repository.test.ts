import { afterAll, assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../src/infrastructure/node/path-port.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultScratchFilesPort } from "../delivery/install-proof/install-proof-ports.ts";
import { listedPathsOf } from "./repository-tree.ts";
import { NO_TEXT_FILES, rehomedImports, restoredFixtureRepositoriesOver, STORED_LINT_CONFIG_NAME } from "./restored-fixture-repository.ts";
import { scratchRepositoriesUnder } from "./scratch-repositories.ts";

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const path = createDefaultPathPort({});

const parent = scratch.createTemporaryDirectory({ prefix: "hone-restored-fixture-" });

assert(parent.outcome === "ok", "a parent folder is made for the restored fixtures");

const repositories = scratchRepositoriesUnder({ parent: parent.value, fileText, scratch });

const restored = restoredFixtureRepositoriesOver({ repositories, scratch, fileText, path });

const fixtureRoot = absolutePathSchema.parse(`${parent.value}/deeper/a-fixture`);

scratch.makeDirectory({ path: `${fixtureRoot}/packages/a` });

fileText.write({ path: `${fixtureRoot}/${STORED_LINT_CONFIG_NAME}`, text: 'import projection from "./projection.mjs";\n' });

fileText.write({ path: `${fixtureRoot}/projection.mjs`, text: 'import piece from "../../../CD-14/plugin.ts";\n' });

fileText.write({ path: `${fixtureRoot}/packages/a/x.ts`, text: "export class Kept {}\n" });

fileText.write({ path: `${fixtureRoot}/packages/a/${STORED_LINT_CONFIG_NAME}`, text: 'import projection from "../../projection.mjs";\n' });

describe("rehomedImports", () => {
  it("points a relative import that leaves the fixture at the file it named, from where the module now sits, and leaves the rest as written", () => {
    expect(
      rehomedImports({
        text: 'import piece from "../../../CD-14/plugin.ts";\nimport own from "./own.mjs";\nimport pkg from "zod";\n',
        path,
        fixtureRoot: "/install/mechanisms/eslint/runner/test-fixtures/a",
        from: "/install/mechanisms/eslint/runner/test-fixtures/a",
        to: "/install/artefacts/scratch-1",
      }),
    ).toBe('import piece from "../../mechanisms/eslint/CD-14/plugin.ts";\nimport own from "./own.mjs";\nimport pkg from "zod";\n');
  });

  it("keeps an import of a folder inside the fixture whose name begins with two dots", () => {
    expect(
      rehomedImports({
        text: 'import own from "./..x/own.mjs";\n',
        path,
        fixtureRoot: "/install/mechanisms/eslint/runner/test-fixtures/a",
        from: "/install/mechanisms/eslint/runner/test-fixtures/a",
        to: "/install/artefacts/scratch-1",
      }),
    ).toBe('import own from "./..x/own.mjs";\n');
  });
});

describe("restoredFixtureRepositoriesOver", () => {
  it("copies the fixture into a scratch repository with every lint config under the name ESLint reads", () => {
    expect(listedPathsOf({ repo: restored.restoredFrom({ fixtureRoot, textFiles: NO_TEXT_FILES }) })).toEqual([
      "eslint.config.mjs",
      "packages/",
      "packages/a/",
      "packages/a/eslint.config.mjs",
      "packages/a/x.ts",
      "projection.mjs",
    ]);
  });

  it("restores a fixture once and hands the same repository to every later ask", () => {
    expect(restored.restoredFrom({ fixtureRoot, textFiles: NO_TEXT_FILES })).toBe(restored.restoredFrom({ fixtureRoot, textFiles: NO_TEXT_FILES }));
  });

  it("writes the text files it is given into the copy, beside the fixture's own files, in a folder the fixture does not hold", () => {
    const repo = restored.restoredFrom({ fixtureRoot, textFiles: { "named/inline.ts": "export class Kept {} // eslint-disable-line a-rule\n" } });
    expect({ listed: listedPathsOf({ repo }), text: fileText.read({ path: `${repo}/named/inline.ts` }) }).toEqual({
      listed: ["eslint.config.mjs", "named/", "named/inline.ts", "packages/", "packages/a/", "packages/a/eslint.config.mjs", "packages/a/x.ts", "projection.mjs"],
      text: { outcome: "ok", value: "export class Kept {} // eslint-disable-line a-rule\n" },
    });
  });

  it("hands a different repository to an ask that gives different text files", () => {
    expect(restored.restoredFrom({ fixtureRoot, textFiles: { "other.ts": "export const other = 1;\n" } })).not.toBe(restored.restoredFrom({ fixtureRoot, textFiles: NO_TEXT_FILES }));
  });

  it("rehomes the imports of the copied modules that leave the fixture, and keeps the ones inside it", () => {
    const repo = restored.restoredFrom({ fixtureRoot, textFiles: NO_TEXT_FILES });
    expect([
      fileText.read({ path: `${repo}/eslint.config.mjs` }),
      fileText.read({ path: `${repo}/projection.mjs` }),
      fileText.read({ path: `${repo}/packages/a/eslint.config.mjs` }),
    ]).toEqual([
      { outcome: "ok", value: 'import projection from "./projection.mjs";\n' },
      { outcome: "ok", value: 'import piece from "../../CD-14/plugin.ts";\n' },
      { outcome: "ok", value: 'import projection from "../../projection.mjs";\n' },
    ]);
  });
});

afterAll(() => {
  scratch.removeTree({ path: parent.value });
});
