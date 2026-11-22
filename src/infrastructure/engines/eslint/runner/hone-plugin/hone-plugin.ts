import { z } from "zod";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { pieceFilePath } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import type { DisciplineId } from "../../../../../domain/rule-set/identifier-types.ts";
import { parsedJson } from "../../../../content-files/parsed-json.ts";
import type { Result } from "../../../../../domain/result.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";
import { ESLINT_MECHANISM, type RuledCheck, runsOnEslint } from "./check-rule-id.ts";
import { type ChecksPlugin, type ChecksPluginFailure, checksPluginOf, type PieceSource } from "./checks-plugin.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";

export type HonePluginSources = {
  readonly checks: readonly RuledCheck[];
  readonly installRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly modules: ModuleLoaderPort;
  readonly boundary: EslintMajorBoundary;
};

export type HonePluginFailure =
  | ChecksPluginFailure
  | { readonly kind: "piece-unreadable"; readonly pieceFile: string; readonly detail: string }
  | { readonly kind: "plugin-unloadable"; readonly path: string; readonly detail: string };

type Built<Value> = Result<Value, HonePluginFailure>;

const pluginModulesSchema = z.looseObject({ clauses: z.array(z.looseObject({ settings: z.looseObject({ pluginModule: z.string() }) })) });

const moduleExportsSchema = z.looseObject({ default: z.unknown() });

const eslintDisciplinesOf = (request: { readonly checks: readonly RuledCheck[] }): readonly DisciplineId[] => [
  ...new Set(
    request.checks
      .filter((check) => runsOnEslint({ check }) === "eslint" && check.clause.ruleSet === TOOL_IDENTITY.ownRuleSet)
      .flatMap((check) => "discipline" in check.clause ? [check.clause.discipline] : []),
  ),
];

const pieceDocumentAt = (request: HonePluginSources & { readonly pieceFile: string }): Built<unknown> => {
  const text = request.fileText.read({ path: request.pieceFile });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: { kind: "piece-unreadable", pieceFile: request.pieceFile, detail: text.error.detail } };
  }
  const document = parsedJson({ text: text.value });
  return document.outcome === "failed" ? { outcome: "failed", error: { kind: "piece-unreadable", pieceFile: request.pieceFile, detail: document.error } } : document;
};

const pieceSourceOf = async (
  request: HonePluginSources & { readonly pieceFile: string; readonly pieceRoot: string; readonly piece: unknown; readonly pluginModule: string },
): Promise<Built<PieceSource>> => {
  const loaded = await request.modules.load({ path: request.path.join({ segments: [request.pieceRoot, request.pluginModule] }) });
  if (loaded.outcome === "failed") {
    return { outcome: "failed", error: { kind: "plugin-unloadable", path: loaded.error.path, detail: loaded.error.detail } };
  }
  const exported = moduleExportsSchema.safeParse(loaded.value);
  return exported.success
    ? { outcome: "ok", value: { pieceFile: request.pieceFile, pluginModule: request.pluginModule, piece: request.piece, plugin: exported.data.default } }
    : {
        outcome: "failed",
        error: { kind: "plugin-invalid", pieceFile: request.pieceFile, pluginModule: request.pluginModule, detail: z.prettifyError(exported.error) },
      };
};

const pieceSourcesOf = async (request: HonePluginSources & { readonly discipline: DisciplineId }): Promise<Built<readonly PieceSource[]>> => {
  const pieceFile = pieceFilePath({ path: request.path, ruleSetRoot: request.installRoot, installRoot: request.installRoot, mechanism: ESLINT_MECHANISM, discipline: request.discipline });
  const piece = pieceDocumentAt({ ...request, pieceFile });
  if (piece.outcome === "failed") {
    return piece;
  }
  const pluginModules = pluginModulesSchema.safeParse(piece.value);
  if (!pluginModules.success) {
    return { outcome: "failed", error: { kind: "piece-source-invalid", pieceFile, detail: z.prettifyError(pluginModules.error) } };
  }
  const pieceRoot = request.path.join({ segments: [request.installRoot, "src", "infrastructure", "engines", ESLINT_MECHANISM, request.discipline] });
  const sources = await Promise.all(
    [...new Set(pluginModules.data.clauses.map((entry) => entry.settings.pluginModule))].map(async (pluginModule) =>
      listedOutcome({ outcome: await pieceSourceOf({ ...request, pieceFile, pieceRoot, piece: piece.value, pluginModule }) }),
    ),
  );
  return gatheredOutcomes({ outcomes: sources });
};

export const honePluginAt = async (request: HonePluginSources): Promise<Built<ChecksPlugin>> => {
  const sources = gatheredOutcomes({
    outcomes: await Promise.all(eslintDisciplinesOf(request).map((discipline) => pieceSourcesOf({ ...request, discipline }))),
  });
  return sources.outcome === "failed" ? sources : checksPluginOf({ checks: request.checks, sources: sources.value, boundary: request.boundary });
};

export const honePluginFailureText = (request: { readonly failure: HonePluginFailure }): string => {
  const failure = request.failure;
  switch (failure.kind) {
    case "piece-unreadable":
      return `the piece ${failure.pieceFile} cannot be read: ${failure.detail}`;
    case "piece-source-invalid":
      return `the piece ${failure.pieceFile} is not an ESLint piece: ${failure.detail}`;
    case "plugin-unloadable":
      return `the plugin module ${failure.path} cannot be loaded: ${failure.detail}`;
    case "plugin-invalid":
      return `the plugin module ${failure.pluginModule} of the piece ${failure.pieceFile} is not an ESLint plugin: ${failure.detail}`;
    case "piece-rule-missing":
      return `the piece ${failure.pieceFile} runs the rule ${failure.rule}, which its plugin module does not hold`;
    case "check-rule-missing":
      return `the check ${failure.ruleId} runs on ESLint, but no piece of this install holds its rule`;
  }
};
