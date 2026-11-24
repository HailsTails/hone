import { z } from "zod";

import type {
  CheckListingKey,
  KeysUnrenamed,
  ListedChecks,
  RenamedCheck,
  SettingsFileFormat,
} from "../../application/ports/settings/settings-file-format.ts";
import type { Result } from "../../domain/result.ts";
import { sameJsonValue } from "../../domain/settings/json-values/json-kind.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";
import { parsedJson } from "../content-files/parsed-json.ts";

type JsonFields = Readonly<Record<string, ReadonlyJsonValue>>;

type Rename = (request: { readonly text: string }) => string;

const fieldsSchema = z.record(z.string(), z.json());

const KEY_MARK = String.raw`\s*:`;

const ESCAPED_PATTERN_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

const malformed = (request: { readonly detail: string }): Result<never, KeysUnrenamed> => ({
  outcome: "failed",
  error: { kind: "malformed", detail: request.detail },
});

const mapFieldsToRenamedChecks = (request: {
  readonly under: CheckListingKey;
  readonly fields: JsonFields;
  readonly rename: Rename;
}): readonly RenamedCheck[] =>
  Object.keys(request.fields).flatMap((from) => {
    const to = request.rename({ text: from });
    return to === from ? [] : [{ under: request.under, from, to }];
  });

const mapSettingsToListedFields = (request: {
  readonly settings: JsonFields;
  readonly under: readonly CheckListingKey[];
}): readonly (readonly [CheckListingKey, JsonFields])[] =>
  request.under.flatMap((key): readonly (readonly [CheckListingKey, JsonFields])[] => {
    const fields = fieldsSchema.safeParse(request.settings[key]);
    return fields.success ? [[key, fields.data]] : [];
  });

const mapFieldsToRenamed = (request: {
  readonly fields: JsonFields;
  readonly rename: Rename;
}): JsonFields =>
  Object.fromEntries(
    Object.entries(request.fields).map(([address, setting]) => [
      request.rename({ text: address }),
      setting,
    ]),
  );

const mapSettingsToRenamed = (request: {
  readonly settings: JsonFields;
  readonly under: readonly CheckListingKey[];
  readonly rename: Rename;
}): JsonFields =>
  Object.fromEntries(
    Object.entries(request.settings).map(([key, setting]) => {
      const fields = fieldsSchema.safeParse(setting);
      return request.under.some((listing) => listing === key) && fields.success
        ? [key, mapFieldsToRenamed({ fields: fields.data, rename: request.rename })]
        : [key, setting];
    }),
  );

const createKeyPattern = (request: { readonly key: string }): RegExp =>
  new RegExp(
    `${JSON.stringify(request.key).replaceAll(ESCAPED_PATTERN_CHARACTERS, String.raw`\$&`)}(?=${KEY_MARK})`,
    "g",
  );

const mapTextToRenamedKeys = (request: {
  readonly text: string;
  readonly renamed: readonly RenamedCheck[];
}): string =>
  request.renamed.reduce(
    (text, { from, to }) => text.replace(createKeyPattern({ key: from }), JSON.stringify(to)),
    request.text,
  );

const mapListedFieldsToChecks = (request: {
  readonly listed: readonly (readonly [CheckListingKey, JsonFields])[];
}): readonly ListedChecks[] =>
  request.listed.map(([under, fields]) => ({ under, checks: Object.keys(fields) }));

export const renameKeys: SettingsFileFormat["renameKeys"] = (request) => {
  const parsed = parsedJson(request);
  if (parsed.outcome === "failed") {
    return malformed({ detail: parsed.error });
  }
  const settings = fieldsSchema.safeParse(parsed.value);
  if (!settings.success) {
    return malformed({ detail: "the settings are not a JSON object" });
  }
  const listed = mapSettingsToListedFields({ settings: settings.data, under: request.under });
  const renamed = listed.flatMap(([under, fields]) =>
    mapFieldsToRenamedChecks({ under, fields, rename: request.rename }),
  );
  const text = mapTextToRenamedKeys({ text: request.text, renamed });
  const reread = parsedJson({ text });
  const rewritten = fieldsSchema.safeParse(reread.outcome === "ok" ? reread.value : undefined);
  const expected = mapSettingsToRenamed({ ...request, settings: settings.data });
  return rewritten.success && sameJsonValue({ left: expected, right: rewritten.data }) === "same"
    ? { outcome: "ok", value: { text, renamed, listed: mapListedFieldsToChecks({ listed }) } }
    : {
        outcome: "failed",
        error: { kind: "renamed-address-outside-listings", listings: request.under },
      };
};
