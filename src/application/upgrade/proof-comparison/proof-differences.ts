import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import {
  PROOF_SECTIONS,
  type ProofDifference,
  type ProofSection,
} from "../../ports/upgrade/proof-outcome.ts";
import { afterSectionsOf } from "./after-sections.ts";
import { beforeSectionsOf } from "./before-sections.ts";
import { reportWithClausesNotAdopted } from "./clauses-not-adopted.ts";
import { multisetRemainderOf } from "./multiset-difference.ts";
import type { SectionKeys } from "./section-keys.ts";

const differenceIn = (request: {
  readonly section: ProofSection;
  readonly before: SectionKeys;
  readonly after: SectionKeys;
}): readonly ProofDifference[] => {
  const onlyBefore = multisetRemainderOf({
    from: request.before[request.section],
    taking: request.after[request.section],
  });
  const onlyAfter = multisetRemainderOf({
    from: request.after[request.section],
    taking: request.before[request.section],
  });
  return onlyBefore.length === 0 && onlyAfter.length === 0
    ? []
    : [{ section: request.section, onlyBefore, onlyAfter }];
};

export const proofDifferencesOf = (request: {
  readonly before: CheckReport;
  readonly after: RunReport;
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly notAdoptedClauses: readonly ClauseAddress[];
}): readonly ProofDifference[] => {
  const before = beforeSectionsOf({
    report: reportWithClausesNotAdopted({
      report: request.before,
      clauses: request.notAdoptedClauses,
    }),
  });
  const after = afterSectionsOf({ report: request.after, catalogues: request.catalogues });
  return PROOF_SECTIONS.flatMap((section) => differenceIn({ section, before, after }));
};
