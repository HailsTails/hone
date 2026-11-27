import { expect, it } from "vitest";

import plugin from "./oxlint-plugin.ts";

it("provides the installed vendor rule to Oxlint under its rule name", () => {
  const rule = plugin.rules["no-extraneous-class"];

  expect(rule).toMatchObject({ create: expect.any(Function) });
});
