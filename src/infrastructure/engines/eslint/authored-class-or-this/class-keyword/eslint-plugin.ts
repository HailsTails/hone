import classAuthoring from "../../../protocol/plugin-rules/class-authoring.ts";
import {
  defaultNativeRuleSources,
  type NativeRuleSources,
  typescriptEslintRules,
} from "../../runner/pieces/native-rules.ts";

export type ClassAuthoringPlugin = {
  readonly meta: { readonly name: string; readonly version: string };
  readonly rules: Readonly<Record<string, object>>;
};

export const createPlugin = (sources: NativeRuleSources): ClassAuthoringPlugin => ({
  meta: { name: "hone", version: "0.0.0-local" },
  rules: {
    ...classAuthoring.rules,
    ...typescriptEslintRules({ names: ["no-extraneous-class"], sources }),
  },
});
export const classAuthoringPlugin: ClassAuthoringPlugin = createPlugin(defaultNativeRuleSources);
export default classAuthoringPlugin;
