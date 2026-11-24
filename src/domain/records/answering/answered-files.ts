import type { AnsweredFile } from "../../runner/checks-run-report.ts";
import type { HoneRecord, PlacedRecord, RecordReach } from "../hone-records/hone-record.ts";

const answeredBy = (request: { readonly record: HoneRecord }): readonly AnsweredFile[] => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
      return reachedFilesOf({
        ruleSet: record.symptom.ruleSet,
        symptom: record.symptom.name,
        reach: record.reach,
        file: record.file,
      });
    case "authorised-location":
      return record.holding.binding.binds === "check-and-file"
        ? reachedFilesOf({
            ruleSet: record.symptom.ruleSet,
            symptom: record.symptom.name,
            reach: record.reach,
            file: record.file,
          })
        : [];
    case "deviation":
    case "dependency-record":
      return [];
  }
};

const reachedFilesOf = (request: {
  readonly ruleSet: AnsweredFile["ruleSet"];
  readonly symptom: string;
  readonly reach: RecordReach;
  readonly file: AnsweredFile["file"];
}): readonly AnsweredFile[] => {
  const { ruleSet, reach, symptom, file } = request;
  switch (reach.reaches) {
    case "whole-symptom":
      return [{ ruleSet, symptom, file }];
    case "one-check":
      return [{ ruleSet, symptom, check: reach.check.name, file }];
    case "unknown-check":
      return [];
  }
};

export const answeredFilesOf = (request: {
  readonly records: readonly PlacedRecord[];
}): readonly AnsweredFile[] =>
  request.records.flatMap((placed) => answeredBy({ record: placed.record }));
