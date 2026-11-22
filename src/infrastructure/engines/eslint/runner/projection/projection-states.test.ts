import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { projectionStateAt } from "./projection-states.ts";

const SLICE = repoPathOf("packages/a/disciplines.eslint.mjs");

describe("projectionStateAt", () => {
  it("gives the state read for the file", () => {
    expect(
      projectionStateAt({
        states: new Map([[SLICE, { presence: "present", text: "export default [];\n" }]]),
        file: SLICE,
      }),
    ).toEqual({
      outcome: "ok",
      value: { presence: "present", text: "export default [];\n" },
    });
  });

  it("fails as tool-failed, naming the file, when its state was not read", () => {
    expect(projectionStateAt({ states: new Map(), file: SLICE })).toEqual({
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: "the projection at packages/a/disciplines.eslint.mjs was not read",
      },
    });
  });
});
