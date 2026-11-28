import { describe, expect, it, vi } from "vitest";

import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import { writeSpeedBaselineReport } from "./write-speed-baseline-report.ts";

describe("writeSpeedBaselineReport", () => {
  it("writes the report's output and error, then exits with its code", () => {
    const writeOut = vi.fn<ProcessPort["writeOut"]>();
    const writeError = vi.fn<ProcessPort["writeError"]>();
    const exitWith = vi.fn<ProcessPort["exitWith"]>();

    writeSpeedBaselineReport({
      process: { writeOut, writeError, exitWith },
      outcome: {
        kind: "usage-refused",
        refusal: {
          kind: "usage-refused",
          detail: "Missing --repo",
          usage: "usage: speed-baseline --repo <dir>\n",
        },
      },
    });

    expect({
      out: writeOut.mock.calls,
      error: writeError.mock.calls,
      exit: exitWith.mock.calls,
    }).toEqual({
      out: [[{ text: "" }]],
      error: [[{ text: "Missing --repo\nusage: speed-baseline --repo <dir>\n" }]],
      exit: [[{ code: 2 }]],
    });
  });
});
