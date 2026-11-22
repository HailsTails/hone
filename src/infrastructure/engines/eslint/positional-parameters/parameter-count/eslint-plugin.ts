import { defaultNativeRuleSources, type NativeRuleSources, typescriptEslintRules } from "../../runner/pieces/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "hone-cd40", version: "0.0.0-local" },
  rules: typescriptEslintRules({ names: ["max-params"], sources }),
});

export default createPlugin(defaultNativeRuleSources);
