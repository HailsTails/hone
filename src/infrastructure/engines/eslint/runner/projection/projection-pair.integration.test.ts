import { afterAll, assert, describe, expect, it } from "vitest";
import { createSelectionRepository } from "../../../../disciplines-file/consumer-selection.ts";
import type { ExceptionRecord } from "../../../../discipline-exceptions-folder/exception-records.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { createSettingsRepository } from "../../../../../application/run/settings/read-settings.ts";
import { createSettingsSources } from "../../../../hone-config-file/settings-sources.ts";
import { createSymptomCatalogueRepository } from "../../../../content-files/symptom-catalogues/read-symptom-catalogue.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { type AnsweredFile, checksProjectionText } from "./checks-projection.ts";
import { projectedChecksOf } from "./projected-checks.ts";
import { resolvedConfigSchema } from "../toolchain/eslint-config-schema.ts";
import { projectionText } from "./projection-text.ts";
import { createDefaultScratchFilesPort } from "../../../../../../delivery/install-proof/install-proof-ports.ts";
import { repositoryRootOf } from "../../../../../../tests/allowed-forms-proof.ts";
import { ESLINT_LINES, type EslintLine, eslintClassOn } from "../../../../../../tests/eslint-toolchains.ts";
import { inCheckRuleIds, type SpecifierOf, versionOnePiecesOf } from "../../../../../../tests/projection-pair.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: repositoryRootOf({ testFolder: `${import.meta.dirname}/../../../../../../tests` }) });

const BEFORE_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "projection-pair", "before"] }) });

const AFTER_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "projection-pair", "after"] }) });

const ESLINT = mechanismIdSchema.parse("eslint");

const LEGACY = repoPathSchema.parse("src/legacy.ts");

const WIDE = repoPathSchema.parse("src/wide.ts");

const SKIPPING = repoPathSchema.parse("src/skipping.test.ts");

const VERSION_ONE_RECORDS: readonly ExceptionRecord[] = [
  { kind: "file-carve-out", clause: clauseAddressSchema.parse("CD-2#non-null-assertions"), mechanism: ESLINT, file: LEGACY },
  {
    kind: "authorised-location",
    clause: clauseAddressSchema.parse("CD-44#parameter-reassignment"),
    mechanism: ESLINT,
    file: LEGACY,
    reason: "a reducer rebinds its accumulator",
  },
  { kind: "file-carve-out", clause: clauseAddressSchema.parse("CD-40#parameter-count"), mechanism: ESLINT, file: WIDE },
  { kind: "file-carve-out", clause: clauseAddressSchema.parse("CD-27#skipped-tests"), mechanism: ESLINT, file: SKIPPING },
];

const VERSION_TWO_ANSWERED: readonly AnsweredFile[] = [
  { symptom: "claimed-type", file: LEGACY },
  { symptom: "rebinding", file: LEGACY },
  { symptom: "positional-parameters", file: WIDE },
  { symptom: "test-switched-off", check: "skipped-tests", file: SKIPPING },
];

const PROBED_FILES: readonly string[] = [
  "src/kept.ts",
  "src/legacy.ts",
  "src/wide.ts",
  "src/view.tsx",
  "tools/build.mts",
  "index.cts",
  "packages/web/src/deep/kept.ts",
  "src/skipping.test.ts",
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

const versionOneBindings = () => {
  const reading = createSelectionRepository({ repoRoot: BEFORE_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path }).read({});
  assert(reading.outcome === "ok", "the pair's version 1 file loads");
  return reading.value.bindings;
};

const versionTwoBindings = () => {
  const sources = createSettingsSources({ repoRoot: AFTER_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path });
  const reading = createSettingsRepository({ sources }).read({});
  assert(reading.outcome === "ok", "the pair's version 2 file loads");
  return reading.value.selection.bindings;
};

const versionOneText = (): string =>
  projectionText({ selectedPieces: versionOnePiecesOf({ bindings: versionOneBindings(), path, specifierOf }), records: VERSION_ONE_RECORDS });

const versionTwoText = (): string => {
  const checks = projectedChecksOf({ checks: catalogue().checks, bindings: versionTwoBindings() });
  assert(checks.outcome === "ok", "the pair's version 2 checks project");
  return checksProjectionText({
    pluginImport: specifierOf({ modulePath: path.join({ segments: [INSTALL_ROOT, "src", "eslint-plugin.ts"] }) }),
    checks: checks.value,
    answered: VERSION_TWO_ANSWERED,
  });
};

const scratchFolder = scratch.createTemporaryDirectory({ prefix: "hone-projection-pair-" });

assert(scratchFolder.outcome === "ok", "a scratch folder is made for the two projections");

const SCRATCH = scratchFolder.value;

const writtenConfig = (request: { readonly name: string; readonly text: string }): string => {
  const configPath = path.join({ segments: [SCRATCH, request.name] });
  const written = fileText.write({ path: configPath, text: request.text });
  assert(written.outcome === "ok", `${request.name} is written`);
  return configPath;
};

const VERSION_ONE_CONFIG = writtenConfig({ name: "version-one.eslint.mjs", text: versionOneText() });

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
  scratch.removeTree({ path: SCRATCH });
});

describe.each(ESLINT_LINES)("on %s, the version 1 projection and its version 2 form", (line) => {
  it.each(PROBED_FILES)("enable the same rules with the same options on %s", async (file) => {
    const before = await resolvedRules({ line, config: VERSION_ONE_CONFIG, file });
    const after = await resolvedRules({ line, config: VERSION_TWO_CONFIG, file });
    expect(after).toEqual(inCheckRuleIds({ catalogue: catalogue(), bindings: versionOneBindings(), rules: before }));
  });

  it("switch off, on a file its records answer, only the rules of the symptoms they answer", async () => {
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

  it("switch off, on a file a record answers for one check of a symptom with two, only that check's rule", async () => {
    expect(await resolvedRules({ line, config: VERSION_TWO_CONFIG, file: "src/skipping.test.ts" })).toMatchObject({
      "hone/test-switched-off#skipped-tests": [0],
      "hone/test-switched-off#focused-tests": [2],
    });
  });

  it("report through the adopter's own config, each message under its symptom's title", async () => {
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