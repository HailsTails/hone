import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Why } from "../../domain/records/why-chain.ts";
import type { RecordRefusal } from "../../domain/records/hone-records/hone-record.ts";
import type { RecordsEdit } from "../../domain/records/hone-records/records-edit.ts";

export type AuthoriseRequest = {
  readonly answers: string;
  readonly file: RepoPath;
  readonly case: string;
  readonly owes: string;
  readonly whys: readonly Why[];
  readonly rootCause: string;
  readonly rootEvidence: string;
  readonly readback: string;
  readonly owner: string;
};

export type Authorising =
  | { readonly judged: "accepted"; readonly edit: RecordsEdit }
  | { readonly judged: "already-held"; readonly heldIn: RepoPath }
  | { readonly judged: "refused"; readonly refusals: readonly RecordRefusal[] };
