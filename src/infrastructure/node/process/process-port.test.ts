import { describe, expect, it, vi } from "vitest";

import { createProcessPort, type ProcessSurface } from "./process-port.ts";

const processSurfaceOver = (surface: Partial<ProcessSurface>): ProcessSurface => ({
  argv: ["/usr/bin/node", "/install/check.ts", "first", "--second"],
  write: vi.fn(),
  writeError: vi.fn(),
  setExitCode: vi.fn(),
  ...surface,
});

describe("createProcessPort", () => {
  it("reads the arguments after the script path, excluding the runtime binary and the script", () => {
    expect(createProcessPort({ processSurface: processSurfaceOver({}) }).arguments).toEqual([
      "first",
      "--second",
    ]);
  });

  it("writes the given text out", () => {
    const write = vi.fn<ProcessSurface["write"]>();

    createProcessPort({ processSurface: processSurfaceOver({ write }) }).writeOut({
      text: "verdict: pass\n",
    });

    expect(write).toHaveBeenCalledWith({ text: "verdict: pass\n" });
  });

  it("writes the given error text to the error stream, not the output stream", () => {
    const write = vi.fn<ProcessSurface["write"]>();
    const writeError = vi.fn<ProcessSurface["writeError"]>();

    createProcessPort({ processSurface: processSurfaceOver({ write, writeError }) }).writeError({
      text: "usage: check\n",
    });

    expect({ out: write.mock.calls, error: writeError.mock.calls }).toEqual({
      out: [],
      error: [[{ text: "usage: check\n" }]],
    });
  });

  it("sets the exit code given to exitWith", () => {
    const setExitCode = vi.fn<ProcessSurface["setExitCode"]>();

    createProcessPort({ processSurface: processSurfaceOver({ setExitCode }) }).exitWith({
      code: 2,
    });

    expect(setExitCode).toHaveBeenCalledWith({ code: 2 });
  });
});
