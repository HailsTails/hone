import { z } from "zod";

import type { GitPort } from "../../application/ports/git-port.ts";
import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import type { StructuralExceptionEntry } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import type { BaseSelection } from "../../domain/records/upgrade/base-standing-documents.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { GitFailure } from "../../domain/repository/git-failure.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { Result } from "../../domain/result.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";
import { parsedJson } from "../content-files/parsed-json.ts";
import { selectionFileOf } from "../disciplines-file/selection-file.ts";

export type VersionOneEntry = { readonly [key: string]: ReadonlyJsonValue };

export type BaseEntry = {
  readonly entry: StructuralExceptionEntry;
  readonly carried: VersionOneEntry;
};

export type VersionOneEntries = {
  readonly atBase: (request: {
    readonly revision: string;
  }) => Result<readonly BaseEntry[], GitFailure>;
  readonly selectionAtBase: (request: {
    readonly revision: string;
  }) => Result<BaseSelection, GitFailure>;
};

const SELECTION_FILE = repoPathOf("disciplines.json");

const versionOneEntrySchema = z.record(z.string(), z.json());

const readSelectionText = (request: { readonly text: string }): BaseSelection => {
  const document = parsedJson(request);
  if (document.outcome === "failed") {
    return { presence: "unreadable-in-base" };
  }
  const selection = selectionFileOf({ document: document.value, path: SELECTION_FILE });
  return selection.outcome === "ok"
    ? { presence: "present-in-base", selection: selection.value }
    : { presence: "unreadable-in-base" };
};

const readSelectionAtBase = (request: {
  readonly git: Pick<GitPort, "textInBase">;
  readonly repoRoot: AbsolutePath;
  readonly revision: string;
}): Result<BaseSelection, GitFailure> => {
  const text = request.git.textInBase({
    repoRoot: request.repoRoot,
    baseRevision: request.revision,
    file: SELECTION_FILE,
  });
  if (text.outcome === "failed") {
    return text;
  }
  return text.value.presence === "absent-from-base"
    ? { outcome: "ok", value: text.value }
    : { outcome: "ok", value: readSelectionText({ text: text.value.text }) };
};

export const versionOneEntriesOf = (request: {
  readonly repository: Pick<ExceptionRepository, "readAt">;
  readonly git: Pick<GitPort, "textInBase">;
  readonly repoRoot: AbsolutePath;
}): VersionOneEntries => ({
  atBase: ({ revision }) => {
    const read = request.repository.readAt({ revision });
    return read.outcome === "failed"
      ? read
      : {
          outcome: "ok",
          value: read.value.flatMap((entry) => {
            const carried = versionOneEntrySchema.safeParse(entry);
            return carried.success ? [{ entry, carried: carried.data }] : [];
          }),
        };
  },
  selectionAtBase: ({ revision }) => readSelectionAtBase({ ...request, revision }),
});
