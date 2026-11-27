import { readHoneRules } from "../../runner/pieces/hone-rules.ts";
import {
  defaultNativeRuleSources,
  type NativeRuleSources,
  typescriptEslintRules,
} from "../../runner/pieces/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "hone-cd1", version: "0.0.0-local" },
  rules: {
    ...typescriptEslintRules({ names: ["no-explicit-any"], sources }),
    ...readHoneRules({ names: ["implicit-any-let"] }),
  },
});

export default createPlugin(defaultNativeRuleSources);
