import { z } from "zod";
import type { GitFailure } from "../git/git-port.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";
import type { Result } from "../../domain/result.ts";
import type { ExceptionRepository } from "./exception-records.ts";

export type VersionOneEntry = { readonly [key: string]: ReadonlyJsonValue };

export type VersionOneEntries = {
  readonly atBase: (request: { readonly revision: string }) => Result<readonly VersionOneEntry[], GitFailure>;
};

const versionOneEntrySchema = z.record(z.string(), z.json());

export const versionOneEntriesOf = (request: { readonly repository: Pick<ExceptionRepository, "readAt"> }): VersionOneEntries => ({
  atBase: ({ revision }) => {
    const read = request.repository.readAt({ revision });
    return read.outcome === "failed"
      ? read
      : {
          outcome: "ok",
          value: read.value.flatMap((entry) => {
            const parsed = versionOneEntrySchema.safeParse(entry);
            return parsed.success ? [parsed.data] : [];
          }),
        };
  },
});
