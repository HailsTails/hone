import { assert, describe, expect, it } from "vitest";

import { disciplineIdOf } from "../../src/domain/rule-set/discipline-id-of.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { readHeldDiscipline } from "../../src/infrastructure/content-files/rule-sets/held-discipline.ts";
import classAuthoringPlugin from "../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";
import { eslintPluginModuleSchema } from "../../src/infrastructure/engines/eslint/runner/pieces/eslint-plugin-schema.ts";
import { createEslintPort } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";

const PIECE_ROOT = absolutePathSchema.parse(
  `${import.meta.dirname}/../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword`,
);

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../..`);

const loadedDiscipline = readHeldDiscipline({
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
  ruleSetRoot: INSTALL_ROOT,
  installRoot: INSTALL_ROOT,
  discipline: disciplineIdOf("CD-14"),
});
assert(loadedDiscipline.outcome === "ok", "CD-14 reads through the install's discipline reader");
const heldDiscipline = loadedDiscipline.value;
assert(heldDiscipline.held === "present", "the install holds CD-14");
const shippedDiscipline = heldDiscipline.file;
const [classSyntax] = shippedDiscipline.clauses;
assert.isDefined(classSyntax, "CD-14 declares a first clause");
assert(classSyntax.kind === "mechanical", "CD-14 declares its first clause as a mechanical clause");
const sharedCases = classSyntax.cases;

const loadedPlugin = eslintPluginModuleSchema.parse({ default: classAuthoringPlugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: `${import.meta.dirname}/../..`,
    installForm: "source",
  }),
});
assert(
  loadedToolchain.outcome === "ok",
  "the eslint-10 toolchain loads from the development install",
);
assert(
  /^10\./.test(loadedToolchain.value.eslintVersion),
  `the eslint-10 toolchain runs ESLint ${loadedToolchain.value.eslintVersion}`,
);

const eslint = createEslintPort({ toolchain: loadedToolchain.value });

describe("CD-14 as the install's discipline reader assembles it", () => {
  it("declares exactly class-syntax, static-only-class and library-construction, in that order, with class-syntax mechanical", () => {
    expect(shippedDiscipline.clauses).toMatchObject([
      { id: "class-syntax", kind: "mechanical" },
      { id: "static-only-class" },
      { id: "library-construction" },
    ]);
  });
});

describe("CD-14 no-class-authoring rule, over the shipped class-syntax cases, through the ESLint runner's lintSourceCases", () => {
  it.each([...sharedCases.flag, ...sharedCases.allow])(
    "flags exactly the expected lines of the case $name",
    async (sharedCase) => {
      expect(
        await eslint.lintSourceCases({
          cwd: PIECE_ROOT,
          plugin: loadedPlugin,
          pluginNamespace: "hone",
          rule: "no-class-authoring",
          options: [],
          cases: [sharedCase],
        }),
      ).toEqual({
        outcome: "ok",
        value: [{ caseName: sharedCase.name, flaggedLines: sharedCase.expectedLines }],
      });
    },
  );
});
