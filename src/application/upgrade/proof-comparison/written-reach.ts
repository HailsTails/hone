import { checkAt } from "../../../domain/language-layer/check-address.ts";
import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import { recordedReachOf } from "../../../domain/records/hone-records/recorded-reach.ts";
import type {
  RecordInput,
  WrittenRecord,
} from "../../../domain/records/upgrade/records-mapping.ts";
import { sameClauseAddress } from "../../../domain/rule-set/clause-address.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { ReachBeyondEntries } from "../../ports/upgrade/plan-refusal.ts";

type Reach = "within-an-entry" | "beyond-the-entries";

const checkNamed = (request: {
  readonly address: string;
  readonly catalogues: readonly RuleSetCatalogue[];
}): Check | undefined =>
  request.catalogues
    .map(({ catalogue }) => checkAt({ catalogue, address: request.address }))
    .flatMap((found) => (found.found === "check" ? [found.check] : []))[0];

const reachOf = (request: {
  readonly written: WrittenRecord;
  readonly inputs: readonly RecordInput[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): Reach => {
  const reach = recordedReachOf({ text: request.written.answers });
  if (reach === "not-a-recorded-reach" || reach.reaches !== "one-check") {
    return "beyond-the-entries";
  }
  const clause = checkNamed({
    address: request.written.answers,
    catalogues: request.catalogues,
  })?.clause;
  const held =
    clause !== undefined &&
    request.inputs.some(
      (input) =>
        input.kind !== "clause-wide-carve-out" &&
        input.record.file === request.written.file &&
        sameClauseAddress({ left: input.record.clause, right: clause }) === "same",
    );
  return held ? "within-an-entry" : "beyond-the-entries";
};

export const reachBeyondEntriesOf = (request: {
  readonly written: readonly WrittenRecord[];
  readonly inputs: readonly RecordInput[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly ReachBeyondEntries[] =>
  request.written
    .filter(
      (written) =>
        reachOf({ written, inputs: request.inputs, catalogues: request.catalogues }) ===
        "beyond-the-entries",
    )
    .map(({ answers, file }) => ({ symptom: answers, file }));
