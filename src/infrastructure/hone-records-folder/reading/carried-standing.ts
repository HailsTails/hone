import type {
  CarriedStanding,
  RecordRefusal,
  RecordsAtBase,
} from "../../../domain/records/hone-records/hone-record.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { sameJsonValue } from "../../../domain/settings/json-values/json-kind.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import { recordsDocumentSchema } from "../records-wire.ts";

const entriesAtBaseOf = (request: {
  readonly base: Extract<RecordsAtBase, { readonly measured: "yes" }>;
  readonly file: RepoPath;
}): readonly ReadonlyJsonValue[] =>
  request.base.documents
    .filter((document) => document.file === request.file)
    .flatMap((document) => {
      const parsed = recordsDocumentSchema.safeParse(document.document);
      return parsed.success ? parsed.data.records : [];
    });

export const carriedStandingOf = (request: {
  readonly base: RecordsAtBase;
  readonly file: RepoPath;
  readonly entry: ReadonlyJsonValue;
}): Result<CarriedStanding, readonly RecordRefusal[]> => {
  if (request.base.measured === "no") {
    return { outcome: "ok", value: "unjudged" };
  }
  return entriesAtBaseOf({ base: request.base, file: request.file }).some(
    (atBase) => sameJsonValue({ left: request.entry, right: atBase }) === "same",
  )
    ? { outcome: "ok", value: "established" }
    : { outcome: "failed", error: [{ kind: "carried-changed-since-base" }] };
};
