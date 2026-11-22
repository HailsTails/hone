import type { RecordDebtArguments } from "../../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../../application/ports/command/repository-located.ts";
import type { GitTreePort } from "../../application/ports/git-port.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import { runReachedCheck } from "../../application/run/check/run-check.ts";
import { selectionRepositoryHolding } from "../../application/run/settings/selection-holding.ts";
import type { PlacedEntry } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import {
  type InheritedDebtOutcome,
  type InheritedDebtRequest,
  inheritedDebtEntriesOf,
  inheritedDebtOf,
  reachedDebtOf,
} from "../../domain/records/discipline-exceptions/inherited-debt.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { GitFailure } from "../../domain/repository/git-failure.ts";
import type { Result } from "../../domain/result.ts";
import { clauseAddressText } from "../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import type { Assessment } from "../../domain/settings/assessment.ts";
import type { SelectionReading } from "../../domain/settings/selection/selection.ts";

export type AdoptionInput = VersionOneCommandPorts &
  RepositoryLocated & {
    readonly gitTree: GitTreePort;
    readonly arguments: RecordDebtArguments;
    readonly exceptionRepository: ExceptionRepository;
  };

type DebtResult = Result<readonly InheritedDebtOutcome[], LoadFailure>;

const ASSESSED_IN_THIS_RUN: Assessment = { forfeiture: "this-run" };

type BaseTree = Pick<InheritedDebtRequest, "inBase" | "basePathOfRenamed">;

const loadFailureOf = (failure: GitFailure): Result<never, LoadFailure> => ({
  outcome: "failed",
  error: { kind: "git-failed", detail: `${failure.command}: ${failure.detail}` },
});

const baseTreeOf = (request: AdoptionInput): Result<BaseTree, LoadFailure> => {
  const {
    repoRoot,
    arguments: { baseRevision },
  } = request;
  const listed = request.gitTree.pathsAt({ repoRoot, revision: baseRevision });
  if (listed.outcome === "failed") {
    return loadFailureOf(listed.error);
  }
  const renamed = request.git.renamedSince({ repoRoot, baseRevision });
  return renamed.outcome === "failed"
    ? loadFailureOf(renamed.error)
    : { outcome: "ok", value: { inBase: new Set(listed.value), basePathOfRenamed: renamed.value } };
};

type DebtRequest = AdoptionInput &
  BaseTree & {
    readonly selection: SelectionReading;
    readonly existing: readonly PlacedEntry[];
  };

const clauseMechanismsOf = (request: {
  readonly selection: SelectionReading;
}): ReadonlyMap<string, EngineId> =>
  new Map(
    request.selection.selection.selected.map((clause) => [
      clauseAddressText({ address: clause.address }),
      clause.mechanism,
    ]),
  );

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
      basePathOfRenamed: request.basePathOfRenamed,
      refusing: request.selection.selection.selected.flatMap((clause) =>
        clause.exceptions === "refused" ? [clause.address] : [],
      ),
    }),
    unprojected: reached.value.unprojected,
    mechanisms: clauseMechanismsOf(request),
  });
  const written = request.exceptionRepository.add({
    entries: inheritedDebtEntriesOf({ outcomes }),
  });
  return written.outcome === "failed" ? written : { outcome: "ok", value: outcomes };
};

export const adoptionDebt = (request: AdoptionInput): Promise<DebtResult> => {
  const { repoRoot, installRoot, fileText, path } = request;
  const selection = request
    .selectionRepositoryOf({
      repoRoot,
      installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
      fileText,
      path,
    })
    .read({});
  if (selection.outcome === "failed") {
    return Promise.resolve(selection);
  }
  const existing = request.exceptionRepository.read();
  if (existing.outcome === "failed") {
    return Promise.resolve(existing);
  }
  const baseTree = baseTreeOf(request);
  if (baseTree.outcome === "failed") {
    return Promise.resolve(baseTree);
  }
  return debtOutcomesOf({
    ...request,
    ...baseTree.value,
    selection: selection.value,
    existing: existing.value,
  });
};
