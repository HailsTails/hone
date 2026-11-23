import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { clauseAddressOf } from "../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import type { ClauseDefinition, SourceCase } from "../../domain/rule-set/rule-set-types.ts";
import type { RunnerClause } from "../../domain/runner/runner-module-types.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { RuleSetFiles } from "../ports/rule-set/rule-set-files.ts";
import type {
  ClauseRequest,
  ClauseUnderTest,
  ConformanceSetupFailure,
} from "./conformance-testing-types.ts";

export type RuleSetReading = {
  readonly ruleSetFiles: RuleSetFiles;
  readonly loadFailureDetail: LoadFailureDetail;
  readonly path: PathPort;
  readonly mechanism: EngineId;
  readonly installRoot: AbsolutePath;
};

export type BoundClause = { readonly clause: RunnerClause; readonly cases: readonly SourceCase[] };

type MechanicalClause = Extract<ClauseDefinition, { readonly kind: "mechanical" }>;

type SetupRefusal = { readonly outcome: "failed"; readonly error: ConformanceSetupFailure };

const setupFailed = (error: ConformanceSetupFailure): SetupRefusal => ({
  outcome: "failed",
  error,
});

const unloadable = (request: {
  readonly failure: LoadFailure;
  readonly loadFailureDetail: LoadFailureDetail;
}): SetupRefusal =>
  setupFailed({
    kind: "rule-set-unloadable",
    detail: request.loadFailureDetail({ failure: request.failure }),
  });

export const boundClauseOf = (
  request: RuleSetReading & ClauseRequest,
): Result<BoundClause, ConformanceSetupFailure> => {
  const { loadFailureDetail } = request;
  const address = clauseAddressOf({ text: request.clause });
  if (address === "not-a-clause-address") {
    return setupFailed({ kind: "address-invalid", detail: request.clause });
  }
  const ruleSetRoot = request.path.resolve({ path: request.ruleSetRoot });
  if (ruleSetRoot.outcome === "failed") {
    return setupFailed({
      kind: "rule-set-unloadable",
      detail: `${request.ruleSetRoot} does not resolve: ${ruleSetRoot.error.kind}`,
    });
  }
  const held = request.ruleSetFiles.disciplineFile({
    ruleSetRoot: ruleSetRoot.value,
    installRoot: request.installRoot,
    discipline: address.discipline,
  });
  if (held.outcome === "failed") {
    return unloadable({ failure: held.error, loadFailureDetail });
  }
  if (held.value.held === "absent") {
    return unloadable({
      failure: { kind: "unknown-discipline", address: request.clause },
      loadFailureDetail,
    });
  }
  const discipline = held.value.file;
  const definition = discipline.clauses.find(
    (clause): clause is MechanicalClause =>
      clause.id === address.clause && clause.kind === "mechanical",
  );
  if (definition === undefined) {
    return setupFailed({ kind: "clause-not-mechanical", detail: request.clause });
  }
  if (!definition.mechanisms.includes(request.mechanism)) {
    return unloadable({
      failure: {
        kind: "mechanism-not-allowed",
        address: request.clause,
        mechanism: request.mechanism,
      },
      loadFailureDetail,
    });
  }
  const piece = request.ruleSetFiles.pieceFile({
    ruleSetRoot: ruleSetRoot.value,
    installRoot: request.installRoot,
    mechanism: request.mechanism,
    discipline,
  });
  if (piece.outcome === "failed") {
    return unloadable({ failure: piece.error, loadFailureDetail });
  }
  const entry = piece.value.clauses.find((candidate) => candidate.clause === address.clause);
  if (entry === undefined) {
    return unloadable({
      failure: { kind: "piece-missing", address: request.clause, mechanism: request.mechanism },
      loadFailureDetail,
    });
  }
  return {
    outcome: "ok",
    value: {
      clause: {
        address,
        anchor: definition.anchor,
        pieceRoot: entry.pieceRoot,
        settings: entry.settings,
        clauseSettings: defaultClauseSettings({ declarations: entry.clauseSettings }),
        edition: entry.editions.default,
      },
      cases: [...definition.cases.flag, ...definition.cases.allow],
    },
  };
};

export const clauseUnderTestOf = (
  request: RuleSetReading & ClauseRequest,
): Result<ClauseUnderTest, ConformanceSetupFailure> => {
  const bound = boundClauseOf(request);
  if (bound.outcome === "failed") {
    return bound;
  }
  return {
    outcome: "ok",
    value: {
      clause: bound.value.clause,
      cases: bound.value.cases.map((sourceCase) => ({
        name: sourceCase.name,
        file: sourceCase.fileName,
        source: sourceCase.source,
        edition: sourceCase.edition ?? bound.value.clause.edition,
      })),
    },
  };
};

export { repoPathOf } from "./check-conformance.ts";
