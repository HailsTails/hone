import { assert, describe, expect, it } from "vitest";
import { checkConformance } from "../../../protocol/conformance.ts";
import { checksRunnerModuleSchema } from "../../../protocol/checks/checks-runner-module-schema.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { loadedEngineOf } from "../../../protocol/engine-run/engine-run.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { conformanceRows, foldersUnder } from "../../../../../../tests/conformance-rows.ts";
import { ESLINT_LINES, eslintChecksRunnerOn } from "../../../../../../tests/eslint-toolchains.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ruleSetTexts = import.meta.glob(["./rules/*/discipline.json", "./src/infrastructure/engines/eslint/*/piece.json"], {
  base: "../../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const CONFORMANCE_ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: foldersUnder({ table: ruleSetTexts, prefix: "./src/infrastructure/engines/eslint/" }),
  mechanism: mechanismIdSchema.parse("eslint"),
  mechanismRoot: `${import.meta.dirname}/../..`,
});

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const shippedEngine = await loadedEngineOf({
  mechanism: mechanismIdSchema.parse("eslint"),
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  path: createDefaultPathPort({}),
  modules: createDefaultModuleLoaderPort({}),
});

assert(shippedEngine.outcome === "ok", "core loads the ESLint module");

const shippedChecksRunner = shippedEngine.value.checksRunner;

assert.isDefined(shippedChecksRunner, "the ESLint module exports its checks runner");

describe("the ESLint checks runner, loaded as core loads it, conforms to every registered ESLint clause's shared cases on real ESLint (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: shippedChecksRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});

describe.each(ESLINT_LINES)("the ESLint checks runner on %s, built as the shipped one is, conforms to every registered ESLint clause's shared cases (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", (line) => {
  const lineRunner = checksRunnerModuleSchema.parse(eslintChecksRunnerOn({ line }));

  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: lineRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
