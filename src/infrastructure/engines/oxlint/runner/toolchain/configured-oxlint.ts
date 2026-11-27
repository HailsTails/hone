import { z } from "zod";

import { failureDetailOf } from "../../../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { ReadonlyJsonValue } from "../../../../../domain/settings/json-values/json-value.ts";
import {
  mapDiagnosticsToSites,
  readOxlintDiagnostics,
  runOxlintCommand,
  type OxlintSite,
} from "./oxlint-diagnostics.ts";
import {
  findDisableMarker,
  readDisableDirectives,
  type DisableDirective,
} from "./oxlint-directives.ts";

const configSchema = z.looseObject({
  jsPlugins: z.array(z.object({ name: z.string(), specifier: z.string() })).nullish(),
  overrides: z
    .array(
      z.looseObject({
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

export const removeProjectedOffSwitches = (request: {
  readonly config: EffectiveConfig;
  readonly ids: ReadonlySet<string>;
  readonly projectedOverrides: number;
}): EffectiveConfig => {
  const overrides = request.config.overrides ?? [];
  const recorded = new Set(
    overrides
      .filter(({ rules }) => Object.keys(rules).some((id) => request.ids.has(id)))
      .slice(-request.projectedOverrides)
      .slice(1),
  );
  return {
    ...request.config,
    overrides: overrides.map((entry) =>
      recorded.has(entry)
        ? {
            ...entry,
            rules: Object.fromEntries(
              Object.entries(entry.rules).filter(([id]) => !request.ids.has(id)),
            ),
          }
        : entry,
    ),
  };
};

type LintConfiguration = {
  readonly config: string;
  readonly loader?: string;
  readonly input?: string;
};

const createGovernanceConfiguration = (request: {
  readonly loader: string;
  readonly input: EffectiveConfig;
}): LintConfiguration => {
  // Oxlint resolves globs and plugins from the config path. The loader supplies
  // that scoped module from stdin so checking requires no checkout writes.
  const config = `.hone-oxlint-governance-${crypto.randomUUID()}.mjs`;
  const loader = new URL(request.loader);
  loader.searchParams.set("configuration", config);
  return { config, loader: loader.href, input: JSON.stringify(request.input) };
};

const readConfiguration = (request: {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly config: string;
  readonly projection: string;
  readonly rules: readonly string[];
  readonly governanceLoader: string;
}): LintConfiguration | undefined => {
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
  if (
    !preservesOverrides ||
    JSON.stringify(configured.plugins) !== JSON.stringify(required.plugins)
  )
    return undefined;
  return required.overrides.length < 2
    ? { config: request.config }
    : createGovernanceConfiguration({
        loader: request.governanceLoader,
        input: removeProjectedOffSwitches({
          config: active,
          ids,
          projectedOverrides: required.overrides.length,
        }),
      });
};

type ConfiguredSource = { readonly fileName: string; readonly source: string };

type ConfiguredRequest = {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly config: string;
  readonly rules: readonly string[];
  readonly sources: readonly ConfiguredSource[];
  readonly disableConfiguration: string;
};

type BatchRequest = ConfiguredRequest & { readonly lint: LintConfiguration };

type BatchObservation = {
  readonly linted: readonly string[];
  readonly sites: readonly OxlintSite[];
  readonly disables: readonly DisableDirective[];
};

const readBatchDisables = (request: BatchRequest): readonly DisableDirective[] => {
  const { disableConfiguration } = request;
  const sources = new Map(
    request.sources
      .filter(({ source }) => findDisableMarker(source) !== null)
      .map(({ fileName, source }) => [fileName, Buffer.from(source)]),
  );
  const targets = [...sources.keys()];
  return targets.length === 0
    ? []
    : readDisableDirectives({
        ...request,
        config: disableConfiguration,
        targets,
        files: targets,
        sources,
      });
};

const runBatch = (request: BatchRequest): BatchObservation => {
  const files = request.sources.map(({ fileName }) => fileName);
  const disables = readBatchDisables(request);
  const scopeArguments = ["--disable-nested-config", "--no-error-on-unmatched-pattern"];
  const listing = runOxlintCommand({
    ...request,
    arguments: ["--config", request.config, ...scopeArguments, "--debug=files", "--", ...files],
  });
  const linted = listing
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
  if (linted.some((file) => !files.includes(file))) throw new Error(listing.trim());
  if (linted.length === 0) return { linted, sites: [], disables };
  const output = readOxlintDiagnostics(
    runOxlintCommand({
      ...request,
      ...request.lint,
      arguments: [
        "--config",
        request.lint.config,
        ...scopeArguments,
        "--format=json",
        "--threads=1",
        "--",
        ...linted,
      ],
    }),
  );
  if (output.number_of_files !== linted.length)
    throw new Error("Oxlint did not lint the files listed by its configuration");
  const codes = new Set(request.rules.map((rule) => rule.replace("/", "(") + ")"));
  const diagnostics = output.diagnostics.filter(
    ({ code }) => code === undefined || codes.has(code),
  );
  return { linted, disables, sites: mapDiagnosticsToSites({ ...request, files, diagnostics }) };
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
      ...observedBatch,
      sites: observedBatch.sites.map((site) => ({ ...site, index: site.index + offset })),
    };
  });
  return {
    linted: observed.flatMap(({ linted }) => linted),
    sites: observed.flatMap(({ sites }) => sites),
    disables: observed.flatMap(({ disables }) => disables),
  };
};

export type ConfiguredOxlintResult =
  | { readonly state: "not-included" }
  | ({ readonly state: "included" } & BatchObservation);

export const runConfiguredOxlint = (
  request: ConfiguredRequest & {
    readonly projection: string;
    readonly governanceLoader: string;
  },
): Result<ConfiguredOxlintResult, RunnerFailure> => {
  try {
    const lint = readConfiguration(request);
    return lint === undefined
      ? { outcome: "ok", value: { state: "not-included" } }
      : { outcome: "ok", value: { state: "included", ...runBatches({ ...request, lint }) } };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: failureDetailOf({ thrown }) },
    };
  }
};
