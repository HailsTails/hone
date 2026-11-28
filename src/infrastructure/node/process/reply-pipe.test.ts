import { describe, expect, it } from "vitest";

import { openReplyPipe, readReplyPipe } from "./reply-pipe.ts";

describe("readReplyPipe", () => {
  it("reads the reply from descriptor 3 of the process output", () => {
    const reply = readReplyPipe({
      output: [null, "ignored", "warnings", '{"outcome":"measured"}'],
    });

    expect(reply).toBe('{"outcome":"measured"}');
  });

  it("reads nothing when descriptor 3 was not captured", () => {
    const reply = readReplyPipe({ output: [null, "ignored", "warnings", null] });

    expect(reply).toBeUndefined();
  });
});

describe("openReplyPipe", () => {
  it("adds a pipe after the three standard streams", () => {
    const stdio = openReplyPipe({ standardStreams: ["pipe", "inherit", "pipe"] });

    expect(stdio).toEqual(["pipe", "inherit", "pipe", "pipe"]);
  });
});
