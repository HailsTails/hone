import { z } from "zod";

import { failureDetailOf } from "../../../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { ReadonlyJsonValue } from "../../../../../domain/settings/json-values/json-value.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-system-port.ts";
import { withTemporaryDirectory } from "../../../../node/file-system/temporary-directory-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import type { SelectedOxlintRule } from "../selected-rule.ts";
import { createMeasurementConfiguration } from "./measurement-configuration.ts";
import {
  mapDiagnosticsToSites,
  readOxlintDiagnostics,
  runOxlintCommand,
  type OxlintSite,
} from "./oxlint-diagnostics.ts";
import {
  disableInspection,
  findDisableMarker,
  type DisableDirective,
} from "./oxlint-directives.ts";

const configSchema = z.object({
  jsPlugins: z
    .array(z.union([z.string(), z.object({ name: z.string(), specifier: z.string() })]))
    .nullish()
    .transform((plugins) => plugins ?? []),
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
    .nullish()
    .transform((overrides) => overrides ?? []),
});

type EffectiveConfig = z.output<typeof configSchema>;
const path = createDefaultPathPort({});
const text = createDefaultFileTextPort({});

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
  plugins: request.config.jsPlugins
    .filter((plugin) => typeof plugin !== "string")
    .filter(({ name }) => request.namespaces.has(name))
    .toSorted((left, right) => left.name.localeCompare(right.name, "en")),
  overrides: request.config.overrides.flatMap(({ files, rules }) => {
    const selected = selectRules({ rules, ids: request.ids });
    return Object.keys(selected).length === 0 ? [] : [{ files, rules: selected }];
  }),
});

const readProjectionState = (request: {
  readonly cli: string;
  readonly folder: AbsolutePath;
  readonly config: string;
  readonly projection: string;
  readonly rules: readonly string[];
  readonly namespaces: ReadonlySet<string>;
}): "not-included" | "with-off-switches" | "included" => {
  const projected = printConfiguration({ ...request, config: request.projection });
  const active = printConfiguration(request);
  const ids = new Set(
    request.rules.flatMap((rule) =>
      rule.startsWith("eslint/") ? [rule, rule.slice("eslint/".length)] : [rule],
    ),
  );
  const required = readEffectiveChecks({ config: projected, ids, namespaces: request.namespaces });
  const configured = readEffectiveChecks({ config: active, ids, namespaces: request.namespaces });
  const preservesOverrides =
    JSON.stringify(configured.overrides.slice(-required.overrides.length)) ===
    JSON.stringify(required.overrides);
  if (
    !preservesOverrides ||
    JSON.stringify(configured.plugins) !== JSON.stringify(required.plugins)
  )
    return "not-included";
  return required.overrides.length > 1 ? "with-off-switches" : "included";
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

type MeasurementPlan =
  | { readonly kind: "adopted" }
  | { readonly kind: "raw"; readonly config: string };

type BatchRequest = ConfiguredRequest & { readonly measurement: MeasurementPlan };

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
    : disableInspection.read({
        ...request,
        config: disableConfiguration,
        targets,
        files: targets,
        sources,
      });
};

const runBatch = (request: BatchRequest): BatchObservation => {
  const files = request.sources.map(({ fileName }) => fileName);
  const { measurement } = request;
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
      arguments: [
        "--config",
        measurement.kind === "raw" ? measurement.config : request.config,
        ...scopeArguments,
        ...(measurement.kind === "raw" ? ["--no-ignore"] : []),
        "--format=json",
        "--threads=1",
        "--",
        ...linted,
      ],
    }),
  );
  if (output.number_of_files !== linted.length)
    throw new Error("Oxlint did not lint the files listed by its configuration");
  if (measurement.kind === "raw" && output.number_of_rules !== request.rules.length)
    throw new Error("Oxlint did not measure the selected Hone rules");
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
  request: Omit<ConfiguredRequest, "rules"> & {
    readonly repoRoot: AbsolutePath;
    readonly projection: string;
    readonly rules: readonly SelectedOxlintRule[];
  },
): Result<ConfiguredOxlintResult, RunnerFailure> => {
  try {
    const rules = [...new Set(request.rules.map(({ id }) => id))];
    const namespaces = new Set(
      request.rules.flatMap((rule) => (rule.kind === "plugin" ? [rule.namespace] : [])),
    );
    const batch = { ...request, rules };
    const state = readProjectionState({ ...batch, namespaces });
    if (state === "not-included") return { outcome: "ok", value: { state } };
    const observed =
      state === "included"
        ? runBatches({ ...batch, measurement: { kind: "adopted" } })
        : withTemporaryDirectory({
            outside: request.repoRoot,
            use: (folder) => {
              const measurementConfig = path.join({ segments: [folder, ".oxlintrc.json"] });
              const written = text.write({
                path: measurementConfig,
                text: JSON.stringify(createMeasurementConfiguration(request.rules)),
              });
              if (written.outcome === "failed") throw new Error(written.error.detail);
              return runBatches({
                ...batch,
                measurement: { kind: "raw", config: measurementConfig },
              });
            },
          });
    return { outcome: "ok", value: { state: "included", ...observed } };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: failureDetailOf({ thrown }) },
    };
  }
};
