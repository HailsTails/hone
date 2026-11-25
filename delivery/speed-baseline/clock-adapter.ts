import type { ClockPort } from "./clock-port.ts";

export const createClockPort = (): ClockPort => ({
  read: () => performance.now(),
});
