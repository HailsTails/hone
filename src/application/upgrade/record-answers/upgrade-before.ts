import type { CheckAddressText } from "../../../domain/language-layer/check-address-text.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { CheckedTree } from "../../../domain/repository/checked-tree.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../domain/result.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type { SelectionReading } from "../../../domain/settings/selection/selection.ts";
import {
  SETTINGS_FILE_NAME,
  VERSION_ONE_SETTINGS_FILE_NAME,
} from "../../../domain/settings/settings-file.ts";
import type { ProjectionRequest } from "../../ports/engine/runner-module.ts";
import type { EnginePass, EnginePassFailure } from "../../ports/upgrade/engine-pass.ts";
import type { CheckedVersionOneProjection } from "../../ports/upgrade/version-one-measurement.ts";
import type { VersionOneProjectionPort } from "../../ports/upgrade/version-one-projection-port.ts";
import { checkedTreeOf } from "../../run/checked-tree-of.ts";
import { foundTreeCheckReachOf } from "../found-tree/found-tree-reach.ts";
import {
  exceptionBaselineOf,
  partialAssessmentsOf,
  touchedSetFor,
  unmeasuredOf,
} from "./measurement.ts";
import {
  createNamedVersionOneEnginePass,
  type NamedVersionOnePassRequest,
} from "./named-version-one-engine-pass.ts";
import type { VersionOneCheckInput } from "./version-one-check-input.ts";
import { versionOneNamesOf } from "./version-one-observations.ts";
import { versionOneProofReportOf } from "./version-one-proof-report.ts";

type BeforeInput = Pick<
  NamedVersionOnePassRequest,
  | "engine"
  | "sources"
  | "readPiece"
  | "selection"
  | "catalogues"
  | "loadFailureDetail"
  | "measureVersionOne"
> & {
  readonly check: VersionOneCheckInput;
  readonly projection: VersionOneProjectionPort;
};

type Ready = { readonly selected: SelectionReading; readonly tree: CheckedTree };

const ESLINT = "eslint";
const PROJECTION = repoPathOf("disciplines.eslint.mjs");

const readyOf = (check: VersionOneCheckInput): Result<Ready, LoadFailure> => {
  const read = check.selectionRepository.read({});
  if (read.outcome === "failed") return read;
  const tree = checkedTreeOf({
    ...check,
    excluded: read.value.excluded,
    eslintConfigRoots: read.value.eslintConfigRoots,
  });
  return tree.outcome === "failed"
    ? tree
    : { outcome: "ok", value: { selected: read.value, tree: tree.value } };
};

const projectRequestOf = (request: {
  readonly ready: Ready;
  readonly check: VersionOneCheckInput;
  readonly records: readonly ExceptionRecord[];
}): ProjectionRequest => {
  const { ready, check } = request;
  return {
    repoRoot: check.repoRoot,
    installRoot: check.installRoot,
    declaredConfigRoots: ready.tree.declaredConfigRoots,
    trackedPaths: ready.tree.tracked,
    clauses: ready.selected.bindings
      .filter(({ mechanism }) => mechanism === ESLINT)
      .map(({ clause }) => clause),
    records: request.records.filter(({ mechanism }) => mechanism === ESLINT),
  };
};

const validationFailed = (detail: string): Result<never, EnginePassFailure> => ({
  outcome: "failed",
  error: { kind: "version-one-run-failed", detail },
});

const checkedProjectionOf = async (
  request: BeforeInput & { readonly ready: Ready; readonly records: readonly ExceptionRecord[] },
): Promise<Result<CheckedVersionOneProjection | undefined, EnginePassFailure>> => {
  const projection = projectRequestOf(request);
  if (projection.clauses.length === 0) return { outcome: "ok", value: undefined };
  const inspected = await request.projection.inspect(projection);
  if (inspected.outcome === "failed") {
    return validationFailed(
      request.loadFailureDetail({
        failure: { kind: "runner-failed", mechanism: ESLINT, failure: inspected.error },
      }),
    );
  }
  const names = versionOneNamesOf({
    selected: request.ready.selected.selection.selected,
    catalogues: request.catalogues,
  });
  if (names.outcome === "failed") return names;
  const rules = everyOk({
    entries: [...(names.value.get(ESLINT) ?? [])],
    resolve: ([check, clause]): Result<readonly [CheckAddressText, string], EnginePassFailure> => {
      const id = inspected.value.ruleIds.get(clauseAddressText({ address: clause }));
      return id === undefined
        ? validationFailed(`the version one projection names no rule for ${check}`)
        : { outcome: "ok", value: [check, id] };
    },
  });
  if (rules.outcome === "failed") return rules;
  return {
    outcome: "ok",
    value: {
      settingsFile: VERSION_ONE_SETTINGS_FILE_NAME,
      projectionFile: PROJECTION,
      packageFiles: inspected.value.files.filter((file) => file !== PROJECTION),
      rules: new Map(rules.value),
    },
  };
};

const namedPassOf = (request: BeforeInput & { readonly ready: Ready }): EnginePass =>
  createNamedVersionOneEnginePass({
    ...request.check,
    engine: request.engine,
    measureVersionOne: request.measureVersionOne,
    selected: request.ready.selected.selection.selected,
    selection: request.selection,
    catalogues: request.catalogues,
    tree: request.ready.tree,
    sources: request.sources,
    readPiece: request.readPiece,
    settingsPath: SETTINGS_FILE_NAME,
    loadFailureDetail: request.loadFailureDetail,
    checkProjection: ({ records }) => checkedProjectionOf({ ...request, records }),
  });

export type UpgradeBefore = {
  readonly enginePass: EnginePass;
  readonly report: () => Promise<Result<CheckReport, LoadFailure>>;
  readonly prepareProjections: (
    records: readonly ExceptionRecord[],
  ) => Promise<Result<readonly ProjectionWrite[], LoadFailure>>;
};

export const createUpgradeBefore = (request: BeforeInput): UpgradeBefore => {
  let readiness: Result<Ready, LoadFailure> | undefined;
  const readReady = (): Result<Ready, LoadFailure> => (readiness ??= readyOf(request.check));

  return {
    enginePass: {
      findingsFor: (given) => {
        const ready = readReady();
        return ready.outcome === "failed"
          ? Promise.resolve(validationFailed(request.loadFailureDetail({ failure: ready.error })))
          : namedPassOf({ ...request, ready: ready.value }).findingsFor(given);
      },
    },
    report: async (): Promise<Result<CheckReport, LoadFailure>> => {
      const ready = readReady();
      if (ready.outcome === "failed") return ready;
      const pass = namedPassOf({ ...request, ready: ready.value });
      const check = { ...request.check, ...foundTreeCheckReachOf(request) };
      const entries = check.exceptionRepository.read();
      if (entries.outcome === "failed") return entries;
      const selection = ready.value.selected;
      const exceptionBaseline = exceptionBaselineOf({
        check,
        entries: entries.value.map(({ entry }) => entry),
      });
      const exceptions = check.exceptionEntryParser.parseExceptionEntries({
        entries: entries.value,
        selection: selection.selection,
        baseline: exceptionBaseline,
        fileExceptionWhyChains: selection.fileExceptionWhyChains,
      });
      const records = exceptions.records;
      const touched = touchedSetFor({ check, records });
      return versionOneProofReportOf({
        selection,
        exceptions,
        touched,
        pass,
        assessment: partialAssessmentsOf({ assessment: check.assessment, records }),
        unmeasured: unmeasuredOf({ touched, records, exceptionBaseline }),
      });
    },
    prepareProjections: async (
      records: readonly ExceptionRecord[],
    ): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
      const ready = readReady();
      if (ready.outcome === "failed") return ready;
      const projection = projectRequestOf({ ...request, ready: ready.value, records });
      if (projection.clauses.length === 0) return { outcome: "ok", value: [] };
      const prepared = await request.projection.prepare(projection);
      return prepared.outcome === "failed"
        ? {
            outcome: "failed",
            error: { kind: "runner-failed", mechanism: ESLINT, failure: prepared.error },
          }
        : prepared;
    },
  };
};
