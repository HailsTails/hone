import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type { ProofCarriedOver, ProofRefusal } from "../../ports/upgrade/proof-outcome.ts";
import type { UpgradeStop } from "../../ports/upgrade/upgrade-stop.ts";
import {
  type ProofQueries,
  type ProofWrites,
  restoredAfterRefusal,
  rolledBackWrites,
  writtenProofFiles,
} from "../proof-writes/proof-writes.ts";
import { placedFilesOf } from "../proof/upgrade-proof.ts";
import type { TeamLayoutPlan } from "./team-layout-plan.ts";

export type TeamLayoutProofRequest = {
  readonly queries: ProofQueries;
  readonly effects: ProofEffects;
  readonly repoRoot: AbsolutePath;
  readonly plan: TeamLayoutPlan;
  readonly cataloguesAfterWriting: () => Result<readonly RuleSetCatalogue[], LoadFailure>;
  readonly proofOf: (
    catalogues: readonly RuleSetCatalogue[],
  ) => Promise<Result<ProofCarriedOver, ProofRefusal>>;
};

const refused = (failure: ProofRefusal): Result<never, UpgradeStop> => ({
  outcome: "failed",
  error: { stopped: "refused", failure },
});

const writtenLayoutOf = (request: TeamLayoutProofRequest): Result<ProofWrites, ProofRefusal> => {
  const placed = placedFilesOf({
    queries: request.queries,
    repoRoot: request.repoRoot,
    files: request.plan.files,
  });
  if (placed.outcome === "failed") {
    return placed;
  }
  const written = writtenProofFiles({
    queries: request.queries,
    effects: request.effects,
    files: placed.value,
    replacements: [],
  });
  return written.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "write-refused", ...written.error, removedByVersionOne: [] },
      }
    : written;
};

export const provenWithTeamLayout = async (
  request: TeamLayoutProofRequest,
): Promise<Result<ProofCarriedOver, UpgradeStop>> => {
  const writes = writtenLayoutOf(request);
  if (writes.outcome === "failed") {
    return refused(writes.error);
  }
  const catalogues = request.cataloguesAfterWriting();
  if (catalogues.outcome === "failed") {
    return refused({
      kind: "team-layout-unreadable",
      failure: catalogues.error,
      unrestored: rolledBackWrites({ effects: request.effects, writes: writes.value }),
      removedByVersionOne: [],
    });
  }
  const carried = await request.proofOf(catalogues.value);
  return carried.outcome === "failed"
    ? refused(
        restoredAfterRefusal({
          effects: request.effects,
          writes: writes.value,
          refusal: carried.error,
        }),
      )
    : {
        outcome: "ok",
        value: {
          ...carried.value,
          written: [...request.plan.files.map(({ file }) => file), ...carried.value.written],
        },
      };
};
