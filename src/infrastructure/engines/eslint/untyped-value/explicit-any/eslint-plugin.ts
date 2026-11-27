import implicitAny from "../../../protocol/plugin-rules/implicit-any-let.ts";
import {
  defaultNativeRuleSources,
  type NativeRuleSources,
  typescriptEslintRules,
} from "../../runner/pieces/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "hone-cd1", version: "0.0.0-local" },
  rules: {
    ...typescriptEslintRules({ names: ["no-explicit-any"], sources }),
    ...implicitAny.rules,
  },
});

export default createPlugin(defaultNativeRuleSources);
