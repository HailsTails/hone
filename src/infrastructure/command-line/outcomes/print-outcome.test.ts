import { describe, expect, it, vi } from "vitest";
import type { ProcessPort } from "../../../application/ports/host/process-port.ts";
import { printOutcome } from "./print-outcome.ts";

const processWith = (): ProcessPort => ({
  arguments: [],
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

describe("printOutcome", () => {
  it("writes the outcome's text to standard out and exits with its code", () => {
    const process = processWith();

    printOutcome({ process, outcome: { code: 1, text: "found 2 things\n" } });

    expect({ out: vi.mocked(process.writeOut).mock.calls, errors: vi.mocked(process.writeError).mock.calls, exits: vi.mocked(process.exitWith).mock.calls }).toEqual({
      out: [[{ text: "found 2 things\n" }]],
      errors: [],
      exits: [[{ code: 1 }]],
    });
  });
});
