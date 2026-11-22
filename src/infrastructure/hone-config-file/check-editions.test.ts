import { describe, expect, it } from "vitest";

import { checkEditionsSchema } from "./check-editions.ts";

describe("checkEditionsSchema", () => {
  it.each(["pinned", "latest"])("accepts %s", (policy) => {
    expect(checkEditionsSchema.safeParse(policy)).toEqual({ success: true, data: policy });
  });

  it.each(["newest", "2", "", true])("refuses %j", (policy) => {
    expect(checkEditionsSchema.safeParse(policy).success).toBe(false);
  });
});
