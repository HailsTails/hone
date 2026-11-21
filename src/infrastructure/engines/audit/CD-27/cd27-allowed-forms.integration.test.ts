import { assert, describe, expect, it } from "vitest";
import { checkConformance } from "../../protocol/conformance.ts";
import { runnerModuleSchema } from "../../protocol/runner-module/runner-module-schema.ts";
import { mechanismIdSchema } from "../../../hone-config-file/identifiers.ts";
import * as walkerRunnerModule from "../runner/runner.ts";
import { TEST_BODY_SECTIONS } from "./test-body-logic.ts";
import * as eslintRunnerModule from "../../eslint/runner/runner.ts";
import { allowedFormSectionsOf } from "../../../../../tests/allowed-forms-page.ts";
import {
  allowCasesOf,
  allowedBlocksOf,
  cd27ChecksPageOf,
  remedySectionsOf,
  repositoryRootOf,
  rowsNamed,
  sectionNamesOf,
  typeErrorsOf,
} from "../../../../../tests/allowed-forms-proof.ts";
import { conformanceRows, foldersUnder } from "../../../../../tests/conformance-rows.ts";
import { defaultParsePort } from "../../../../../tests/typescript-parse-port.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const REPO_ROOT = repositoryRootOf({ testFolder: `${import.meta.dirname}/../../../../../tests` });

const ruleSetTexts = import.meta.glob(
  ["./rules/*/discipline.json", "./src/infrastructure/engines/audit/*/piece.json", "./src/infrastructure/engines/eslint/*/piece.json"],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const AUDIT_ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: foldersUnder({ table: ruleSetTexts, prefix: "./src/infrastructure/engines/audit/" }),
  mechanism: mechanismIdSchema.parse("audit"),
  mechanismRoot: `${REPO_ROOT}/src/infrastructure/engines/audit`,
});

const ESLINT_ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: foldersUnder({ table: ruleSetTexts, prefix: "./src/infrastructure/engines/eslint/" }),
  mechanism: mechanismIdSchema.parse("eslint"),
  mechanismRoot: `${REPO_ROOT}/src/infrastructure/engines/eslint`,
});

const CLAUSES_THAT_REACH_TEST_FILES = {
  audit: [
    "CD-1#any-cast", "CD-2#cast-expressions", "CD-6#identifier-names", "CD-14#class-syntax", "CD-15#loops", "CD-25#dependency-isolation",
    "CD-27#test-body-logic", "CD-27#test-body-logic edition 2", "CD-43#boolean-signatures",
  ],
  eslint: ["CD-1#explicit-any", "CD-2#non-null-assertions", "CD-10#throw-only-error", "CD-14#class-syntax", "CD-40#parameter-count", "CD-41#function-length"],
};

const SECTIONS = allowedFormSectionsOf({ page: cd27ChecksPageOf({ repoRoot: REPO_ROOT }) });

const BLOCKS = allowedBlocksOf({ sections: SECTIONS });

const ALLOW_CASES = allowCasesOf({ blocks: BLOCKS });

const TYPE_ERRORS = typeErrorsOf({ syntaxApi: defaultParsePort.syntaxApi, repoRoot: REPO_ROOT, blocks: BLOCKS });

const walkerRunner = runnerModuleSchema.parse(walkerRunnerModule.runner);

const eslintRunner = runnerModuleSchema.parse(eslintRunnerModule.runner);

describe("rules/CD-27/CHECKS.md, Allowed forms in a test", () => {
  it("has one section for each fix a CD-27#test-body-logic finding names, in the same order", () => {
    expect(sectionNamesOf({ sections: SECTIONS })).toEqual(TEST_BODY_SECTIONS);
  });

  it("holds the forms to every audit and ESLint clause, among them those that reach a test file", () => {
    expect(rowsNamed({ rows: AUDIT_ROWS, names: CLAUSES_THAT_REACH_TEST_FILES.audit })).toHaveLength(9);
    expect(rowsNamed({ rows: ESLINT_ROWS, names: CLAUSES_THAT_REACH_TEST_FILES.eslint })).toHaveLength(6);
  });

  it.each(SECTIONS)("shows under $heading a flagged form whose finding names that section", async ({ flagged, section }) => {
    const [secondEditionRow] = rowsNamed({ rows: AUDIT_ROWS, names: ["CD-27#test-body-logic edition 2"] });
    assert.isDefined(secondEditionRow);

    expect(await remedySectionsOf({ repoRoot: REPO_ROOT, parse: defaultParsePort, clause: secondEditionRow.clause, source: flagged })).toContain(section);
  });

  it.each(TYPE_ERRORS.blocks)("compiles $name under the compiler options CD-3 requires", ({ errors }) => {
    expect(errors).toEqual([]);
  });

  it("compiles with no diagnostic outside the forms, under the compiler options CD-3 requires", () => {
    expect(TYPE_ERRORS.unattributed).toEqual([]);
  });

  it.each(AUDIT_ROWS)("has no form to write instead that the audit runner flags under $name", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: ALLOW_CASES, runner: walkerRunner })).toEqual({ outcome: "ok", value: [] });
  });

  it.each(ESLINT_ROWS)("has no form to write instead that the ESLint runner flags under $name", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: ALLOW_CASES, runner: eslintRunner })).toEqual({ outcome: "ok", value: [] });
  });
});
