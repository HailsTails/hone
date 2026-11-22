import { selectionRepositoryHolding } from "../../application/run/settings/selection-holding.ts";
import type { SelectionReading } from "../../domain/settings/selection/selection.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import type { PlacedEntry } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import {
  type InheritedDebtOutcome,
  inheritedDebtEntriesOf,
  inheritedDebtOf,
  reachedDebtOf,
} from "../../domain/records/discipline-exceptions/inherited-debt.ts";
import type { GitTreePort } from "../../application/ports/git-port.ts";
import type { Assessment } from "../../domain/settings/assessment.ts";
import { clauseAddressText } from "../../domain/rule-set/clause-address.ts";
import type { MechanismId } from "../../domain/rule-set/identifier-types.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { RecordDebtArguments } from "../../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../../application/ports/command/repository-located.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import { runReachedCheck } from "../../application/run/check/run-check.ts";

export type AdoptionInput = VersionOneCommandPorts &
  RepositoryLocated & {
    readonly gitTree: GitTreePort;
    readonly arguments: RecordDebtArguments;
    readonly exceptionRepository: ExceptionRepository;
  };

type DebtResult = Result<readonly InheritedDebtOutcome[], LoadFailure>;

const ASSESSED_IN_THIS_RUN: Assessment = { forfeiture: "this-run" };

const pathsInBase = (request: AdoptionInput): Result<ReadonlySet<RepoPath>, LoadFailure> => {
  const listed = request.gitTree.pathsAt({ repoRoot: request.repoRoot, revision: request.arguments.baseRevision });
  return listed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "git-failed", detail: `${listed.error.command}: ${listed.error.detail}` } }
    : { outcome: "ok", value: new Set(listed.value) };
};

type DebtRequest = AdoptionInput & {
  readonly selection: SelectionReading;
  readonly existing: readonly PlacedEntry[];
  readonly inBase: ReadonlySet<RepoPath>;
};

const clauseMechanismsOf = (request: { readonly selection: SelectionReading }): ReadonlyMap<string, MechanismId> =>
  new Map(request.selection.selection.selected.map((clause) => [clauseAddressText({ address: clause.address }), clause.mechanism]));

const debtOutcomesOf = async (request: DebtRequest): Promise<DebtResult> => {
  const reached = await runReachedCheck({
    ...request,
    moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
    baseRevision: request.arguments.baseRevision,
    assessment: ASSESSED_IN_THIS_RUN,
    selectionRepository: selectionRepositoryHolding({ reading: request.selection }),
    shownPathOf: request.shownPathOfRepository(request),
  });
  if (reached.outcome === "failed") {
    return reached;
  }
  const outcomes = reachedDebtOf({
    outcomes: inheritedDebtOf({
      findings: reached.value.report.findings,
      unrecorded: reached.value.report.unrecorded,
      existing: request.existing,
      leave: request.arguments.leave,
      inBase: request.inBase,
      refusing: request.selection.selection.selected.flatMap((clause) => (clause.exceptions === "refused" ? [clause.address] : [])),
    }),
    unprojected: reached.value.unprojected,
    mechanisms: clauseMechanismsOf(request),
  });
  const written = request.exceptionRepository.add({ entries: inheritedDebtEntriesOf({ outcomes }) });
  return written.outcome === "failed" ? written : { outcome: "ok", value: outcomes };
};

export const adoptionDebt = (request: AdoptionInput): Promise<DebtResult> => {
  const { repoRoot, installRoot, fileText, path } = request;
  const selection = request.selectionRepositoryOf({ repoRoot, installRoot, moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }), fileText, path }).read({});
  if (selection.outcome === "failed") {
    return Promise.resolve(selection);
  }
  const existing = request.exceptionRepository.read();
  if (existing.outcome === "failed") {
    return Promise.resolve(existing);
  }
  const inBase = pathsInBase(request);
  if (inBase.outcome === "failed") {
    return Promise.resolve(inBase);
  }
  return debtOutcomesOf({ ...request, selection: selection.value, existing: existing.value, inBase: inBase.value });
};
