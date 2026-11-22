import { describe, expect, it } from "vitest";

import config from "./vitest.config.ts";

describe("@hailstails/hone Vitest configuration", () => {
  it("collects every test file in the repository", () => {
    expect(config.test?.include).toEqual(["**/*.test.ts"]);
  });

  it("names its project after the package", () => {
    expect(config.test?.name).toBe("@hailstails/hone");
  });
});
