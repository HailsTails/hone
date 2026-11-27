import { assert, describe, expect, it, onTestFinished } from "vitest";

import type { CheckPiece } from "../../../../../application/ports/settings-sources.ts";
import {
  type CheckAddressText,
  checkNamesOf,
} from "../../../../../domain/language-layer/check-address-text.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { bindHoneCheckOptions } from "../../../../../domain/rule-set/check-options.ts";
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

const catalogue = () =>
  readBoundCatalogue({
    ruleSet: "hone",
    inheritedRecordKinds: [],
    directory: createDefaultDirectoryPort({}),
    fileText,
    path,
    ruleSetRoot: INSTALL_ROOT,
    installRoot: INSTALL_ROOT,
  });

const readPiece = createCheckPieceSource({
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  fileText,
  path,
});

const bindPiece = (request: {
  readonly address: CheckAddressText;
  readonly piece: CheckPiece;
}): CheckBinding => ({
  address: request.address,
  ruleSet: "hone",
  engine: ESLINT,
  anchor: request.piece.anchor,
  pieceRoot: request.piece.pieceRoot,
  settings: request.piece.settings,
  checkSettings: {},
  edition: request.piece.editions.default,
  ...bindHoneCheckOptions({
    address: request.address,
    ruleSet: "hone",
    edition: request.piece.editions.default,
  }),
});

const directory = createDefaultDirectoryPort({});

const directoryTree = createDefaultDirectoryTreePort({});

const createScratchPath = () =>
  absolutePathSchema.parse(
    path.join({ segments: [INSTALL_ROOT, "artefacts", `projection-pair-${crypto.randomUUID()}`] }),
  );

const writeConfigurations = (request: {
  readonly scratch: AbsolutePath;
  readonly text: string;
}) => [
  directory.create({ path: request.scratch }),
  fileText.write({
    path: path.join({ segments: [request.scratch, "version-two.eslint.mjs"] }),
    text: request.text,
  }),
  fileText.write({
    path: path.join({ segments: [request.scratch, "adopter.eslint.mjs"] }),
    text: `import parser from "${import.meta.resolve("@typescript-eslint/parser")}";\nimport projection from "./version-two.eslint.mjs";\nexport default [{ files: ["**/*.ts"], languageOptions: { parser } }, ...projection];\n`,
  }),
];

const LINTED_SOURCE =
  'it.skip("a", () => {});\nexport const a = (b: string | undefined): string => b!;\nexport const c = (d: string, e: string, f: string): string => d + e + f;\n';

const resolveRules = async (request: {
  readonly line: (typeof ESLINT_LINES)[number];
  readonly scratch: AbsolutePath;
  readonly file: string;
}) => {
  const Eslint = await eslintClassOn({ line: request.line });
  const resolved = await new Eslint({
    cwd: request.scratch,
    overrideConfigFile: path.join({ segments: [request.scratch, "version-two.eslint.mjs"] }),
  }).calculateConfigForFile(path.join({ segments: [request.scratch, request.file] }));
  return resolvedConfigSchema.parse(resolved);
};

const lintSource = async (request: {
  readonly line: (typeof ESLINT_LINES)[number];
  readonly scratch: AbsolutePath;
  readonly file: string;
}) => {
  const Eslint = await eslintClassOn({ line: request.line });
  return new Eslint({
    cwd: request.scratch,
    overrideConfigFile: path.join({ segments: [request.scratch, "adopter.eslint.mjs"] }),
  }).lintText(LINTED_SOURCE, {
    filePath: path.join({ segments: [request.scratch, request.file] }),
  });
};

describe.each(ESLINT_LINES)("the version 2 projection on %s", (line) => {
  it.each([
    {
      name: "switches off only the rules of symptoms answered on a file",
      file: "src/legacy.ts",
      act: resolveRules,
      expected: {
        rules: {
          "hone/claimed-type#non-null-assertions": [
            0,
            {
              selector: "TSNonNullExpression",
              message: expect.any(String),
            },
            {
              selector: "[definite=true]",
              message: expect.any(String),
            },
          ],
          "hone/rebinding#parameter-reassignment": [0, { props: false }],
          "hone/positional-parameters#parameter-count": [2, { max: 2, countVoidThis: true }],
          "hone/test-switched-off#skipped-tests": [2],
        },
      },
    },
    {
      name: "switches off only the answered check when its symptom has two checks",
      file: "src/skipping.test.ts",
      act: resolveRules,
      expected: {
        rules: {
          "hone/test-switched-off#skipped-tests": [0],
          "hone/test-switched-off#focused-tests": [2],
        },
      },
    },
    {
      name: "reports through the adopter config with the symptom titles",
      file: "src/kept.ts",
      act: lintSource,
      expected: [
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
              message: expect.stringMatching(/^Claimed type: /u),
            },
            {
              ruleId: "hone/positional-parameters#parameter-count",
              line: 3,
              message:
                "Positional parameters: Arrow function has too many parameters (3). Maximum allowed is 2.",
            },
          ],
        },
      ],
    },
  ])("$name", async ({ file, act, expected }) => {
    const scratch = createScratchPath();
    onTestFinished(() => {
      expect(directoryTree.remove({ path: scratch })).toEqual({ outcome: "ok", value: undefined });
    });
    const reading = catalogue();
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");
    const bind = (address: CheckAddressText): CheckBinding => {
      const names = checkNamesOf({ text: address });
      assert.isDefined(names);
      const piece = readPiece({ ruleSetRoot: INSTALL_ROOT, names, mechanism: ESLINT });
      assert(piece.outcome === "ok");
      return bindPiece({ address, piece: piece.value });
    };
    const projected = projectedNamedChecksOf({
      checks: reading.value.catalogue.checks,
      bindings: [
        bind("claimed-type#non-null-assertions"),
        bind("name-off-its-casing#naming-convention"),
        bind("authored-class-or-this#class-keyword"),
        bind("authored-class-or-this#static-members-only"),
        bind("test-switched-off#focused-tests"),
        bind("test-switched-off#skipped-tests"),
        bind("positional-parameters#parameter-count"),
        bind("rebinding#parameter-reassignment"),
      ],
    });
    assert(projected.outcome === "ok");
    expect(
      writeConfigurations({
        scratch,
        text: checksProjectionText({
          kind: "mjs",
          pluginImport: import.meta.resolve("../../../../../eslint-plugin.ts"),
          checks: projected.value,
          answered: VERSION_TWO_ANSWERED,
        }),
      }),
    ).toEqual([
      { outcome: "ok", value: undefined },
      { outcome: "ok", value: undefined },
      { outcome: "ok", value: undefined },
    ]);

    expect(await act({ line, scratch, file })).toMatchObject(expected);
  });
});
