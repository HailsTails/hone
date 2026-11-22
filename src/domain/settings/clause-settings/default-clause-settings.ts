import type { ClauseSettingDeclarations } from "../../rule-set/rule-set-types.ts";
import type { ClauseSettingValues } from "../../runner/runner-module-types.ts";

export const defaultClauseSettings = (request: {
  readonly declarations: ClauseSettingDeclarations;
}): ClauseSettingValues =>
  Object.fromEntries(
    Object.entries(request.declarations).map(([key, declaration]) => [key, declaration.default]),
  );
