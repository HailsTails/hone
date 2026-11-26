import { describe, expect, it } from "vitest";

import { projectionKindSchema } from "./projection-kind.ts";

describe("projectionKindSchema", () => {
  it.each(["mjs", "ts"])("accepts %s", (kind) => {
    expect(projectionKindSchema.safeParse(kind)).toEqual({ success: true, data: kind });
  });

  it.each(["d.mts", "js", "", true])("refuses %j", (kind) => {
    expect(projectionKindSchema.safeParse(kind).success).toBe(false);
  });
});
