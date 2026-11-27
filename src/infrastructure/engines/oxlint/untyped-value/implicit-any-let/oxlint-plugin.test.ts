import { expect, it } from "vitest";

import rules from "../../../protocol/plugin-rules/implicit-any-let.ts";
import plugin from "./oxlint-plugin.ts";

it("exposes the shared rules through the Oxlint piece module", () => {
  expect(plugin).toBe(rules);
});
