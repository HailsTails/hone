import { readTypescriptEslintRule } from "../../runner/typescript-eslint-rule.ts";

const rule = await readTypescriptEslintRule({ name: "no-extraneous-class" });

export default {
  meta: { name: "hone-static-members-only", version: "0.0.0-local" },
  rules: { "no-extraneous-class": rule },
};
