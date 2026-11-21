import piece0 from "../../../../infrastructure/engines/eslint/CD-1/cd1/cd1.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone-cd1",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd1": piece0 },
    rules: { "hone-cd1/implicit-any-let": "error", "hone-cd1/no-explicit-any": "error" },
  },
  {
    name: "hone-core/file-records/CD-1#explicit-any",
    files: [
      "src/legacy.ts",
    ],
    rules: { "hone-cd1/no-explicit-any": "off" },
  },
];
