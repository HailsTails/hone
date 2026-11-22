import { describe, expect, it } from "vitest";

import { runFailureOf } from "./run-failure.ts";

const ESLINT = "eslint" as const;

const ESLINT_ENGINE = { name: ESLINT };

describe("runFailureOf", () => {
  it("passes a not-ready-yet failure through", () => {
    expect(
      runFailureOf({
        engines: [],
        source: {
          kind: "not-ready-yet",
          what: { thing: "eslint-config-roots", paths: ["packages/web"] },
        },
      }),
    ).toEqual({
      kind: "not-ready-yet",
      what: { thing: "eslint-config-roots", paths: ["packages/web"] },
    });
  });

  it("names the engine the catalogue gives a mechanism for a runner that failed", () => {
    expect(
      runFailureOf({
        engines: [ESLINT_ENGINE],
        source: {
          kind: "runner-failed",
          mechanism: ESLINT,
          failure: { kind: "tool-failed", detail: "ESLint stopped" },
        },
      }),
    ).toEqual({
      kind: "engine-failed",
      engine: { named: "engine", engine: ESLINT_ENGINE },
      failure: { kind: "tool-failed", detail: "ESLint stopped" },
    });
  });

  it("names the mechanism when the catalogue gives it no engine", () => {
    expect(
      runFailureOf({
        engines: [],
        source: { kind: "runner-invalid", mechanism: ESLINT, detail: "no run" },
      }),
    ).toEqual({
      kind: "engine-invalid",
      engine: { named: "mechanism", mechanism: ESLINT },
      detail: "no run",
    });
  });
});
