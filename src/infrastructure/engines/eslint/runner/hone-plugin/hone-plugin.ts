import { z } from "zod";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import { checkNamesOf } from "../../../../../domain/language-layer/check-address-text.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import { namedPiecePathOf, readNamedPiece } from "../../../named-piece.ts";
import { eslintPieceSettingsSchema } from "../pieces/eslint-piece-settings-schema.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import {
  checkRuleIdOf,
  checkRuleNameOf,
  ESLINT_MECHANISM,
  type PluginCheck,
  runsOnEslint,
} from "./check-rule-id.ts";
import {
  type ChecksPlugin,
  type ChecksPluginFailure,
  checksPluginOf,
  type PieceSource,
} from "./checks-plugin.ts";

export type HonePluginSources = {
  readonly checks: readonly PluginCheck[];
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

const moduleExportsSchema = z.looseObject({ default: z.unknown() });

const pieceSourceOf = async (
  request: HonePluginSources & { readonly check: PluginCheck },
): Promise<Built<PieceSource>> => {
  const { check, installRoot } = request;
  const names = checkNamesOf({ text: checkRuleNameOf({ check }) });
  if (names === undefined) {
    return {
      outcome: "failed",
      error: { kind: "check-rule-missing", ruleId: checkRuleIdOf({ check }) },
    };
  }
  const location = { ...request, ...names, mechanism: ESLINT_MECHANISM, ruleSetRoot: installRoot };
  const pieceFile = namedPiecePathOf(location);
  const piece = readNamedPiece(location);
  if (piece.outcome === "failed") {
    const { error } = piece;
    return error.kind === "file-malformed" || error.kind === "file-unreadable"
      ? {
          outcome: "failed",
          error: {
            kind: error.kind === "file-malformed" ? "piece-source-invalid" : "piece-unreadable",
            pieceFile,
            detail: error.detail,
          },
        }
      : {
          outcome: "failed",
          error: { kind: "check-rule-missing", ruleId: checkRuleIdOf({ check }) },
        };
  }
  const settings = eslintPieceSettingsSchema.safeParse(piece.value.settings);
  if (!settings.success) {
    return {
      outcome: "failed",
      error: { kind: "piece-source-invalid", pieceFile, detail: z.prettifyError(settings.error) },
    };
  }
  const { pluginModule, rule: ruleName } = settings.data;
  const path = request.path.join({ segments: [piece.value.pieceRoot, pluginModule] });
  const loaded = await request.modules.load({ path });
  if (loaded.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "plugin-unloadable", path: loaded.error.path, detail: loaded.error.detail },
    };
  }
  const exported = moduleExportsSchema.safeParse(loaded.value);
  return exported.success
    ? {
        outcome: "ok",
        value: { check, pieceFile, pluginModule, ruleName, plugin: exported.data.default },
      }
    : {
        outcome: "failed",
        error: {
          kind: "plugin-invalid",
          pieceFile,
          pluginModule,
          detail: z.prettifyError(exported.error),
        },
      };
};

export const honePluginAt = async (request: HonePluginSources): Promise<Built<ChecksPlugin>> => {
  const eslint = request.checks.filter((check) => runsOnEslint({ check }) === "eslint");
  const sources = gatheredOutcomes({
    outcomes: await Promise.all(
      eslint.map(async (check) =>
        listedOutcome({ outcome: await pieceSourceOf({ ...request, check }) }),
      ),
    ),
  });
  return sources.outcome === "failed"
    ? sources
    : checksPluginOf({ sources: sources.value, boundary: request.boundary });
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
