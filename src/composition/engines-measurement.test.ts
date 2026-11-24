import { describe, expect, it, vi } from "vitest";

import type { ReplyPort } from "../application/ports/host/reply-port.ts";
import { runMeasurementProcess } from "./engines-measurement.ts";

describe("runMeasurementProcess", () => {
  it("measures the repository in this process, replying why an absent one could not load", async () => {
    const reply: ReplyPort = { write: vi.fn<ReplyPort["write"]>() };

    await runMeasurementProcess({
      process: { arguments: [`${import.meta.dirname}/../..`, "/absent-repository"] },
      reply,
      moduleUrl: import.meta.resolve("../hone.ts"),
    });

    expect(vi.mocked(reply.write).mock.calls).toEqual([
      [
        {
          text: '{"outcome":"not-loaded","failure":{"kind":"config-absent","repo":"/absent-repository"}}',
        },
      ],
    ]);
  });
});
