import { describe, expect, it } from "vitest";

import { ESLINT_TOOLCHAIN_REQUIREMENTS } from "./eslint-peer-requirements.ts";

describe("ESLint peer requirements", () => {
  it("declares the packages needed to load the shared rules as optional peers", () => {
    expect(ESLINT_TOOLCHAIN_REQUIREMENTS).toMatchObject([
      { packageName: "eslint", peer: "optional" },
      { packageName: "@typescript-eslint/parser", peer: "optional" },
      { packageName: "@typescript-eslint/eslint-plugin", peer: "optional" },
    ]);
  });
});
