import { z } from "zod";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { CATALOGUE_NAME } from "../../domain/language-layer/catalogue-name.ts";
import { type AddressedCheck, CHECK_ADDRESS_SEPARATOR } from "../../domain/language-layer/check-address-text.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../domain/rule-set/clause-address.ts";
import type { Result } from "../../domain/result.ts";
import { anchorKindSchema, readVersionOneJson } from "../content-files/rule-sets/rule-set-reader.ts";
import type { AnchorKind } from "../../domain/finding/anchor.ts";
import { type CatalogueFile, recordKindNameSchema, recordKindWireSchema, sightWireSchema } from "../content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";

export const VERSION_ONE_NAMES_SEGMENTS: readonly string[] = ["src", "infrastructure", "disciplines-file", "version-one-names.json"];

const formatOfTodaySchema = recordKindWireSchema.shape.todaysFormat.exclude(["none-yet"]);

export type FormatsOfToday = Readonly<Partial<Record<z.output<typeof recordKindNameSchema>, z.output<typeof formatOfTodaySchema>>>>;

export type NamedClause =
  | { readonly clause: ClauseAddress; readonly kind: "mechanical"; readonly anchor: AnchorKind; readonly checks: readonly AddressedCheck[] }
  | { readonly clause: ClauseAddress; readonly kind: "judgement" };

export type VersionOneNames = {
  readonly clauses: CatalogueFile["clauses"];
  readonly namedClauses: readonly NamedClause[];
  readonly clauseOfCheck: ReadonlyMap<string, ClauseAddress>;
  readonly formatsOfToday: FormatsOfToday;
};

const checkAddressSchema = z.string().regex(new RegExp(`^${CATALOGUE_NAME}#${CATALOGUE_NAME}$`), { error: "is not a check address of the form <symptom>#<check>" });

const versionOneNamesSchema = z
  .strictObject({
    version: z.literal(1),
    clauses: z.array(z.strictObject({ clause: clauseAddressSchema, sight: sightWireSchema, checks: z.array(checkAddressSchema), anchor: anchorKindSchema.optional(), review: z.string().min(1).optional() })),
    recordKinds: z.partialRecord(recordKindNameSchema, formatOfTodaySchema),
  })
  .superRefine((file, context) => {
    const checks = file.clauses.flatMap((entry) => entry.checks);
    [...new Set(checks.filter((check, index) => checks.indexOf(check) !== index))].forEach((check) => {
      context.addIssue({ code: "custom", message: `${check} is named by more than one clause` });
    });
    file.clauses
      .filter((entry) => (entry.anchor === undefined) === entry.checks.length > 0)
      .forEach((entry) => {
        context.addIssue({ code: "custom", message: `${clauseAddressText({ address: entry.clause })} needs an anchor exactly when it names a check` });
      });
  });

export const NO_VERSION_ONE_NAMES: VersionOneNames = { clauses: [], namedClauses: [], clauseOfCheck: new Map(), formatsOfToday: {} };

type NamesEntry = z.output<typeof versionOneNamesSchema>["clauses"][number];

const addressedCheckOf = (address: string): AddressedCheck => {
  const mark = address.indexOf(CHECK_ADDRESS_SEPARATOR);
  return { name: address.slice(mark + 1), symptom: { name: address.slice(0, mark) } };
};

const namedClauseOf = (entry: NamesEntry): NamedClause =>
  entry.anchor === undefined
    ? { clause: entry.clause, kind: "judgement" }
    : { clause: entry.clause, kind: "mechanical", anchor: entry.anchor, checks: entry.checks.map(addressedCheckOf) };

const namesOf = (file: z.output<typeof versionOneNamesSchema>): VersionOneNames => ({
  clauses: file.clauses.map(({ clause, sight }) => ({ clause, sight })),
  namedClauses: file.clauses.map(namedClauseOf),
  clauseOfCheck: new Map(file.clauses.flatMap(({ clause, checks }) => checks.map((check): readonly [string, ClauseAddress] => [check, clause]))),
  formatsOfToday: file.recordKinds,
});

export const versionOneNamesOf = (request: { readonly document: unknown }): Result<VersionOneNames, string> => {
  const parsed = versionOneNamesSchema.safeParse(request.document);
  return parsed.success ? { outcome: "ok", value: namesOf(parsed.data) } : { outcome: "failed", error: z.prettifyError(parsed.error) };
};

export const readVersionOneNames = (request: { readonly fileText: FileTextPort; readonly path: string }): Result<VersionOneNames, VersionTwoLoadFailure> => {
  const document = readVersionOneJson(request);
  if (document.outcome === "failed") {
    return document;
  }
  const names = versionOneNamesOf({ document: document.value });
  return names.outcome === "failed" ? { outcome: "failed", error: { kind: "file-malformed", path: request.path, detail: names.error } } : names;
};
