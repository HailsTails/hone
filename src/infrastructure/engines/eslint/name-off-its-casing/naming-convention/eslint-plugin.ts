import {
  defaultNativeRuleSources,
  type NativeRuleSources,
  typescriptEslintRules,
} from "../../runner/pieces/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "hone-cd6", version: "0.0.0-local" },
  rules: typescriptEslintRules({ names: ["naming-convention"], sources }),
});

export default createPlugin(defaultNativeRuleSources);
