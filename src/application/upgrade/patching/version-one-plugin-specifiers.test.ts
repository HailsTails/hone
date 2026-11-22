import { describe, expect, it } from "vitest";

import { projectionWithVersionTwoPlugins } from "./version-one-plugin-specifiers.ts";

const PROJECTION_OF_VERSION_ONE_FIVE = `import piece0 from "@hailstails/hone/mechanisms/eslint/CD-1/cd1/cd1.eslint-plugin.js";
import piece1 from "@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";

export default [
  {
    name: "hone/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece1 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone/file-records/CD-14#class-syntax",
    files: ["src/kept.ts"],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

describe("projectionWithVersionTwoPlugins", () => {
  it("rewrites each version 1 plugin specifier to the version 2 module with the same rules and changes nothing else", () => {
    expect(projectionWithVersionTwoPlugins({ text: PROJECTION_OF_VERSION_ONE_FIVE })).toBe(
      PROJECTION_OF_VERSION_ONE_FIVE.replace(
        '"@hailstails/hone/mechanisms/eslint/CD-1/cd1/cd1.eslint-plugin.js"',
        '"@hailstails/hone/src/infrastructure/engines/eslint/untyped-value/explicit-any/eslint-plugin.js"',
      ).replace(
        '"@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js"',
        '"@hailstails/hone/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.js"',
      ),
    );
  });

  it("leaves a projection that imports no version 1 plugin as it is", () => {
    const text = 'import piece0 from "./local-plugin.js";\n';
    expect(projectionWithVersionTwoPlugins({ text })).toBe(text);
  });
});
