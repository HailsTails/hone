import { loadFailureDetail } from "../../infrastructure/printed-report/load-failures/load-failure-text.ts";
import type { LoadFailure } from "../../infrastructure/command-line/load-failure.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import type { RunnerClause } from "../../domain/runner/runner-module-types.ts";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { PathPort } from "../../infrastructure/node/path-port.ts";
import {
  type ClauseDefinition,
  pieceFolderSegmentsOf,
  readDisciplineFile,
  readPieceFile,
  type SourceCase,
} from "../../infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { MechanismId } from "../../infrastructure/hone-config-file/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { AbsolutePath } from "../../infrastructure/content-files/absolute-path.ts";
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
  const address = clauseAddressSchema.safeParse(request.clause);
  if (!address.success) {
    return setupFailed({ kind: "address-invalid", detail: request.clause });
  }
  const ruleSetRoot = request.path.resolve({ path: request.ruleSetRoot });
  if (ruleSetRoot.outcome === "failed") {
    return setupFailed({ kind: "rule-set-unloadable", detail: `${request.ruleSetRoot} does not resolve: ${ruleSetRoot.error.kind}` });
  }
  const reading = { fileText: request.fileText, path: request.path, ruleSetRoot: ruleSetRoot.value, installRoot: request.installRoot };
  const discipline = readDisciplineFile({ ...reading, discipline: address.data.discipline });
  if (discipline.outcome === "failed") {
    return unloadable({ failure: discipline.error });
  }
  const definition = discipline.value.clauses.find(
    (clause): clause is MechanicalClause => clause.id === address.data.clause && clause.kind === "mechanical",
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
  const entry = piece.value.clauses.find((candidate) => candidate.clause === address.data.clause);
  if (entry === undefined) {
    return unloadable({ failure: { kind: "piece-missing", address: request.clause, mechanism: request.mechanism } });
  }
  return {
    outcome: "ok",
    value: {
      clause: {
        address: address.data,
        anchor: definition.anchor,
        pieceRoot: request.path.join({
          segments: pieceFolderSegmentsOf({
            ruleSetRoot: ruleSetRoot.value,
            installRoot: request.installRoot,
            mechanism: request.mechanism,
            discipline: address.data.discipline,
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
  const file = repoPathSchema.safeParse(request.file);
  return file.success ? { outcome: "ok", value: file.data } : setupFailed({ kind: "file-invalid", detail: request.file });
};
