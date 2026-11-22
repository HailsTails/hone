import type { ClauseSettingValues } from "../../runner/runner-module-types.ts";
import type { ReadonlyJsonValue } from "../json-values/json-value.ts";
import { RESERVED_EDITION_SETTING } from "./reserved-edition-setting.ts";

export type EditionPin = {
  readonly pin: ReadonlyJsonValue | undefined;
  readonly rest: ClauseSettingValues | undefined;
};

export const editionPinOf = (request: {
  readonly given: ClauseSettingValues | undefined;
}): EditionPin => {
  if (request.given === undefined || !Object.hasOwn(request.given, RESERVED_EDITION_SETTING)) {
    return { pin: undefined, rest: request.given };
  }
  const { [RESERVED_EDITION_SETTING]: pin, ...rest } = request.given;
  return { pin, rest: Object.keys(rest).length === 0 ? undefined : rest };
};
