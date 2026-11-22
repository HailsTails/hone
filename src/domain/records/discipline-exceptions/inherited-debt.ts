import type { AttributedNativeException, Finding } from "../../finding/governance.ts";
import { basePathOf } from "../../repository/renamed-path.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../rule-set/clause-address.ts";
import type { EngineId } from "../../rule-set/identifier-types.ts";
import type { UnprojectedFolder } from "../../runner/unprojected-folder.ts";
import { type DebtPair, debtPairKey, distinctDebtPairs, entryPairKey } from "./debt-pair.ts";
import type { PlacedEntry } from "./exception-entry.ts";
import type { FileCarveOutEntry } from "./exception-record.ts";

export type InheritedDebtOutcome =
  | (DebtPair & { readonly effect: "recorded" | "new-file" | "refused" })
  | (DebtPair & { readonly effect: "already-recorded"; readonly heldIn: RepoPath })
  | (DebtPair & { readonly effect: "left"; readonly under: RepoPath })
  | (DebtPair & {
      readonly effect: "nested-configuration";
      readonly under: RepoPath;
      readonly selectionFolder: RepoPath;
      readonly mechanism: EngineId;
    });

export type InheritedDebtRequest = {
  readonly findings: readonly Finding[];
  readonly unrecorded: readonly AttributedNativeException[];
  readonly existing: readonly PlacedEntry[];
  readonly leave: readonly RepoPath[];
  readonly inBase: ReadonlySet<RepoPath>;
  readonly basePathOfRenamed: ReadonlyMap<RepoPath, RepoPath>;
  readonly refusing: readonly ClauseAddress[];
};

const inlinePairs = (request: {
  readonly unrecorded: readonly AttributedNativeException[];
}): readonly DebtPair[] =>
  request.unrecorded.flatMap((exception) =>
    exception.kind === "inline-disable" ? [{ clause: exception.clause, file: exception.file }] : [],
  );

const recordedPairFiles = (request: {
  readonly existing: readonly PlacedEntry[];
}): ReadonlyMap<string, RepoPath> =>
  new Map(
    request.existing
      .flatMap(({ entry, place }): readonly (readonly [string, RepoPath])[] => {
        const key = entryPairKey({ entry });
        return key === undefined ? [] : [[key, place.file]];
      })
      .toReversed(),
  );

const leavingPath = (request: {
  readonly file: RepoPath;
  readonly leave: readonly RepoPath[];
}): RepoPath | undefined =>
  request.leave.find((path) => request.file === path || request.file.startsWith(`${path}/`));

const outcomeOf = (request: {
  readonly pair: DebtPair;
  readonly debt: InheritedDebtRequest;
  readonly recorded: ReadonlyMap<string, RepoPath>;
  readonly refusing: ReadonlySet<string>;
}): InheritedDebtOutcome => {
  const { pair, debt } = request;
  if (request.refusing.has(clauseAddressText({ address: pair.clause }))) {
    return { ...pair, effect: "refused" };
  }
  const heldIn = request.recorded.get(debtPairKey(pair));
  if (heldIn !== undefined) {
    return { ...pair, effect: "already-recorded", heldIn };
  }
  const under = leavingPath({ file: pair.file, leave: debt.leave });
  if (under !== undefined) {
    return { ...pair, effect: "left", under };
  }
  return {
    ...pair,
    effect: debt.inBase.has(
      basePathOf({ file: pair.file, basePathOfRenamed: debt.basePathOfRenamed }),
    )
      ? "recorded"
      : "new-file",
  };
};

export const inheritedDebtOf = (request: InheritedDebtRequest): readonly InheritedDebtOutcome[] => {
  const recorded = recordedPairFiles(request);
  const refusing = new Set(request.refusing.map((address) => clauseAddressText({ address })));
  const findingPairs = request.findings.map((finding) => ({
    clause: finding.clause,
    file: finding.file,
  }));
  return distinctDebtPairs({ pairs: [...findingPairs, ...inlinePairs(request)] }).map((pair) =>
    outcomeOf({ pair, debt: request, recorded, refusing }),
  );
};

export const inheritedDebtEntriesOf = (request: {
  readonly outcomes: readonly InheritedDebtOutcome[];
}): readonly FileCarveOutEntry[] =>
  request.outcomes.flatMap((outcome) =>
    outcome.effect === "recorded"
      ? [
          {
            kind: "file-carve-out",
            clause: clauseAddressText({ address: outcome.clause }),
            file: outcome.file,
          },
        ]
      : [],
  );

const reachedOutcomeOf = (request: {
  readonly outcome: InheritedDebtOutcome;
  readonly unprojected: readonly UnprojectedFolder[];
  readonly mechanisms: ReadonlyMap<string, EngineId>;
}): InheritedDebtOutcome => {
  const { outcome } = request;
  if (outcome.effect !== "recorded") {
    return outcome;
  }
  const mechanism = request.mechanisms.get(clauseAddressText({ address: outcome.clause }));
  const unprojected = request.unprojected.find(
    (candidate) =>
      candidate.mechanism === mechanism && outcome.file.startsWith(`${candidate.folder}/`),
  );
  return unprojected === undefined
    ? outcome
    : {
        clause: outcome.clause,
        file: outcome.file,
        effect: "nested-configuration",
        under: unprojected.folder,
        selectionFolder: unprojected.selectionFolder,
        mechanism: unprojected.mechanism,
      };
};

export const reachedDebtOf = (request: {
  readonly outcomes: readonly InheritedDebtOutcome[];
  readonly unprojected: readonly UnprojectedFolder[];
  readonly mechanisms: ReadonlyMap<string, EngineId>;
}): readonly InheritedDebtOutcome[] =>
  request.outcomes.map((outcome) => reachedOutcomeOf({ ...request, outcome }));
