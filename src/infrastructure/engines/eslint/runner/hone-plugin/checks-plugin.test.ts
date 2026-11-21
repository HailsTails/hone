import { describe, expect, it } from "vitest";
import { CHECKS_PLUGIN_CATALOGUE, SKIPPED_TESTS_CHECK } from "../../../../../../tests/checks-plugin-catalogue.ts";
import cd2Plugin from "../../CD-2/cd2/cd2.eslint-plugin.ts";
import CD_2_PIECE from "../../CD-2/piece.json" with { type: "json" };
import cd27Plugin from "../../CD-27/cd27/cd27.eslint-plugin.ts";
import CD_27_PIECE from "../../CD-27/piece.json" with { type: "json" };
import cd40Plugin from "../../CD-40/cd40/cd40.eslint-plugin.ts";
import CD_40_PIECE from "../../CD-40/piece.json" with { type: "json" };
import { boundaryReporting, SILENT_BOUNDARY } from "../../../../../../tests/eslint-major-boundary-stub.ts";
import { checksPluginOf, inSymptomWords, reportInSymptomWords } from "./checks-plugin.ts";

const CD_2_SOURCE = { pieceFile: "/install/mechanisms/eslint/CD-2/piece.json", pluginModule: "cd2/cd2.eslint-plugin.ts", piece: CD_2_PIECE, plugin: cd2Plugin };

const CD_27_SOURCE = { pieceFile: "/install/mechanisms/eslint/CD-27/piece.json", pluginModule: "cd27/cd27.eslint-plugin.ts", piece: CD_27_PIECE, plugin: cd27Plugin };

const CD_40_SOURCE = { pieceFile: "/install/mechanisms/eslint/CD-40/piece.json", pluginModule: "cd40/cd40.eslint-plugin.ts", piece: CD_40_PIECE, plugin: cd40Plugin };

const PLUGIN = checksPluginOf({ checks: CHECKS_PLUGIN_CATALOGUE.checks, sources: [CD_2_SOURCE, CD_27_SOURCE, CD_40_SOURCE], boundary: SILENT_BOUNDARY });

describe("checksPluginOf", () => {
  it("names itself as the package's one plugin export", () => {
    expect(PLUGIN).toMatchObject({ outcome: "ok", value: { meta: { name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" } } });
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
            meta: { type: "problem", schema: [], messages: { modifiedTest: "Test switched off: remove the skip so the test runs, or delete the test." } },
          },
        },
      },
    });
  });

  it("fails naming the rule id of an ESLint check whose piece is not among its sources", () => {
    expect(checksPluginOf({ checks: CHECKS_PLUGIN_CATALOGUE.checks, sources: [CD_27_SOURCE], boundary: SILENT_BOUNDARY })).toEqual({
      outcome: "failed",
      error: { kind: "check-rule-missing", ruleId: "hone/claimed-type#non-null-assertions" },
    });
  });

  it("fails naming the piece file of a source that is not an ESLint piece", () => {
    expect(
      checksPluginOf({ checks: [SKIPPED_TESTS_CHECK], sources: [{ ...CD_27_SOURCE, piece: { clauses: "none" } }], boundary: SILENT_BOUNDARY }),
    ).toMatchObject({ outcome: "failed", error: { kind: "piece-source-invalid", pieceFile: "/install/mechanisms/eslint/CD-27/piece.json" } });
  });

  it("fails naming the piece file and module of a plugin that is not an ESLint plugin", () => {
    expect(checksPluginOf({ checks: [SKIPPED_TESTS_CHECK], sources: [{ ...CD_27_SOURCE, plugin: { rules: "none" } }], boundary: SILENT_BOUNDARY })).toMatchObject({
      outcome: "failed",
      error: { kind: "plugin-invalid", pieceFile: "/install/mechanisms/eslint/CD-27/piece.json", pluginModule: "cd27/cd27.eslint-plugin.ts" },
    });
  });

  it("fails naming the piece file and rule a piece's plugin module does not hold", () => {
    expect(checksPluginOf({ checks: [SKIPPED_TESTS_CHECK], sources: [{ ...CD_27_SOURCE, plugin: cd40Plugin }], boundary: SILENT_BOUNDARY })).toEqual({
      outcome: "failed",
      error: { kind: "piece-rule-missing", pieceFile: "/install/mechanisms/eslint/CD-27/piece.json", rule: "focused-tests" },
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
          data: { message: "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead." },
        },
        boundary: boundaryReporting({
          data: { message: "CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead." },
        }),
      }),
    ).toEqual({
      loc: { line: 1, column: 0 },
      messageId: "restrictedSyntax",
      data: { message: "a non-null assertion claims a value the compiler cannot see; narrow it with a check instead." },
    });
  });

  it("passes a report that carries no data on unchanged", () => {
    expect(reportInSymptomWords({ descriptor: { loc: { line: 1, column: 0 }, messageId: "modifiedTest" }, boundary: SILENT_BOUNDARY })).toEqual({
      loc: { line: 1, column: 0 },
      messageId: "modifiedTest",
    });
  });
});

describe("inSymptomWords", () => {
  it.each<{ readonly name: string; readonly message: string; readonly worded: string }>([
    { name: "a numbered message", message: "CD-27: remove the focus so every test runs.", worded: "Test switched off: remove the focus so every test runs." },
    { name: "an unnumbered message", message: "Unexpected focus.", worded: "Test switched off: Unexpected focus." },
    { name: "a number later in the message", message: "see CD-27: later", worded: "Test switched off: see CD-27: later" },
  ])("words $name under the symptom's title", ({ message, worded }) => {
    expect(inSymptomWords({ message, title: "Test switched off" })).toBe(worded);
  });
});
