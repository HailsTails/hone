import { afterAll, describe, expect, it } from "vitest";

import {
  type CheckAddressText,
  checkNamesOf,
} from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { AnsweredFile } from "../../../../../domain/runner/checks-run-report.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { readBoundCatalogue } from "../../../../content-files/symptom-catalogues/bound-catalogue.ts";
import { createCheckPieceSource } from "../../../../hone-config-file/settings-sources.ts";
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
import { checksProjectionText } from "./checks-projection.ts";
import { projectedNamedChecksOf } from "./projected-checks.ts";

const ESLINT_LINES = ["eslint-10", "eslint-9"] as const;

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

const ESLINT = "eslint" as const;

const LEGACY = repoPathOf("src/legacy.ts");

const WIDE = repoPathOf("src/wide.ts");

const SKIPPING = repoPathOf("src/skipping.test.ts");

const VERSION_TWO_ANSWERED: readonly AnsweredFile[] = [
  { ruleSet: "hone", symptom: "claimed-type", file: LEGACY },
  { ruleSet: "hone", symptom: "rebinding", file: LEGACY },
  { ruleSet: "hone", symptom: "positional-parameters", file: WIDE },
  { ruleSet: "hone", symptom: "test-switched-off", check: "skipped-tests", file: SKIPPING },
];

const catalogue = () => {
  const reading = readBoundCatalogue({
    ruleSet: "hone",
    inheritedRecordKinds: [],
    directory: createDefaultDirectoryPort({}),
    fileText,
    path,
    ruleSetRoot: INSTALL_ROOT,
    installRoot: INSTALL_ROOT,
  });
  return reading.outcome === "ok" && reading.value.held === "catalogue"
    ? reading.value.catalogue
    : undefined;
};

const bindingOf = (request: { readonly address: CheckAddressText }): CheckBinding | undefined => {
  const names = checkNamesOf({ text: request.address });
  if (names === undefined) return undefined;
  const readPiece = createCheckPieceSource({
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    fileText,
    path,
  });
  const piece = readPiece({ ruleSetRoot: INSTALL_ROOT, names, mechanism: ESLINT });
  if (piece.outcome === "failed") return undefined;
  return {
    address: request.address,
    ruleSet: "hone",
    engine: ESLINT,
    anchor: piece.value.anchor,
    pieceRoot: piece.value.pieceRoot,
    settings: piece.value.settings,
    checkSettings: {},
    edition: piece.value.editions.default,
  };
};

const versionTwoText = (): string | undefined => {
  const checks = catalogue()?.checks;
  const bindings = [
    bindingOf({ address: "claimed-type#non-null-assertions" }),
    bindingOf({ address: "name-off-its-casing#naming-convention" }),
    bindingOf({ address: "authored-class-or-this#class-keyword" }),
    bindingOf({ address: "authored-class-or-this#static-members-only" }),
    bindingOf({ address: "test-switched-off#focused-tests" }),
    bindingOf({ address: "test-switched-off#skipped-tests" }),
    bindingOf({ address: "positional-parameters#parameter-count" }),
    bindingOf({ address: "rebinding#parameter-reassignment" }),
  ];
  if (checks === undefined || !bindings.every((binding) => binding !== undefined)) return undefined;
  const projected = projectedNamedChecksOf({ checks, bindings });
  if (projected.outcome === "failed") return undefined;
  return checksProjectionText({
    kind: "mjs",
    pluginImport: import.meta.resolve("../../../../../eslint-plugin.ts"),
    checks: projected.value,
    answered: VERSION_TWO_ANSWERED,
  });
};

const directory = createDefaultDirectoryPort({});

const directoryTree = createDefaultDirectoryTreePort({});

const SCRATCH = absolutePathSchema.parse(
  path.join({ segments: [INSTALL_ROOT, "artefacts", `projection-pair-${crypto.randomUUID()}`] }),
);

const VERSION_TWO_CONFIG = path.join({ segments: [SCRATCH, "version-two.eslint.mjs"] });

const ADOPTER_CONFIG = path.join({ segments: [SCRATCH, "adopter.eslint.mjs"] });

const writeConfigurations = () => {
  const text = versionTwoText();
  const made = directory.create({ path: SCRATCH });
  if (made.outcome === "failed" || text === undefined) return undefined;
  return [
    fileText.write({ path: VERSION_TWO_CONFIG, text }),
    fileText.write({
      path: ADOPTER_CONFIG,
      text: `import parser from "${import.meta.resolve("@typescript-eslint/parser")}";\nimport projection from "./version-two.eslint.mjs";\nexport default [{ files: ["**/*.ts"], languageOptions: { parser } }, ...projection];\n`,
    }),
  ];
};

const CONFIGURATIONS = writeConfigurations();

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
  return resolvedConfigSchema.parse(resolved)?.rules;
};

const lintedMessages = async (request: { readonly line: (typeof ESLINT_LINES)[number] }) => {
  const Eslint = await eslintClassOn({ line: request.line });
  const [linted] = await new Eslint({ cwd: SCRATCH, overrideConfigFile: ADOPTER_CONFIG }).lintText(
    LINTED_SOURCE,
    {
      filePath: path.join({ segments: [SCRATCH, "src", "kept.ts"] }),
    },
  );
  return linted?.messages;
};

afterAll(async () => {
  const removed = directoryTree.remove({ path: SCRATCH });
  if (removed.outcome === "failed") return Promise.reject(new Error(removed.error.detail));
});

describe.each(ESLINT_LINES)("the version 2 projection on %s", (line) => {
  it("switches off, on a file its records answer, only the rules of the symptoms they answer", async () => {
    expect(CONFIGURATIONS).toEqual([
      { outcome: "ok", value: undefined },
      { outcome: "ok", value: undefined },
    ]);
    expect(
      await resolvedRules({ line, config: VERSION_TWO_CONFIG, file: "src/legacy.ts" }),
    ).toMatchObject({
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
    });
  });

  it("switches off, on a file a record answers for one check of a symptom with two, only that check's rule", async () => {
    expect(CONFIGURATIONS).toEqual([
      { outcome: "ok", value: undefined },
      { outcome: "ok", value: undefined },
    ]);
    expect(
      await resolvedRules({ line, config: VERSION_TWO_CONFIG, file: "src/skipping.test.ts" }),
    ).toMatchObject({
      "hone/test-switched-off#skipped-tests": [0],
      "hone/test-switched-off#focused-tests": [2],
    });
  });

  it("reports through the adopter's own config, each message under its symptom's title", async () => {
    expect(CONFIGURATIONS).toEqual([
      { outcome: "ok", value: undefined },
      { outcome: "ok", value: undefined },
    ]);
    expect(await lintedMessages({ line })).toMatchObject([
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
    ]);
  });
});
