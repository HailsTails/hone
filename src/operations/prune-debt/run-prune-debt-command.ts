import { createSelectionRepository, readRunSettings } from "../../infrastructure/disciplines-file/consumer-selection.ts";
import type { RunSettings } from "../../domain/settings/run-settings.ts";
import type { ReportOutput } from "../../domain/settings/report-output.ts";
import type { DebtPair } from "../../domain/records/discipline-exceptions/debt-pair.ts";
import type { ExceptionRepository } from "../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { type Assessment, assessmentInEffect } from "../../domain/settings/assessment.ts";
import { moduleExtensionOf } from "../../infrastructure/node/modules/install-layout.ts";
import type { Result } from "../../domain/result.ts";
import { parsePruneDebtArguments, type PruneDebtArguments } from "../../infrastructure/command-line/arguments/command-arguments.ts";
import { pruneDebtCommandOutcome } from "../../infrastructure/command-line/outcomes/record-command-outcomes.ts";
import { installRootOf } from "../../infrastructure/command-line/installation/install-root.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { repoRootOf } from "../../infrastructure/printed-report/check-locations.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { withShownPaths } from "../check/run-check-command.ts";
import { type ReachedCheck, runReachedCheck } from "../../application/run/check/run-check.ts";

type PruneResult = Result<readonly DebtPair[], LoadFailure>;

export type RunSettingsReader = {
  readonly read: (request: Record<string, never>) => Result<RunSettings<ReportOutput>, LoadFailure>;
};

export type PruneCheck = (request: {
  readonly baseRevision: string | undefined;
  readonly assessment: Assessment;
}) => Promise<Result<Pick<ReachedCheck, "paidDebt">, LoadFailure>>;

export type PruneDebtPorts = {
  readonly runSettings: RunSettingsReader;
  readonly check: PruneCheck;
  readonly exceptionRepository: Pick<ExceptionRepository, "remove">;
};

export const paidDebtRemoved = async (
  request: PruneDebtPorts & { readonly arguments: Pick<PruneDebtArguments, "baseRevision" | "forfeiture"> },
): Promise<PruneResult> => {
  const configured = request.runSettings.read({});
  if (configured.outcome === "failed") {
    return configured;
  }
  const checked = await request.check({
    baseRevision: request.arguments.baseRevision,
    assessment: assessmentInEffect({ requested: { forfeiture: request.arguments.forfeiture }, configured: configured.value.assessment }),
  });
  return checked.outcome === "failed" ? checked : request.exceptionRepository.remove({ pairs: checked.value.paidDebt });
};

const pruneDebtPortsOver = (
  request: VersionOneCommandRequest & { readonly repoRoot: AbsolutePath; readonly installRoot: AbsolutePath },
): PruneDebtPorts => {
  const moduleExtension = moduleExtensionOf({ moduleUrl: request.moduleUrl });
  return {
    runSettings: { read: (_request) => readRunSettings(request) },
    check: ({ baseRevision, assessment }) =>
      runReachedCheck({
        ...request,
        moduleExtension,
        baseRevision,
        assessment,
        selectionRepository: createSelectionRepository({ ...request, moduleExtension }),
        exceptionRepository: request.exceptionRepositoryOf({ repoRoot: request.repoRoot }),
      }),
    exceptionRepository: request.exceptionRepositoryOf({ repoRoot: request.repoRoot }),
  };
};

const pruneDebtResult = async (request: VersionOneCommandRequest): Promise<PruneResult> => {
  const parsed = parsePruneDebtArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  const run: PruneResult =
    installRoot.outcome === "failed"
      ? installRoot
      : await paidDebtRemoved({
          ...pruneDebtPortsOver({ ...request, repoRoot: repoRoot.value, installRoot: installRoot.value }),
          arguments: parsed.value,
        });
  return withShownPaths({ path: request.path, fileText: request.fileText, repoRoot: repoRoot.value, installRoot, run });
};

export const runPruneDebtCommand = (request: VersionOneCommandRequest): Promise<void> =>
  pruneDebtResult(request).then((pruned) => printOutcome({ process: request.process, outcome: pruneDebtCommandOutcome({ result: pruned }) }));
