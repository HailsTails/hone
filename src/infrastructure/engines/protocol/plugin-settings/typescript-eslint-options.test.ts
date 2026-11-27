import { describe, expect, it } from "vitest";

import { typescriptEslintClassOptions } from "./typescript-eslint-options.ts";

describe("typescriptEslintClassOptions", () => {
  it("gives the TypeScript-ESLint vendor rule only the allowed class kinds", () => {
    const options = typescriptEslintClassOptions({
      kind: "static-members-only",
      allowedClassKinds: ["has-decorator"],
    });

    expect(options).toEqual([
      {
        allowConstructorOnly: false,
        allowEmpty: false,
        allowStaticOnly: false,
        allowWithDecorator: true,
      },
    ]);
  });
});
