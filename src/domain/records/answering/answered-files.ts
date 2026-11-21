import type { AnsweredFile } from "../../runner/checks-run-report.ts";
import type { HoneRecord, PlacedRecord } from "../hone-records/hone-record.ts";

const answeredBy = (request: { readonly record: HoneRecord }): readonly AnsweredFile[] => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return reachedFilesOf({ symptom: record.symptom.name, reach: record.reach, file: record.file });
    case "deviation":
    case "boundary-record":
    case "dependency-record":
      return [];
  }
};

const reachedFilesOf = (request: {
  readonly symptom: string;
  readonly reach: Extract<HoneRecord, { readonly kind: "debt" | "authorised-location" }>["reach"];
  readonly file: AnsweredFile["file"];
}): readonly AnsweredFile[] => {
  const { reach, symptom, file } = request;
  switch (reach.reaches) {
    case "whole-symptom":
      return [{ symptom, file }];
    case "one-check":
      return [{ symptom, check: reach.check.name, file }];
    case "unknown-check":
      return [];
  }
};

export const answeredFilesOf = (request: { readonly records: readonly PlacedRecord[] }): readonly AnsweredFile[] =>
  request.records.flatMap((placed) => answeredBy({ record: placed.record }));
