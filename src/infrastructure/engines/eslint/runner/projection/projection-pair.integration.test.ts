import { afterAll, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { AnsweredFile } from "../../../../../domain/runner/checks-run-report.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createDefaultDirectoryTreePort } from "../../../../node/file-system/directory-tree-port.ts";
import { createDefaultDirectoryPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { eslint9ToolchainModules } from "../toolchain/eslint-9/eslint-9-engine.ts";
import { resolvedConfigSchema } from "../toolchain/eslint-config-schema.ts";
import type { EslintClass } from "../toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
} from "../toolchain/eslint-toolchain.ts";
import { checksProjectionText, type ProjectedCheck } from "./checks-projection.ts";

const ESLINT_LINES: readonly ("eslint-10" | "eslint-9")[] = ["eslint-10", "eslint-9"];

const DEVELOPMENT_PEERS = defaultEslintToolchainPeers({
  installRoot: `${import.meta.dirname}/../../../../../..`,
  installForm: "source",
});

const ESLINT_MODULES: Readonly<Record<(typeof ESLINT_LINES)[number], EslintToolchainModules>> = {
  "eslint-10": DEVELOPMENT_PEERS.modules,
  "eslint-9": eslint9ToolchainModules,
};

const eslintClassOn = (request: {
  readonly line: (typeof ESLINT_LINES)[number];
}): Promise<EslintClass> =>
  ESLINT_MODULES[request.line].eslint().then((eslintModule) => eslintModule.ESLint);

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const INSTALL_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", "..", "..", "..", "..", ".."] }),
);

const LEGACY = repoPathOf("src/legacy.ts");

const WIDE = repoPathOf("src/wide.ts");

const SKIPPING = repoPathOf("src/skipping.test.ts");

const VERSION_TWO_ANSWERED: readonly AnsweredFile[] = [
  { ruleSet: "hone", symptom: "claimed-type", file: LEGACY },
  { ruleSet: "hone", symptom: "rebinding", file: LEGACY },
  { ruleSet: "hone", symptom: "positional-parameters", file: WIDE },
  { ruleSet: "hone", symptom: "test-switched-off", check: "skipped-tests", file: SKIPPING },
];

const CHECKS: readonly ProjectedCheck[] = [
  {
    ruleSet: "hone",
    symptom: "claimed-type",
    check: "non-null-assertions",
    ruleId: "hone/claimed-type#non-null-assertions",
    options: [
      {
        selector: "TSNonNullExpression",
        message:
          "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
      },
      {
        selector: "[definite=true]",
        message:
          "CD-2: a definite assignment assertion claims a value the compiler cannot see; initialise the binding instead.",
      },
    ],
  },
  {
    ruleSet: "hone",
    symptom: "rebinding",
    check: "parameter-reassignment",
    ruleId: "hone/rebinding#parameter-reassignment",
    options: [{ props: false }],
  },
  {
    ruleSet: "hone",
    symptom: "positional-parameters",
    check: "parameter-count",
    ruleId: "hone/positional-parameters#parameter-count",
    options: [{ max: 2, countVoidThis: true }],
  },
  {
    ruleSet: "hone",
    symptom: "test-switched-off",
    check: "skipped-tests",
    ruleId: "hone/test-switched-off#skipped-tests",
    options: [],
  },
  {
    ruleSet: "hone",
    symptom: "test-switched-off",
    check: "focused-tests",
    ruleId: "hone/test-switched-off#focused-tests",
    options: [],
  },
];

const directory = createDefaultDirectoryPort({});
const directoryTree = createDefaultDirectoryTreePort({});
const SCRATCH = absolutePathSchema.parse(
  path.join({ segments: [INSTALL_ROOT, "artefacts", "projection-pair"] }),
);
const VERSION_TWO_CONFIG = path.join({ segments: [SCRATCH, "version-two.eslint.mjs"] });
const ADOPTER_CONFIG = path.join({ segments: [SCRATCH, "adopter.eslint.mjs"] });
const FIXTURE_WRITES = [
  directory.create({ path: SCRATCH }),
  fileText.write({
    path: VERSION_TWO_CONFIG,
    text: checksProjectionText({
      kind: "mjs",
      pluginImport: import.meta.resolve("../../../../../eslint-plugin.ts"),
      checks: CHECKS,
      answered: VERSION_TWO_ANSWERED,
    }),
  }),
  fileText.write({
    path: ADOPTER_CONFIG,
    text: `import parser from "${import.meta.resolve("@typescript-eslint/parser")}";\nimport projection from "./version-two.eslint.mjs";\nexport default [{ files: ["**/*.ts"], languageOptions: { parser } }, ...projection];\n`,
  }),
];
const WRITTEN_FIXTURE = [
  { outcome: "ok", value: undefined },
  { outcome: "ok", value: undefined },
  { outcome: "ok", value: undefined },
];

const LINTED_SOURCE =
  'it.skip("a", () => {});\nexport const a = (b: string | undefined): string => b!;\nexport const c = (d: string, e: string, f: string): string => d + e + f;\n';

const resolvedRules = async (request: {
  readonly line: (typeof ESLINT_LINES)[number];
  readonly config: string;
  readonly file: string;
}) => {
  const Eslint = await eslintClassOn({ line: request.line });
  const resolved = await new Eslint({
    cwd: SCRATCH,
    overrideConfigFile: request.config,
  }).calculateConfigForFile(path.join({ segments: [SCRATCH, request.file] }));
  return resolvedConfigSchema.parse(resolved);
};

const lintedFiles = async (request: { readonly line: (typeof ESLINT_LINES)[number] }) => {
  const Eslint = await eslintClassOn({ line: request.line });
  return new Eslint({ cwd: SCRATCH, overrideConfigFile: ADOPTER_CONFIG }).lintText(LINTED_SOURCE, {
    filePath: path.join({ segments: [SCRATCH, "src", "kept.ts"] }),
  });
};

afterAll(() => {
  directoryTree.remove({ path: SCRATCH });
});

describe.each(ESLINT_LINES)("the version 2 projection on %s", (line) => {
  it("switches off, on a file its records answer, only the rules of the symptoms they answer", async () => {
    const resolved = await resolvedRules({
      line,
      config: VERSION_TWO_CONFIG,
      file: "src/legacy.ts",
    });

    expect(FIXTURE_WRITES).toEqual(WRITTEN_FIXTURE);
    expect(resolved).toMatchObject({
      rules: {
        "hone/claimed-type#non-null-assertions": [
          0,
          {
            selector: "TSNonNullExpression",
            message:
              "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
          },
          {
            selector: "[definite=true]",
            message:
              "CD-2: a definite assignment assertion claims an assignment the compiler cannot see; initialise the binding instead.",
          },
        ],
        "hone/rebinding#parameter-reassignment": [0, { props: false }],
        "hone/positional-parameters#parameter-count": [2, { max: 2, countVoidThis: true }],
        "hone/test-switched-off#skipped-tests": [2],
      },
    });
  });

  it("switches off, on a file a record answers for one check of a symptom with two, only that check's rule", async () => {
    const resolved = await resolvedRules({
      line,
      config: VERSION_TWO_CONFIG,
      file: "src/skipping.test.ts",
    });

    expect(FIXTURE_WRITES).toEqual(WRITTEN_FIXTURE);
    expect(resolved).toMatchObject({
      rules: {
        "hone/test-switched-off#skipped-tests": [0],
        "hone/test-switched-off#focused-tests": [2],
      },
    });
  });

  it("reports through the adopter's own config, each message under its symptom's title", async () => {
    const linted = await lintedFiles({ line });

    expect(FIXTURE_WRITES).toEqual(WRITTEN_FIXTURE);
    expect(linted).toMatchObject([
      {
        messages: [
          {
            ruleId: "hone/test-switched-off#skipped-tests",
            line: 1,
            message: "Test switched off: remove the skip so the test runs, or delete the test.",
          },
          {
            ruleId: "hone/claimed-type#non-null-assertions",
            line: 2,
            message:
              "Claimed type: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
          },
          {
            ruleId: "hone/positional-parameters#parameter-count",
            line: 3,
            message:
              "Positional parameters: Arrow function has too many parameters (3). Maximum allowed is 2.",
          },
        ],
      },
    ]);
  });
});
