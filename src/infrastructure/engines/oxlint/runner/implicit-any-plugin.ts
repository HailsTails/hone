import plugin from "../../protocol/plugin-rules/implicit-any-let.ts";

export default {
  meta: { name: "hone-oxlint-implicit-any", version: "0.0.0-local" },
  rules: { "implicit-any-let": plugin.rules["implicit-any-let"] },
};
