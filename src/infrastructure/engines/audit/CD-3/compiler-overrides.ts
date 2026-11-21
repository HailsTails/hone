import type { PieceFailure } from "../../../../domain/runner/piece-failure-types.ts";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type { ClauseAddress } from "../../../../domain/rule-set/clause-address-types.ts";
import { type Edition, editionReaches, editionSchema } from "../../../content-files/edition.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import { createDefaultJsoncParsePort, type JsoncParsePort } from "../runner/pieces/jsonc-parse.ts";
import { folderScope } from "../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../runner/pieces/walker-piece.ts";
import type { CompilerOptionsResolution, CompilerOptionsResolutionOf, OptionSettings, ResolvedConfig, StrictOption } from "./compiler-options-resolution.ts";
import { typeScriptCompilerOptionsOf } from "./typescript-compiler-options.ts";

const RESOLVING_EDITION: Edition = editionSchema.parse("2");

const IMPLIED_BY_STRICT: readonly StrictOption[] = ["useUnknownInCatchVariables"];

const FILE_ANCHOR = { line: 1, column: 0 } as const;

const STRICT_FLAGS: readonly { readonly clause: string; readonly option: StrictOption }[] = [
  { clause: "strict", option: "strict" },
  { clause: "no-unchecked-indexed-access", option: "noUncheckedIndexedAccess" },
  { clause: "exact-optional-property-types", option: "exactOptionalPropertyTypes" },
  { clause: "no-implicit-override", option: "noImplicitOverride" },
  { clause: "no-fallthrough-cases-in-switch", option: "noFallthroughCasesInSwitch" },
  { clause: "no-property-access-from-index-signature", option: "noPropertyAccessFromIndexSignature" },
  { clause: "use-unknown-in-catch-variables", option: "useUnknownInCatchVariables" },
];

type SelectedFlag = {
  readonly address: ClauseAddress;
  readonly option: StrictOption;
  readonly judges: "own-options" | "resolved-options";
};

type OwnOptions = readonly (readonly [string, unknown])[];

type ConfigFile = { readonly file: RepoPath; readonly options: OwnOptions };

const configEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (request.file.split("/").at(-1) !== "tsconfig.json") return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

const selectedFlagsOf = (request: { readonly clauses: readonly RunnerClause[] }): readonly SelectedFlag[] =>
  STRICT_FLAGS.flatMap((flag) =>
    request.clauses
      .filter((clause) => clause.address.discipline === "CD-3" && clause.address.clause === flag.clause)
      .map((clause) => ({
        address: clause.address,
        option: flag.option,
        judges: editionReaches({ edition: clause.edition, introducedIn: RESOLVING_EDITION }) === "reached" ? "resolved-options" : "own-options",
      })),
  );

const unparseable = (request: { readonly file: RepoPath; readonly detail: string }): Result<never, PieceFailure> => ({
  outcome: "failed",
  error: { kind: "file-unparseable", file: request.file, detail: request.detail },
});

const ownOptionsOf = (request: { readonly file: RepoPath; readonly config: unknown }): Result<OwnOptions, PieceFailure> => {
  const config = request.config;
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return unparseable({ file: request.file, detail: "configuration root must be an object" });
  }
  if (!("compilerOptions" in config)) return { outcome: "ok", value: [] };
  const compilerOptions = config.compilerOptions;
  if (typeof compilerOptions !== "object" || compilerOptions === null || Array.isArray(compilerOptions)) {
    return unparseable({ file: request.file, detail: "compilerOptions must be an object" });
  }
  return { outcome: "ok", value: Object.entries(compilerOptions) };
};

const ownEntryOf = (request: { readonly options: OwnOptions; readonly option: StrictOption }): readonly [string, unknown] | undefined =>
  request.options.find(([key]) => key === request.option);

const ownSettingsOf = (request: { readonly options: OwnOptions }): Pick<OptionSettings, "strict"> => {
  const strict = ownEntryOf({ options: request.options, option: "strict" })?.[1];
  if (strict === true) return { strict: "on" };
  return { strict: strict === false ? "off" : "unset" };
};

const turnsOff = (request: { readonly settings: Partial<OptionSettings>; readonly option: StrictOption }): "turns-off" | "leaves" => {
  const own = request.settings[request.option] ?? "unset";
  if (own === "off") return "turns-off";
  return own === "unset" && IMPLIED_BY_STRICT.includes(request.option) && request.settings.strict === "off" ? "turns-off" : "leaves";
};

const resolvedSnippet = (request: {
  readonly config: ConfigFile;
  readonly resolved: Extract<ResolvedConfig, { readonly kind: "resolved" }>;
  readonly option: StrictOption;
}): string | undefined => {
  const { option, resolved } = request;
  if (resolved.effective[option] === "on") return undefined;
  const thisFileTurnsOff = turnsOff({ settings: ownSettingsOf({ options: request.config.options }), option });
  const offBases = resolved.bases.filter((base) => turnsOff({ settings: base.settings, option }) === "turns-off").map((base) => base.file);
  if (thisFileTurnsOff === "turns-off") return `compilerOptions.${option} = false, turned off in ${[request.config.file, ...offBases].join(", ")}`;
  if (offBases.length > 0) return `compilerOptions.${option} = false, inherited from ${offBases.join(", ")}`;
  if (resolved.bases.length === 0) return `compilerOptions.${option} unset, and this file extends no base`;
  return `compilerOptions.${option} unset here and in ${resolved.bases.map((base) => base.file).join(", ")}`;
};

const judgedSnippet = (request: { readonly config: ConfigFile; readonly resolved: ResolvedConfig; readonly option: StrictOption }): string | undefined => {
  switch (request.resolved.kind) {
    case "unresolved":
      return `compilerOptions.${request.option} unknown: ${request.resolved.detail}`;
    case "compiles-nothing":
      return undefined;
    case "resolved":
      return resolvedSnippet({ config: request.config, resolved: request.resolved, option: request.option });
  }
};

const presenceHit = (request: { readonly flag: SelectedFlag; readonly value: unknown }): PieceHit => ({
  clause: request.flag.address,
  anchor: FILE_ANCHOR,
  snippet: `compilerOptions.${request.flag.option} = ${JSON.stringify(request.value)}`,
});

const resolutionNeed = (request: { readonly config: ConfigFile; readonly flags: readonly SelectedFlag[] }): "needed" | "not-needed" =>
  request.flags.some((flag) => flag.judges === "resolved-options" && ownEntryOf({ options: request.config.options, option: flag.option }) === undefined)
    ? "needed"
    : "not-needed";

const hitsOf = (request: {
  readonly config: ConfigFile;
  readonly flags: readonly SelectedFlag[];
  readonly resolution: CompilerOptionsResolution;
}): readonly PieceHit[] => {
  const resolved = resolutionNeed(request) === "needed" ? request.resolution.resolve({ file: request.config.file }) : undefined;
  return request.flags.flatMap((flag) => {
    const own = ownEntryOf({ options: request.config.options, option: flag.option });
    if (own !== undefined) return [presenceHit({ flag, value: own[1] })];
    if (flag.judges === "own-options" || resolved === undefined) return [];
    const snippet = judgedSnippet({ config: request.config, resolved, option: flag.option });
    return snippet === undefined ? [] : [{ clause: flag.address, anchor: FILE_ANCHOR, snippet }];
  });
};

export const createCompilerOverridesCheck = (options: {
  readonly jsonc: JsoncParsePort;
  readonly resolutionOf: CompilerOptionsResolutionOf;
}): WalkerPiece => ({
  prepare: ({ clauses, repository, syntaxApi }) => {
    const flags = selectedFlagsOf({ clauses });
    const resolution = options.resolutionOf({ syntaxApi, disk: repository.disk });
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file, readText }) => {
          if (configEligibility({ file }) === "excluded") return { outcome: "ok", value: { kind: "skipped" } };
          const text = readText();
          if (text.outcome === "failed") return text;
          const parsed = options.jsonc.parse({ source: text.value });
          if (parsed.outcome === "failed") return unparseable({ file, detail: parsed.error.detail });
          const own = ownOptionsOf({ file, config: parsed.value });
          if (own.outcome === "failed") return own;
          const hits = hitsOf({ config: { file, options: own.value }, flags, resolution });
          return { outcome: "ok", value: { kind: "complete", hits } };
        },
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
});

export const check = createCompilerOverridesCheck({
  jsonc: createDefaultJsoncParsePort({ trailingCommas: "refused" }),
  resolutionOf: typeScriptCompilerOptionsOf,
});
