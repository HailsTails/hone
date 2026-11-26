import { describe, expect, it } from "vitest";

import { listOtherProjectionKinds, type ProjectionKind } from "./settings-file-format.ts";

describe("listOtherProjectionKinds", () => {
  it.each<{ readonly selected: ProjectionKind; readonly other: readonly ProjectionKind[] }>([
    { selected: "mjs", other: ["ts"] },
    { selected: "ts", other: ["mjs"] },
  ])("lists the alternatives to $selected", ({ selected, other }) => {
    expect(listOtherProjectionKinds(selected)).toEqual(other);
  });
});
