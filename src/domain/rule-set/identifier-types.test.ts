import { expect, it } from "vitest";

import { ENGINE_IDS } from "./identifier-types.ts";

it("lists the identities that can be declared for an engine binding", () => {
  expect(ENGINE_IDS).toEqual(["walker", "eslint", "oxlint"]);
});
