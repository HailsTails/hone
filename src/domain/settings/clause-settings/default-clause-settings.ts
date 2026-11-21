import type { ClauseSettingValues } from "../../../application/ports/runner-module-types.ts";
import type { ClauseSettingDeclarations } from "../../../infrastructure/content-files/rule-sets/rule-set-reader.ts";

export const defaultClauseSettings = (request: { readonly declarations: ClauseSettingDeclarations }): ClauseSettingValues =>
  Object.fromEntries(Object.entries(request.declarations).map(([key, declaration]) => [key, declaration.default]));
