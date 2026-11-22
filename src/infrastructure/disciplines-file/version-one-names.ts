import { z } from "zod";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { CATALOGUE_NAME } from "../../domain/language-layer/catalogue-name.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import type { Result } from "../../domain/result.ts";
import { readVersionOneJson } from "../content-files/rule-sets/rule-set-reader.ts";
import { type CatalogueFile, sightWireSchema } from "../content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";

export const VERSION_ONE_NAMES_SEGMENTS: readonly string[] = ["src", "infrastructure", "disciplines-file", "version-one-names.json"];

export type VersionOneNames = {
  readonly clauses: CatalogueFile["clauses"];
  readonly clauseOfCheck: ReadonlyMap<string, ClauseAddress>;
};

const checkAddressSchema = z.string().regex(new RegExp(`^${CATALOGUE_NAME}#${CATALOGUE_NAME}$`), { error: "is not a check address of the form <symptom>#<check>" });

const versionOneNamesSchema = z
  .strictObject({
    version: z.literal(1),
    clauses: z.array(z.strictObject({ clause: clauseAddressSchema, sight: sightWireSchema, checks: z.array(checkAddressSchema) })),
  })
  .superRefine((file, context) => {
    const checks = file.clauses.flatMap((entry) => entry.checks);
    [...new Set(checks.filter((check, index) => checks.indexOf(check) !== index))].forEach((check) => {
      context.addIssue({ code: "custom", message: `${check} is named by more than one clause` });
    });
  });

export const NO_VERSION_ONE_NAMES: VersionOneNames = { clauses: [], clauseOfCheck: new Map() };

const namesOf = (file: z.output<typeof versionOneNamesSchema>): VersionOneNames => ({
  clauses: file.clauses.map(({ clause, sight }) => ({ clause, sight })),
  clauseOfCheck: new Map(file.clauses.flatMap(({ clause, checks }) => checks.map((check): readonly [string, ClauseAddress] => [check, clause]))),
});

export const readVersionOneNames = (request: { readonly fileText: FileTextPort; readonly path: string }): Result<VersionOneNames, VersionTwoLoadFailure> => {
  if (request.fileText.exists({ path: request.path }) === "absent") {
    return { outcome: "ok", value: NO_VERSION_ONE_NAMES };
  }
  const document = readVersionOneJson(request);
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = versionOneNamesSchema.safeParse(document.value);
  return parsed.success
    ? { outcome: "ok", value: namesOf(parsed.data) }
    : { outcome: "failed", error: { kind: "file-malformed", path: request.path, detail: z.prettifyError(parsed.error) } };
};
