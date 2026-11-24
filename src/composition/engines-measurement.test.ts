import { describe, expect, it, vi } from "vitest";

import type { ProcessPort } from "../application/ports/host/process-port.ts";
import { measureEnginesFromArguments } from "./engines-measurement.ts";

describe("measureEnginesFromArguments", () => {
  it("measures the repository in this process, writing why an absent one could not load", async () => {
    const process: ProcessPort = {
      arguments: [`${import.meta.dirname}/../..`, "/absent-repository"],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };

    await measureEnginesFromArguments({ process, moduleUrl: import.meta.resolve("../hone.ts") });

    expect({
      written: vi.mocked(process.writeOut).mock.calls,
      errors: vi.mocked(process.writeError).mock.calls,
      exits: vi.mocked(process.exitWith).mock.calls,
    }).toEqual({
      written: [
        [
          {
            text: '{"outcome":"not-loaded","failure":{"kind":"config-absent","repo":"/absent-repository"}}',
          },
        ],
      ],
      errors: [],
      exits: [],
    });
  });
});
