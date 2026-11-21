import { readSelection } from "../../infrastructure/disciplines-file/consumer-selection.ts";
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
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Assessment } from "../../domain/settings/assessment.ts";
import { clauseAddressText } from "../../domain/rule-set/clause-address.ts";
import type { MechanismId } from "../../domain/rule-set/identifier-types.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { parseRecordDebtArguments } from "../../infrastructure/command-line/arguments/command-arguments.ts";
import type { RecordDebtArguments } from "../../application/ports/command/command-arguments.ts";
import { recordDebtCommandOutcome } from "../../infrastructure/command-line/outcomes/record-command-outcomes.ts";
import { installRootOf } from "../../infrastructure/command-line/installation/install-root.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { repoRootOf } from "../../infrastructure/printed-report/check-locations.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { withShownPaths } from "../check/run-check-command.ts";
import { runReachedCheck } from "../../application/run/check/run-check.ts";

type AdoptionRequest = VersionOneCommandRequest & {
  readonly gitTree: GitTreePort;
  readonly arguments: RecordDebtArguments;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly exceptionRepository: ExceptionRepository;
};

type DebtResult = Result<readonly InheritedDebtOutcome[], LoadFailure>;

const ASSESSED_IN_THIS_RUN: Assessment = { forfeiture: "this-run" };

const pathsInBase = (request: AdoptionRequest): Result<ReadonlySet<RepoPath>, LoadFailure> => {
  const listed = request.gitTree.pathsAt({ repoRoot: request.repoRoot, revision: request.arguments.baseRevision });
  return listed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "git-failed", detail: `${listed.error.command}: ${listed.error.detail}` } }
    : { outcome: "ok", value: new Set(listed.value) };
};

type DebtRequest = AdoptionRequest & {
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

const adoptionDebt = (request: AdoptionRequest): Promise<DebtResult> => {
  const selection = readSelection({ ...request, moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }) });
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

const recordDebtResult = async (request: VersionOneCommandRequest & { readonly gitTree: GitTreePort }): Promise<DebtResult> => {
  const parsed = parseRecordDebtArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  const run: DebtResult =
    installRoot.outcome === "failed"
      ? installRoot
      : await adoptionDebt({
          ...request,
          arguments: parsed.value,
          repoRoot: repoRoot.value,
          installRoot: installRoot.value,
          exceptionRepository: request.exceptionRepositoryOf({ repoRoot: repoRoot.value }),
        });
  return withShownPaths({ path: request.path, fileText: request.fileText, repoRoot: repoRoot.value, installRoot, run });
};

export const recordDebtCommandOf =
  (ports: { readonly gitTree: GitTreePort }): ((request: VersionOneCommandRequest) => Promise<void>) =>
  (request) =>
    recordDebtResult({ ...request, gitTree: ports.gitTree }).then((debt) =>
      printOutcome({ process: request.process, outcome: recordDebtCommandOutcome({ result: debt }) }),
    );
