import piece0 from "./tools/disciplines/acme/mechanisms/eslint/ACME-1/acme.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/acme",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "acme": piece0 },
    rules: { "acme/no-console-calls": "error" },
  },
];
