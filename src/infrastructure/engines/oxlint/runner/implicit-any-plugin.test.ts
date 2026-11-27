import { expect, it } from "vitest";

import plugin from "./implicit-any-plugin.ts";

it("registers implicit-any-let as a JavaScript rule", () => {
  expect(plugin.rules["implicit-any-let"]).toMatchObject({ create: expect.any(Function) });
});
