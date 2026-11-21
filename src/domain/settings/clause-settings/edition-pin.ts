import type { ClauseSettingValues } from "../../../application/ports/runner-module-types.ts";
import { RESERVED_EDITION_SETTING } from "../../../infrastructure/content-files/rule-sets/rule-set-reader.ts";
import type { ReadonlyJsonValue } from "../json-values/json-value.ts";

export type EditionPin = {
  readonly pin: ReadonlyJsonValue | undefined;
  readonly rest: ClauseSettingValues | undefined;
};

export const editionPinOf = (request: { readonly given: ClauseSettingValues | undefined }): EditionPin => {
  if (request.given === undefined || !Object.hasOwn(request.given, RESERVED_EDITION_SETTING)) {
    return { pin: undefined, rest: request.given };
  }
  const { [RESERVED_EDITION_SETTING]: pin, ...rest } = request.given;
  return { pin, rest: Object.keys(rest).length === 0 ? undefined : rest };
};
