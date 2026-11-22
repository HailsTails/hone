import {
  defaultNativeRuleSources,
  eslintCoreRules,
  type NativeRuleSources,
} from "../../runner/pieces/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "hone-cd44", version: "0.0.0-local" },
  rules: eslintCoreRules({ names: ["no-param-reassign"], sources }),
});

export default createPlugin(defaultNativeRuleSources);
