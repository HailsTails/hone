import classAuthoring from "../../../protocol/plugin-rules/class-authoring.ts";
import implicitAny from "../../../protocol/plugin-rules/implicit-any-let.ts";

const builtInRules = { ...classAuthoring.rules, ...implicitAny.rules };

export const readHoneRules = (request: {
  readonly names: readonly (keyof typeof builtInRules)[];
}): Readonly<Record<string, object>> =>
  Object.fromEntries(request.names.map((name) => [name, builtInRules[name]]));
