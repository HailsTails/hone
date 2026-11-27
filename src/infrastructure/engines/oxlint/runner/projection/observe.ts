import type { NamedEngineRunRequest } from "../../../../../application/ports/engine/engine-run.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type {
  CheckHit,
  CheckMeasurement,
  CheckNativeException,
} from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import type {
  ConfiguredOxlintResult,
  runConfiguredOxlint,
} from "../../../../node/process/configured-oxlint.ts";
import type { RunOxlint } from "../../../../node/process/oxlint-port.ts";
import { readInlineDisables } from "./inline.ts";
import { answersCheck, type ProjectionRule } from "./oxlint-projection.ts";
import type { PlannedProjection } from "./project.ts";

const path = createDefaultPathPort({});

type ScopeState = "current" | "missing" | "out-of-date" | "not-included";

export type ScopeObservation = {
  readonly state: ScopeState;
  readonly file: RepoPath;
  readonly hits: readonly CheckHit[];
  readonly measured: readonly CheckMeasurement[];
  readonly nativeExceptions: readonly CheckNativeException[];
};

type ScopeRequest = Pick<NamedEngineRunRequest, "repoRoot" | "answered"> & {
  readonly scope: PlannedProjection;
  readonly rules: readonly ProjectionRule[];
  readonly fileText: Pick<FileTextPort, "read">;
  readonly lint: RunOxlint;
  readonly configured: typeof runConfiguredOxlint;
};

const emptyObservation = (
  request: ScopeRequest,
  state: ScopeState,
): Result<ScopeObservation, RunnerFailure> => ({
  outcome: "ok",
  value: { state, file: request.scope.file, hits: [], measured: [], nativeExceptions: [] },
});

type ScopeSource = {
  readonly file: RepoPath;
  readonly fileName: string;
  readonly source: string;
};

const readSource = (
  request: ScopeRequest & { readonly file: RepoPath },
): Result<ScopeSource, RunnerFailure> => {
  const read = request.fileText.read({
    path: path.join({ segments: [request.repoRoot, request.file] }),
  });
  return read.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "tool-failed", detail: `${request.file}: ${read.error.detail}` },
      }
    : {
        outcome: "ok",
        value: {
          file: request.file,
          fileName:
            request.scope.folder === ""
              ? request.file
              : request.file.slice(request.scope.folder.length + 1),
          source: read.value,
        },
      };
};

const mapScopeObservations = (
  request: ScopeRequest & {
    readonly sources: readonly ScopeSource[];
    readonly observed: Extract<ConfiguredOxlintResult, { readonly state: "included" }>;
    readonly inline: readonly CheckNativeException[];
  },
): ScopeObservation => {
  const { scope, rules, sources, observed } = request;
  const linted = new Set(observed.linted);
  const checks = rules.map(({ binding }) => binding.address);
  const byRule = Map.groupBy(rules, ({ rule }) => rule.id);
  return {
    state: "current",
    file: scope.file,
    hits: observed.sites.flatMap(({ rule, index, line, column }) => {
      const { file, source } = sources[index];
      const snippet = source.split(/\r\n|[\n\r\u2028\u2029]/u)[line - 1]?.trim() ?? "";
      return (byRule.get(rule) ?? []).map(({ binding }) => ({
        check: binding.address,
        file,
        anchor: { line, column },
        snippet,
      }));
    }),
    measured: sources
      .filter(({ fileName }) => linted.has(fileName))
      .flatMap(({ file }) => checks.map((check) => ({ file, check }))),
    nativeExceptions: [
      ...request.inline,
      ...sources
        .filter(({ fileName }) => !linted.has(fileName))
        .flatMap(({ file }) =>
          checks.map((check): CheckNativeException => ({ kind: "ignore", check, file })),
        ),
      ...request.answered
        .filter(({ file }) => scope.files.includes(file))
        .flatMap((answer) =>
          rules
            .filter(({ binding }) => answersCheck({ binding, answer }))
            .map(({ binding }): CheckNativeException => ({
              kind: "config-override",
              check: binding.address,
              file: answer.file,
            })),
        ),
    ],
  };
};

const observeIncluded = async (
  request: ScopeRequest & { readonly config: RepoPath },
): Promise<Result<ScopeObservation, RunnerFailure>> => {
  const { scope, rules } = request;
  const read = gatheredOutcomes({
    outcomes: scope.files.map((file) =>
      listedOutcome({ outcome: readSource({ ...request, file }) }),
    ),
  });
  if (read.outcome === "failed") return read;
  const observed = request.configured({
    repoRoot: request.repoRoot,
    folder: absolutePathSchema.parse(path.join({ segments: [request.repoRoot, scope.folder] })),
    config: request.config.slice(request.config.lastIndexOf("/") + 1),
    projection: scope.file.slice(scope.file.lastIndexOf("/") + 1),
    rules: [...new Set(rules.map(({ rule }) => rule.id))],
    sources: read.value,
    peerFolders: rules.flatMap(({ rule }) =>
      rule.kind === "plugin" && rule.peerFolder !== undefined ? [rule.peerFolder] : [],
    ),
  });
  if (observed.outcome === "failed") return observed;
  if (observed.value.state === "not-included") return emptyObservation(request, "not-included");
  const inline = await readInlineDisables({ ...request, sources: read.value });
  if (inline.outcome === "failed") return inline;
  return {
    outcome: "ok",
    value: mapScopeObservations({
      ...request,
      sources: read.value,
      observed: observed.value,
      inline: inline.value,
    }),
  };
};

export const observeProjection = async (
  request: ScopeRequest,
): Promise<Result<ScopeObservation, RunnerFailure>> => {
  const { scope } = request;
  if (scope.files.length === 0) return emptyObservation(request, "current");
  const projection = request.fileText.read({
    path: path.join({ segments: [request.repoRoot, scope.file] }),
  });
  if (projection.outcome === "failed") return emptyObservation(request, "missing");
  if (projection.value !== scope.generated.text) return emptyObservation(request, "out-of-date");
  if (scope.config === undefined) return emptyObservation(request, "not-included");
  return observeIncluded({ ...request, config: scope.config });
};
