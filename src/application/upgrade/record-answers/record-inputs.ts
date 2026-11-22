import type { HeadRecord } from "../../../domain/records/upgrade/head-records.ts";
import type { RecordInput } from "../../../domain/records/upgrade/records-mapping.ts";
import type { Result } from "../../../domain/result.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type {
  CarveOutUnanswered,
  LocationUnanswered,
  Unanswered,
} from "../../ports/upgrade/plan-refusal.ts";
import type { RecordAnswered } from "../../ports/upgrade/record-answer-oracle.ts";

const carveOutInputOf = (request: {
  readonly head: Extract<HeadRecord, { readonly kind: "file-carve-out" }>;
  readonly answered: readonly RecordAnswered[];
}): Result<RecordInput, CarveOutUnanswered> => {
  const { head } = request;
  const [answer] = request.answered.flatMap((each) =>
    each.kind === "file-carve-out" && each.record === head.record ? [each.answer] : [],
  );
  return answer === undefined
    ? {
        outcome: "failed",
        error: {
          kind: "carve-out-unanswered",
          clause: clauseAddressText({ address: head.record.clause }),
          file: head.record.file,
        },
      }
    : { outcome: "ok", value: { ...head, answer } };
};

const locationInputOf = (request: {
  readonly head: Extract<HeadRecord, { readonly kind: "authorised-location" }>;
  readonly answered: readonly RecordAnswered[];
}): Result<RecordInput, LocationUnanswered> => {
  const { head } = request;
  const [answer] = request.answered.flatMap((each) =>
    each.kind === "authorised-location" && each.record === head.record ? [each.answer] : [],
  );
  return answer === undefined
    ? {
        outcome: "failed",
        error: {
          kind: "location-unanswered",
          clause: clauseAddressText({ address: head.record.clause }),
          file: head.record.file,
        },
      }
    : { outcome: "ok", value: { ...head, answer } };
};

const inputOf = (request: {
  readonly head: HeadRecord;
  readonly answered: readonly RecordAnswered[];
}): Result<RecordInput, Unanswered> => {
  const { head, answered } = request;
  switch (head.kind) {
    case "file-carve-out":
      return carveOutInputOf({ head, answered });
    case "authorised-location":
      return locationInputOf({ head, answered });
    case "clause-wide-carve-out":
      return { outcome: "ok", value: head };
  }
};

export const recordInputsOf = (request: {
  readonly heads: readonly HeadRecord[];
  readonly answered: readonly RecordAnswered[];
}): Result<readonly RecordInput[], Unanswered> => {
  const inputs = request.heads.map((head) => inputOf({ head, answered: request.answered }));
  const failed = inputs.find((input) => input.outcome === "failed");
  return (
    failed ?? {
      outcome: "ok",
      value: inputs.flatMap((input) => (input.outcome === "ok" ? [input.value] : [])),
    }
  );
};
