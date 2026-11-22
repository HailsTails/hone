import type { RunSettings } from "../../domain/settings/run-settings.ts";
import type { ReportOutput } from "../../domain/settings/report-output.ts";
import type { DebtPair } from "../../domain/records/discipline-exceptions/debt-pair.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import { type Assessment, assessmentInEffect } from "../../domain/settings/assessment.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type { Result } from "../../domain/result.ts";
import type { PruneDebtArguments } from "../../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../../application/ports/command/repository-located.ts";
import type { RunSettingsOf } from "../../application/ports/selection/selection-repository.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
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

export type PruneDebtInput = VersionOneCommandPorts &
  RepositoryLocated & {
    readonly arguments: Pick<PruneDebtArguments, "baseRevision" | "forfeiture">;
    readonly runSettingsOf: RunSettingsOf;
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

export const pruneDebtPortsOver = (request: PruneDebtInput): PruneDebtPorts => {
  const { repoRoot, installRoot, fileText, path } = request;
  const moduleExtension = moduleExtensionOf({ moduleUrl: request.moduleUrl });
  return {
    runSettings: { read: (_request) => request.runSettingsOf({ repoRoot }) },
    check: ({ baseRevision, assessment }) =>
      runReachedCheck({
        ...request,
        moduleExtension,
        baseRevision,
        assessment,
        selectionRepository: request.selectionRepositoryOf({ repoRoot, installRoot, moduleExtension, fileText, path }),
        exceptionRepository: request.exceptionRepositoryOf({ repoRoot }),
        shownPathOf: request.shownPathOfRepository({ path, fileText, repoRoot, installRoot }),
      }),
    exceptionRepository: request.exceptionRepositoryOf({ repoRoot }),
  };
};

export const debtPruned = (request: PruneDebtInput): Promise<PruneResult> =>
  paidDebtRemoved({ ...pruneDebtPortsOver(request), arguments: request.arguments });
