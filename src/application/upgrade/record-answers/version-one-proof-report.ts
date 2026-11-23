import type {
  ExceptionReading,
  ExceptionRecord,
} from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { applyGovernance } from "../../../domain/records/discipline-exceptions/governance.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { TouchedSet } from "../../../domain/repository/touched-set.ts";
import type { Result } from "../../../domain/result.ts";
import type { SelectionReading } from "../../../domain/settings/selection/selection.ts";
import type { EnginePass, EnginePassFailure } from "../../ports/upgrade/engine-pass.ts";

type ProofInput = {
  readonly selection: SelectionReading;
  readonly exceptions: ExceptionReading;
  readonly touched: TouchedSet;
  readonly assessment: CheckReport["assessment"];
  readonly unmeasured: CheckReport["unmeasured"];
};

const failed = (failure: EnginePassFailure): Result<never, LoadFailure> => ({
  outcome: "failed",
  error: {
    kind: "file-malformed",
    path: "disciplines.json",
    detail:
      failure.kind === "version-one-run-failed"
        ? failure.detail
        : `${failure.file} is ${failure.state}`,
  },
});

export const versionOneProofReportOf = async (
  request: ProofInput & {
    readonly pass: EnginePass;
  },
): Promise<Result<CheckReport, LoadFailure>> => {
  const records: readonly ExceptionRecord[] = request.exceptions.records;
  const engine = await request.pass.findingsFor({ records });
  if (engine.outcome === "failed") return failed(engine.error);
  const governed = applyGovernance({ ...engine.value, records, touched: request.touched });
  return {
    outcome: "ok",
    value: {
      ...governed,
      excluded: request.selection.excluded,
      notAdopted: request.selection.selection.notAdopted,
      notRun: request.selection.selection.notRun,
      editions: request.selection.selection.editions,
      uncovered: request.selection.selection.uncovered,
      invalidRecords: request.exceptions.invalid,
      unmeasured: request.unmeasured,
      projectionProblems: [],
      assessment: request.assessment,
    },
  };
};
