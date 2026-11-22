import type { ExceptionRecord, RecordPlace } from "./exception-record.ts";
import { whyChainFormOf } from "./version-one-why-chain.ts";

export type StructuralExceptionEntry =
  | {
      kind: "authorised-location";
      clause: string;
      file: string;
      reason: string;
      whyChain?: unknown;
      provenance?: unknown;
    }
  | {
      kind: "file-carve-out";
      clause: string;
      file: string;
      reason?: string;
      whyChain?: unknown;
      provenance?: unknown;
    }
  | {
      kind: "clause-wide-carve-out";
      clause: string;
      reason: string;
      whyChain: unknown;
    };

export type PlacedEntry = { readonly place: RecordPlace; readonly entry: StructuralExceptionEntry };

export type ImportEvidence =
  | { readonly imported: "no" }
  | { readonly imported: "yes"; readonly source: string };

export const recordImportOf = (request: { readonly record: ExceptionRecord }): ImportEvidence => {
  const { record } = request;
  if (
    record.kind === "clause-wide-carve-out" ||
    record.whyChain !== undefined ||
    record.provenance === undefined
  ) {
    return { imported: "no" };
  }
  return { imported: "yes", source: record.provenance.source };
};

export const legacyChainsIn = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
}): "present" | "absent" =>
  request.entries.some((entry) => whyChainFormOf({ chain: entry.whyChain }) === "legacy")
    ? "present"
    : "absent";
