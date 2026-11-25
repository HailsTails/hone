import type { Edition } from "../../domain/rule-set/edition-types.ts";
import type { SourceCase } from "../../domain/rule-set/rule-set-types.ts";
import type { CaseUnderTest } from "./conformance-testing-types.ts";

export const createCaseUnderTest = (request: {
  readonly example: SourceCase;
  readonly defaultEdition: Edition;
}): CaseUnderTest => ({
  name: request.example.name,
  file: request.example.fileName,
  source: request.example.source,
  edition: request.example.edition ?? request.defaultEdition,
});
