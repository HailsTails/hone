import { loadFailureDetail } from "../../infrastructure/printed-report/load-failures/load-failure-text.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import type { RunnerClause } from "../../domain/runner/runner-module-types.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import { readDisciplineFile, readPieceFile } from "../../infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { pieceFolderSegmentsOf } from "../../domain/rule-set/piece-folder.ts";
import type { ClauseDefinition, SourceCase } from "../../domain/rule-set/rule-set-types.ts";
import { clauseAddressOf } from "../../domain/rule-set/clause-address.ts";
import type { MechanismId } from "../../domain/rule-set/identifier-types.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { isRepoPath } from "../../domain/repository/repo-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { ClauseRequest, ClauseUnderTest, ConformanceSetupFailure } from "./conformance-testing-types.ts";

export type RuleSetReading = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly mechanism: MechanismId;
  readonly installRoot: AbsolutePath;
};

export type BoundClause = { readonly clause: RunnerClause; readonly cases: readonly SourceCase[] };

type MechanicalClause = Extract<ClauseDefinition, { readonly kind: "mechanical" }>;

type SetupRefusal = { readonly outcome: "failed"; readonly error: ConformanceSetupFailure };

const setupFailed = (error: ConformanceSetupFailure): SetupRefusal => ({ outcome: "failed", error });

const unloadable = (request: { readonly failure: LoadFailure }): SetupRefusal =>
  setupFailed({ kind: "rule-set-unloadable", detail: loadFailureDetail(request) });

export const boundClauseOf = (request: RuleSetReading & ClauseRequest): Result<BoundClause, ConformanceSetupFailure> => {
  const address = clauseAddressOf({ text: request.clause });
  if (address === "not-a-clause-address") {
    return setupFailed({ kind: "address-invalid", detail: request.clause });
  }
  const ruleSetRoot = request.path.resolve({ path: request.ruleSetRoot });
  if (ruleSetRoot.outcome === "failed") {
    return setupFailed({ kind: "rule-set-unloadable", detail: `${request.ruleSetRoot} does not resolve: ${ruleSetRoot.error.kind}` });
  }
  const reading = { fileText: request.fileText, path: request.path, ruleSetRoot: ruleSetRoot.value, installRoot: request.installRoot };
  const discipline = readDisciplineFile({ ...reading, discipline: address.discipline });
  if (discipline.outcome === "failed") {
    return unloadable({ failure: discipline.error });
  }
  const definition = discipline.value.clauses.find(
    (clause): clause is MechanicalClause => clause.id === address.clause && clause.kind === "mechanical",
  );
  if (definition === undefined) {
    return setupFailed({ kind: "clause-not-mechanical", detail: request.clause });
  }
  if (!definition.mechanisms.includes(request.mechanism)) {
    return unloadable({ failure: { kind: "mechanism-not-allowed", address: request.clause, mechanism: request.mechanism } });
  }
  const piece = readPieceFile({ ...reading, mechanism: request.mechanism, discipline: discipline.value });
  if (piece.outcome === "failed") {
    return unloadable({ failure: piece.error });
  }
  const entry = piece.value.clauses.find((candidate) => candidate.clause === address.clause);
  if (entry === undefined) {
    return unloadable({ failure: { kind: "piece-missing", address: request.clause, mechanism: request.mechanism } });
  }
  return {
    outcome: "ok",
    value: {
      clause: {
        address,
        anchor: definition.anchor,
        pieceRoot: request.path.join({
          segments: pieceFolderSegmentsOf({
            ruleSetRoot: ruleSetRoot.value,
            installRoot: request.installRoot,
            mechanism: request.mechanism,
            discipline: address.discipline,
          }),
        }),
        settings: entry.settings,
        clauseSettings: defaultClauseSettings({ declarations: entry.clauseSettings }),
        edition: entry.editions.default,
      },
      cases: [...definition.cases.flag, ...definition.cases.allow],
    },
  };
};

export const clauseUnderTestOf = (request: RuleSetReading & ClauseRequest): Result<ClauseUnderTest, ConformanceSetupFailure> => {
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

export const repoPathOf = (request: { readonly file: string }): Result<RepoPath, ConformanceSetupFailure> => {
  return isRepoPath(request.file) ? { outcome: "ok", value: request.file } : setupFailed({ kind: "file-invalid", detail: request.file });
};
