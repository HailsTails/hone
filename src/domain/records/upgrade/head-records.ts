import type { ExceptionRecord, InvalidRecord, RecordPlace } from "../discipline-exceptions/exception-record.ts";
import type { CarriedEntry, RecordInput } from "./records-mapping.ts";

type RecordOf<Kind extends ExceptionRecord["kind"]> = Extract<ExceptionRecord, { readonly kind: Kind }>;

export type HeadRecord =
  | Omit<Extract<RecordInput, { readonly kind: "file-carve-out" }>, "answer">
  | { readonly kind: "authorised-location"; readonly record: RecordOf<"authorised-location">; readonly entry: CarriedEntry }
  | Extract<RecordInput, { readonly kind: "clause-wide-carve-out" }>;

export type HeadRecordsRefusal =
  | { readonly kind: "invalid-records"; readonly invalid: readonly InvalidRecord[] }
  | { readonly kind: "entry-not-json"; readonly place: RecordPlace };
