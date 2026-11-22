import type { FoundTreeRecordsSourceOf } from "../../application/ports/records/records-source-of.ts";
import type { RecordsSource } from "../../application/ports/records/records-source.ts";
import type { FoundTreeExceptions } from "../../application/ports/records/exception-repository.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { baseStandingRecordsSource } from "./base-standing-records-source.ts";
import { versionOneEntriesOf } from "./version-one-entries.ts";

export const foundTreeRecordsSourceOver = (request: {
  readonly source: RecordsSource;
  readonly exceptions: FoundTreeExceptions;
  readonly catalogue: SymptomCatalogue;
}): RecordsSource =>
  baseStandingRecordsSource({
    source: { read: request.source.read, readAt: () => ({ outcome: "ok", value: [] }) },
    entries: versionOneEntriesOf({ repository: request.exceptions }),
    catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: request.catalogue }],
  });

export const foundTreeRecordsSourceOf: FoundTreeRecordsSourceOf = (request) => (folder) =>
  foundTreeRecordsSourceOver({ source: request.recordsSourceOf(folder), exceptions: request.exceptionsOf({ repoRoot: folder.repoRoot }), catalogue: folder.catalogue });
