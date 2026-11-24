import { describe, expect, it, vi } from "vitest";

import { createReplyPort, type ReplySurface } from "./reply-port.ts";

describe("createReplyPort", () => {
  it("writes the reply to the reply pipe, descriptor 3", () => {
    const writeDescriptor = vi.fn<ReplySurface["writeDescriptor"]>();

    const replyPort = createReplyPort({ replySurface: { writeDescriptor } });

    replyPort.write({ text: '{"outcome":"measured"}' });

    expect(writeDescriptor.mock.calls).toEqual([
      [{ descriptor: 3, text: '{"outcome":"measured"}' }],
    ]);
  });
});
