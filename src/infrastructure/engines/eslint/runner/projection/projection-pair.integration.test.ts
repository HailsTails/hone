import { afterAll, assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { createSymptomCatalogueRepository } from "../../../../content-files/symptom-catalogues/read-symptom-catalogue.ts";
import { createSettingsSources } from "../../../../hone-config-file/settings-sources.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { type AnsweredFile, checksProjectionText } from "./checks-projection.ts";
import { type ProjectedBinding, projectedChecksOf } from "./projected-checks.ts";
import { resolvedConfigSchema } from "../toolchain/eslint-config-schema.ts";
import { createDefaultDirectoryTreePort } from "../../../../node/file-system/directory-tree-port.ts";
import { createDefaultDirectoryPort } from "../../../../node/file-system/file-system-port.ts";
import type { EslintClass } from "../toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, type EslintToolchainModules } from "../toolchain/eslint-toolchain.ts";
import { eslint9ToolchainModules } from "../toolchain/eslint-9/eslint-9-engine.ts";

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

const DEVELOPMENT_PEERS = defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../../../../../..`, installForm: "source" });

const ESLINT_MODULES: Readonly<Record<EslintLine, EslintToolchainModules>> = {
  "eslint-10": DEVELOPMENT_PEERS.modules,
  "eslint-9": eslint9ToolchainModules,
};

const eslintClassOn = (request: { readonly line: EslintLine }): Promise<EslintClass> =>
  ESLINT_MODULES[request.line].eslint().then((eslintModule) => eslintModule.ESLint);

type SpecifierOf = (request: { readonly modulePath: string }) => string;

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "..", "..", "..", "..", "..", ".."] }) });

const ESLINT = mechanismIdSchema.parse("eslint");

const LEGACY = repoPathSchema.parse("src/legacy.ts");

const WIDE = repoPathSchema.parse("src/wide.ts");

const SKIPPING = repoPathSchema.parse("src/skipping.test.ts");

const VERSION_TWO_CLAUSES = [
  clauseAddressSchema.parse("CD-2#non-null-assertions"),
  clauseAddressSchema.parse("CD-6#naming-convention"),
  clauseAddressSchema.parse("CD-14#class-syntax"),
  clauseAddressSchema.parse("CD-14#static-only-class"),
  clauseAddressSchema.parse("CD-27#focused-tests"),
  clauseAddressSchema.parse("CD-27#skipped-tests"),
  clauseAddressSchema.parse("CD-40#parameter-count"),
  clauseAddressSchema.parse("CD-44#parameter-reassignment"),
];

const VERSION_TWO_ANSWERED: readonly AnsweredFile[] = [
  { symptom: "claimed-type", file: LEGACY },
  { symptom: "rebinding", file: LEGACY },
  { symptom: "positional-parameters", file: WIDE },
  { symptom: "test-switched-off", check: "skipped-tests", file: SKIPPING },
];

const specifierOf: SpecifierOf = ({ modulePath }) => {
  const location = path.relative({ from: import.meta.dirname, to: modulePath });
  assert(location.relation === "within-root", `${modulePath} is on this test's root`);
  return import.meta.resolve(location.path);
};

const catalogue = () => {
  const reading = createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: INSTALL_ROOT }).read({});
  assert(reading.outcome === "ok", "this repository's catalogue reads");
  assert(reading.value.held === "catalogue", "this repository holds a catalogue");
  return reading.value.catalogue;
};

const bindingOf = (request: { readonly clause: (typeof VERSION_TWO_CLAUSES)[number] }): ProjectedBinding => {
  const sources = createSettingsSources({ repoRoot: INSTALL_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path });
  const piece = sources.pieceClause({ ruleSetRoot: INSTALL_ROOT, clause: request.clause, mechanism: ESLINT });
  assert(piece.outcome === "ok", `${request.clause.clause} resolves its eslint piece`);
  return { mechanism: ESLINT, clause: { address: request.clause, pieceRoot: piece.value.pieceRoot, settings: piece.value.settings } };
};

const versionTwoText = (): string => {
  const checks = projectedChecksOf({ checks: catalogue().checks, bindings: VERSION_TWO_CLAUSES.map((clause) => bindingOf({ clause })) });
  assert(checks.outcome === "ok", "the version 2 checks project");
  return checksProjectionText({
    pluginImport: specifierOf({ modulePath: path.join({ segments: [INSTALL_ROOT, "src", "eslint-plugin.ts"] }) }),
    checks: checks.value,
    answered: VERSION_TWO_ANSWERED,
  });
};

const directory = createDefaultDirectoryPort({});

const directoryTree = createDefaultDirectoryTreePort({});

const SCRATCH = resolvedPath({ path: path.join({ segments: [INSTALL_ROOT, "artefacts", `projection-pair-${globalThis.crypto.randomUUID()}`] }) });

const madeScratch = directory.create({ path: SCRATCH });

assert(madeScratch.outcome === "ok", "a scratch folder is made for the projection");

const writtenConfig = (request: { readonly name: string; readonly text: string }): string => {
  const configPath = path.join({ segments: [SCRATCH, request.name] });
  const written = fileText.write({ path: configPath, text: request.text });
  assert(written.outcome === "ok", `${request.name} is written`);
  return configPath;
};

const VERSION_TWO_CONFIG = writtenConfig({ name: "version-two.eslint.mjs", text: versionTwoText() });

const ADOPTER_CONFIG = writtenConfig({
  name: "adopter.eslint.mjs",
  text: `import parser from "${import.meta.resolve("@typescript-eslint/parser")}";\nimport projection from "./version-two.eslint.mjs";\nexport default [{ files: ["**/*.ts"], languageOptions: { parser } }, ...projection];\n`,
});

const LINTED_SOURCE = 'it.skip("a", () => {});\nexport const a = (b: string | undefined): string => b!;\nexport const c = (d: string, e: string, f: string): string => d + e + f;\n';

const resolvedRules = async (request: { readonly line: EslintLine; readonly config: string; readonly file: string }) => {
  const Eslint = await eslintClassOn({ line: request.line });
  const resolved = await new Eslint({ cwd: SCRATCH, overrideConfigFile: request.config }).calculateConfigForFile(path.join({ segments: [SCRATCH, request.file] }));
  const config = resolvedConfigSchema.parse(resolved);
  assert.isDefined(config);
  const { rules } = config;
  assert.isDefined(rules);
  return rules;
};

const lintedMessages = async (request: { readonly line: EslintLine }) => {
  const Eslint = await eslintClassOn({ line: request.line });
  const [linted] = await new Eslint({ cwd: SCRATCH, overrideConfigFile: ADOPTER_CONFIG }).lintText(LINTED_SOURCE, {
    filePath: path.join({ segments: [SCRATCH, "src", "kept.ts"] }),
  });
  assert.isDefined(linted);
  return linted.messages;
};

afterAll(() => {
  const removed = directoryTree.remove({ path: SCRATCH });
  assert(removed.outcome === "ok", "the scratch folder is removed");
});

describe.each(ESLINT_LINES)("the version 2 projection on %s", (line) => {
  it("switches off, on a file its records answer, only the rules of the symptoms they answer", async () => {
    expect(await resolvedRules({ line, config: VERSION_TWO_CONFIG, file: "src/legacy.ts" })).toMatchObject({
      "hone/claimed-type#non-null-assertions": [
        0,
        { selector: "TSNonNullExpression", message: "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead." },
        {
          selector: "[definite=true]",
          message: "CD-2: a definite assignment assertion claims an assignment the compiler cannot see; initialise the binding instead.",
        },
      ],
      "hone/rebinding#parameter-reassignment": [0, { props: false }],
      "hone/positional-parameters#parameter-count": [2, { max: 2, countVoidThis: true }],
      "hone/test-switched-off#skipped-tests": [2],
    });
  });

  it("switches off, on a file a record answers for one check of a symptom with two, only that check's rule", async () => {
    expect(await resolvedRules({ line, config: VERSION_TWO_CONFIG, file: "src/skipping.test.ts" })).toMatchObject({
      "hone/test-switched-off#skipped-tests": [0],
      "hone/test-switched-off#focused-tests": [2],
    });
  });

  it("reports through the adopter's own config, each message under its symptom's title", async () => {
    expect(await lintedMessages({ line })).toMatchObject([
      { ruleId: "hone/test-switched-off#skipped-tests", line: 1, message: "Test switched off: remove the skip so the test runs, or delete the test." },
      {
        ruleId: "hone/claimed-type#non-null-assertions",
        line: 2,
        message: "Claimed type: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
      },
      {
        ruleId: "hone/positional-parameters#parameter-count",
        line: 3,
        message: "Positional parameters: Arrow function has too many parameters (3). Maximum allowed is 2.",
      },
    ]);
  });
});
