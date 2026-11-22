import {
  defaultNativeRuleSources,
  eslintCoreRules,
  type NativeRuleSources,
} from "../../runner/pieces/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "hone-cd2", version: "0.0.0-local" },
  rules: eslintCoreRules({ names: ["no-restricted-syntax"], sources }),
});

export default createPlugin(defaultNativeRuleSources);
