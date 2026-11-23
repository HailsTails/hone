import { describe, expect, it } from "vitest";

import type {
  Check,
  Engine,
  Symptom,
} from "../../../../../domain/language-layer/symptom-catalogue.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import cd2Plugin from "../../claimed-type/non-null-assertions/eslint-plugin.ts";
import cd40Plugin from "../../positional-parameters/parameter-count/eslint-plugin.ts";
import cd27Plugin from "../../test-switched-off/focused-tests/eslint-plugin.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import { checksPluginOf, inSymptomWords, reportInSymptomWords } from "./checks-plugin.ts";

const DECLARATION_TEXT =
  "declare const projection: readonly unknown[];\nexport default projection;\n";

const SILENT_BOUNDARY: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: () => undefined,
  declarationText: DECLARATION_TEXT,
};

const NON_NULL_REPORTING_BOUNDARY: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: () => ({
    message:
      "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
  }),
  declarationText: DECLARATION_TEXT,
};

const ESLINT: Engine = { name: "eslint" };

const TEST_SWITCHED_OFF: Symptom = {
  ruleSet: "hone",
  name: "test-switched-off",
  title: "Test switched off",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const POSITIONAL_PARAMETERS: Symptom = {
  ruleSet: "hone",
  name: "positional-parameters",
  title: "Positional parameters",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const SKIPPED_TESTS_CHECK: Check = {
  name: "skipped-tests",
  symptom: TEST_SWITCHED_OFF,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-27"),
    clause: clauseIdOf("skipped-tests"),
  },
  engines: [ESLINT],
  forms: [],
};

const NON_NULL_ASSERTIONS_CHECK: Check = {
  name: "non-null-assertions",
  symptom: CLAIMED_TYPE,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("non-null-assertions"),
  },
  engines: [ESLINT],
  forms: [],
};

const PARAMETER_COUNT_CHECK: Check = {
  name: "parameter-count",
  symptom: POSITIONAL_PARAMETERS,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-40"),
    clause: clauseIdOf("parameter-count"),
  },
  engines: [ESLINT],
  forms: [],
};

const CD_2_SOURCE = {
  pieceFile: "/install/mechanisms/eslint/CD-2/piece.json",
  pluginModule: "eslint-plugin.ts",
  check: NON_NULL_ASSERTIONS_CHECK,
  ruleName: "no-restricted-syntax",
  plugin: cd2Plugin,
};

const CD_27_SOURCE = {
  pieceFile: "/install/mechanisms/eslint/CD-27/piece.json",
  pluginModule: "eslint-plugin.ts",
  check: SKIPPED_TESTS_CHECK,
  ruleName: "skipped-tests",
  plugin: cd27Plugin,
};

const CD_40_SOURCE = {
  pieceFile: "/install/mechanisms/eslint/CD-40/piece.json",
  pluginModule: "eslint-plugin.ts",
  check: PARAMETER_COUNT_CHECK,
  ruleName: "max-params",
  plugin: cd40Plugin,
};

const PLUGIN = checksPluginOf({
  sources: [CD_2_SOURCE, CD_27_SOURCE, CD_40_SOURCE],
  boundary: SILENT_BOUNDARY,
});

describe("checksPluginOf", () => {
  it("names itself as the package's one plugin export", () => {
    expect(PLUGIN).toMatchObject({
      outcome: "ok",
      value: { meta: { name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" } },
    });
  });

  it("holds one rule for each check on ESLint, named <symptom>#<check>, and none for a check that runs elsewhere", () => {
    expect(PLUGIN).toEqual({
      outcome: "ok",
      value: {
        meta: { name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" },
        rules: {
          "test-switched-off#skipped-tests": expect.anything(),
          "claimed-type#non-null-assertions": expect.anything(),
          "positional-parameters#parameter-count": expect.anything(),
        },
      },
    });
  });

  it("gives each rule the meta of the piece's rule it runs, its messages under the symptom's title", () => {
    expect(PLUGIN).toMatchObject({
      outcome: "ok",
      value: {
        rules: {
          "test-switched-off#skipped-tests": {
            meta: {
              type: "problem",
              schema: [{ enum: ["conditional-and-todo"] }],
              messages: {
                modifiedTest:
                  "Test switched off: remove the skip so the test runs, or delete the test.",
              },
            },
          },
        },
      },
    });
  });

  it("fails naming the piece file and module of a plugin that is not an ESLint plugin", () => {
    expect(
      checksPluginOf({
        sources: [{ ...CD_27_SOURCE, plugin: { rules: "none" } }],
        boundary: SILENT_BOUNDARY,
      }),
    ).toMatchObject({
      outcome: "failed",
      error: {
        kind: "plugin-invalid",
        pieceFile: "/install/mechanisms/eslint/CD-27/piece.json",
        pluginModule: "eslint-plugin.ts",
      },
    });
  });

  it("fails naming the piece file and rule a piece's plugin module does not hold", () => {
    expect(
      checksPluginOf({
        sources: [{ ...CD_27_SOURCE, plugin: cd40Plugin }],
        boundary: SILENT_BOUNDARY,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-rule-missing",
        pieceFile: "/install/mechanisms/eslint/CD-27/piece.json",
        rule: "skipped-tests",
      },
    });
  });
});

describe("reportInSymptomWords", () => {
  it("drops the numbered lead from each text the report passes its message", () => {
    expect(
      reportInSymptomWords({
        descriptor: {
          loc: { line: 1, column: 0 },
          messageId: "restrictedSyntax",
          data: {
            message:
              "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
          },
        },
        boundary: NON_NULL_REPORTING_BOUNDARY,
      }),
    ).toEqual({
      loc: { line: 1, column: 0 },
      messageId: "restrictedSyntax",
      data: {
        message:
          "a non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
      },
    });
  });

  it("passes a report that carries no data on unchanged", () => {
    expect(
      reportInSymptomWords({
        descriptor: { loc: { line: 1, column: 0 }, messageId: "modifiedTest" },
        boundary: SILENT_BOUNDARY,
      }),
    ).toEqual({
      loc: { line: 1, column: 0 },
      messageId: "modifiedTest",
    });
  });
});

describe("inSymptomWords", () => {
  it.each<{ readonly name: string; readonly message: string; readonly worded: string }>([
    {
      name: "a numbered message",
      message: "CD-27: remove the focus so every test runs.",
      worded: "Test switched off: remove the focus so every test runs.",
    },
    {
      name: "an unnumbered message",
      message: "Unexpected focus.",
      worded: "Test switched off: Unexpected focus.",
    },
    {
      name: "a number later in the message",
      message: "see CD-27: later",
      worded: "Test switched off: see CD-27: later",
    },
  ])("words $name under the symptom's title", ({ message, worded }) => {
    expect(inSymptomWords({ message, title: "Test switched off" })).toBe(worded);
  });
});
