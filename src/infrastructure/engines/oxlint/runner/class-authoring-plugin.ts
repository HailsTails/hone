import plugin from "../../protocol/plugin-rules/class-authoring.ts";

export default {
  meta: { name: "hone-oxlint-class", version: "0.0.0-local" },
  rules: { "no-class-authoring": plugin.rules["no-class-authoring"] },
};
