import piece0 from "../../../authored-class-or-this/class-keyword/eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/owned.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
