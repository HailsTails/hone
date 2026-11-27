import { expect, it } from "vitest";

import sharedPlugin from "../../../protocol/plugin-rules/else-after-an-exit.ts";
import plugin from "./eslint-plugin.ts";

it("keeps the published ESLint plugin entry bound to the shared rules", () => {
  expect(plugin).toBe(sharedPlugin);
});
