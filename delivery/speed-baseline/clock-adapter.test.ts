import { describe, expect, it, onTestFinished, vi } from "vitest";

import { createClockPort } from "./clock-adapter.ts";

describe("createClockPort read", () => {
  it("reads the high-resolution clock in milliseconds", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1234.5);
    onTestFinished(() => {
      now.mockRestore();
    });

    const read = createClockPort().read();

    expect({ read, calls: now.mock.calls }).toEqual({ read: 1234.5, calls: [[]] });
  });
});
