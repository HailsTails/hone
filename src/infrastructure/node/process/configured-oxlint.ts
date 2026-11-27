import { z } from "zod";

import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import {
  mapDiagnosticsToSites,
  readOxlintDiagnostics,
  runOxlintCommand,
  type OxlintSite,
} from "./oxlint-diagnostics.ts";
import { readOxlintToolchain } from "./oxlint-toolchain.ts";

const configSchema = z.object({
  jsPlugins: z.array(z.object({ name: z.string(), specifier: z.string() })).nullish(),
  overrides: z
    .array(
      z.object({
        files: z.array(z.string()),
        rules: z
          .record(z.string(), z.json())
          .nullish()
          .transform((rules) => rules ?? {}),
      }),
    )
    .nullish(),
});

type EffectiveConfig = z.output<typeof configSchema>;

const printConfiguration = (request: {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly config: string;
}): EffectiveConfig =>
  configSchema.parse(
    JSON.parse(
      runOxlintCommand({
        ...request,
        arguments: ["--config", request.config, "--print-config"],
      }),
    ),
  );

const selectRules = (request: {
  readonly rules: Readonly<Record<string, ReadonlyJsonValue>>;
  readonly ids: ReadonlySet<string>;
}) =>
  Object.fromEntries(
    Object.entries(request.rules)
      .filter(([id]) => request.ids.has(id))
      .toSorted(([left], [right]) => left.localeCompare(right, "en")),
  );

export const readEffectiveChecks = (request: {
  readonly config: EffectiveConfig;
  readonly ids: ReadonlySet<string>;
  readonly namespaces: ReadonlySet<string>;
}) => ({
  plugins: (request.config.jsPlugins ?? [])
    .filter(({ name }) => request.namespaces.has(name))
    .toSorted((left, right) => left.name.localeCompare(right.name, "en")),
  overrides: (request.config.overrides ?? []).flatMap(({ files, rules }) => {
    const selected = selectRules({ rules, ids: request.ids });
    return Object.keys(selected).length === 0 ? [] : [{ files, rules: selected }];
  }),
});

const configurationState = (request: {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly config: string;
  readonly projection: string;
  readonly rules: readonly string[];
}): "included" | "not-included" => {
  const projected = printConfiguration({ ...request, config: request.projection });
  const active = printConfiguration(request);
  const ids = new Set(
    request.rules.flatMap((rule) =>
      rule.startsWith("eslint/") ? [rule, rule.slice("eslint/".length)] : [rule],
    ),
  );
  const namespaces = new Set((projected.jsPlugins ?? []).map(({ name }) => name));
  const required = readEffectiveChecks({ config: projected, ids, namespaces });
  const configured = readEffectiveChecks({ config: active, ids, namespaces });
  const preservesOverrides =
    JSON.stringify(configured.overrides.slice(-required.overrides.length)) ===
    JSON.stringify(required.overrides);
  return preservesOverrides &&
    JSON.stringify(configured.plugins) === JSON.stringify(required.plugins)
    ? "included"
    : "not-included";
};

type ConfiguredSource = { readonly fileName: string; readonly source: string };

type BatchRequest = {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly config: string;
  readonly rules: readonly string[];
  readonly sources: readonly ConfiguredSource[];
};

type BatchObservation = {
  readonly linted: readonly string[];
  readonly sites: readonly OxlintSite[];
};

const runBatch = (request: BatchRequest): BatchObservation => {
  const files = request.sources.map(({ fileName }) => fileName);
  const configurationArguments = [
    "--config",
    request.config,
    "--disable-nested-config",
    "--no-error-on-unmatched-pattern",
  ];
  const listing = runOxlintCommand({
    ...request,
    arguments: [...configurationArguments, "--debug=files", "--", ...files],
  });
  const linted = listing
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
  if (linted.some((file) => !files.includes(file))) throw new Error(listing.trim());
  if (linted.length === 0) return { linted, sites: [] };
  const output = readOxlintDiagnostics(
    runOxlintCommand({
      ...request,
      arguments: [...configurationArguments, "--format=json", "--threads=1", "--", ...files],
    }),
  );
  if (output.number_of_files !== linted.length)
    throw new Error("Oxlint did not lint the files listed by its configuration");
  const codes = new Set(request.rules.map((rule) => rule.replace("/", "(") + ")"));
  const diagnostics = output.diagnostics.filter(
    ({ code }) => code === undefined || codes.has(code),
  );
  return { linted, sites: mapDiagnosticsToSites({ ...request, files, diagnostics }) };
};

const runBatches = (request: BatchRequest): BatchObservation => {
  const batches: { readonly offset: number; readonly sources: ConfiguredSource[] }[] = [];
  const availableLength = 12_000;
  let length = availableLength;
  request.sources.forEach((source, offset) => {
    const size = source.fileName.length + 4;
    if (length + size >= availableLength) {
      batches.push({ offset, sources: [] });
      length = 0;
    }
    batches.at(-1)?.sources.push(source);
    length += size;
  });
  const observed = batches.map(({ offset, sources }) => {
    const observedBatch = runBatch({ ...request, sources });
    return {
      linted: observedBatch.linted,
      sites: observedBatch.sites.map((site) => ({ ...site, index: site.index + offset })),
    };
  });
  return {
    linted: observed.flatMap(({ linted }) => linted),
    sites: observed.flatMap(({ sites }) => sites),
  };
};

export type ConfiguredOxlintResult =
  | { readonly state: "not-included" }
  | ({ readonly state: "included" } & BatchObservation);

export const runConfiguredOxlint = (request: {
  readonly repoRoot: AbsolutePath;
  readonly folder: AbsolutePath;
  readonly config: string;
  readonly projection: string;
  readonly rules: readonly string[];
  readonly sources: readonly ConfiguredSource[];
  readonly peerFolders: readonly string[];
}): Result<ConfiguredOxlintResult, RunnerFailure> => {
  const toolchain = readOxlintToolchain({
    folder: request.repoRoot,
    peerFolders: request.peerFolders,
  });
  if (toolchain.outcome === "failed") return toolchain;
  try {
    const configured = { ...request, cli: toolchain.value };
    const state = configurationState(configured);
    return state === "not-included"
      ? { outcome: "ok", value: { state } }
      : { outcome: "ok", value: { state, ...runBatches(configured) } };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: failureDetailOf({ thrown }) },
    };
  }
};
