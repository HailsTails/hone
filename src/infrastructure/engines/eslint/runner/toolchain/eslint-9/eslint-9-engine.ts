import * as typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint-9";
import { builtinRules } from "eslint-9/use-at-your-own-risk";
import { z } from "zod";

import type { ModuleLoaderPort } from "../../../../../../application/ports/host/module-loader-port.ts";
import type { SourceCase } from "../../../../../../domain/rule-set/rule-set-types.ts";
import type { RunnerClause } from "../../../../../../domain/runner/runner-module-types.ts";
import { eslintPieceSettingsSchema } from "../../pieces/eslint-piece-settings-schema.ts";
import {
  type LoadedEslintPlugin,
  eslintPluginModuleSchema,
} from "../../pieces/eslint-plugin-schema.ts";
import { defaultNativeRuleSources, type NativeRuleSources } from "../../pieces/native-rules.ts";
import { defaultEslintToolchainModules, type EslintToolchainModules } from "../eslint-toolchain.ts";

export const ESLINT_9_VERSION = ESLint.version;

export const eslint9ToolchainModules: EslintToolchainModules = {
  ...defaultEslintToolchainModules,
  eslint: () => Promise.resolve({ ESLint }),
};

type ConformanceRow = {
  readonly name: string;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

export type CaseMismatch = {
  readonly name: string;
  readonly expectedLines: readonly number[];
  readonly flaggedLines: readonly number[];
};

const ESLINT_9_SOURCES: NativeRuleSources = {
  ...defaultNativeRuleSources,
  eslintCore: builtinRules,
};

const nativeRulePieceSchema = z.object({
  createPlugin: z.function({
    input: [z.custom<NativeRuleSources>((value) => value === ESLINT_9_SOURCES)],
    output: z.unknown(),
  }),
});

const distinctSorted = (lines: readonly number[]): readonly number[] =>
  [...new Set(lines)].sort((left, right) => left - right);

const pieceModuleUnderEslint9 = (request: { readonly pieceModule: unknown }): unknown => {
  const injected = nativeRulePieceSchema.safeParse(request.pieceModule);
  return injected.success
    ? { default: injected.data.createPlugin(ESLINT_9_SOURCES) }
    : request.pieceModule;
};

export const eslint9PieceModules = (request: {
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => ({
  load: (load) =>
    request.base
      .load(load)
      .then((loaded) =>
        loaded.outcome === "failed"
          ? loaded
          : { outcome: "ok", value: pieceModuleUnderEslint9({ pieceModule: loaded.value }) },
      ),
});

const pluginUnderEslint9 = async (request: {
  readonly modulePath: string;
}): Promise<LoadedEslintPlugin> => {
  const pieceModule: unknown = await import(request.modulePath);
  return eslintPluginModuleSchema.parse(pieceModuleUnderEslint9({ pieceModule })).default;
};

const linesFlagged = async (request: {
  readonly eslint: ESLint;
  readonly sourceCase: SourceCase;
}): Promise<readonly number[]> => {
  const [lintResult] = await request.eslint.lintText(request.sourceCase.source, {
    filePath: `${process.cwd()}/${request.sourceCase.fileName}`,
  });
  return distinctSorted(lintResult?.messages.map((message) => message.line) ?? []);
};

const sameLines = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((line, index) => line === right[index]);

export const eslint9CaseMismatches = async (request: {
  readonly row: ConformanceRow;
}): Promise<readonly CaseMismatch[]> => {
  const {
    pluginNamespace,
    pluginModule,
    rule,
    options = [],
  } = eslintPieceSettingsSchema.parse(request.row.clause.settings);
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx,mts,cts}"],
        languageOptions: { parser: typescriptParser },
        plugins: {
          [pluginNamespace]: await pluginUnderEslint9({
            modulePath: `${request.row.clause.pieceRoot}/${pluginModule}`,
          }),
        },
        rules: { [`${pluginNamespace}/${rule}`]: ["error", ...options] },
      },
    ],
  });
  const outcomes = await Promise.all(
    request.row.cases.map(async (sourceCase) => ({
      name: sourceCase.name,
      expectedLines: distinctSorted(sourceCase.expectedLines),
      flaggedLines: await linesFlagged({ eslint, sourceCase }),
    })),
  );
  return outcomes.filter((outcome) => !sameLines(outcome.expectedLines, outcome.flaggedLines));
};
