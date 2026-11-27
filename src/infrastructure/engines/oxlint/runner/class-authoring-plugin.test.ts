import { expect, it } from "vitest";

import plugin from "./class-authoring-plugin.ts";

it("registers no-class-authoring as a JavaScript rule", () => {
  expect(plugin.rules["no-class-authoring"]).toMatchObject({ create: expect.any(Function) });
});
