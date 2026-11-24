import { describe, expect, it } from "vitest";

import { createPairOrder } from "./speed-schedule.ts";

describe("createPairOrder", () => {
  it.each([
    { pairIndex: 0, order: ["baseline", "head"] },
    { pairIndex: 1, order: ["head", "baseline"] },
    { pairIndex: 2, order: ["baseline", "head"] },
    { pairIndex: 3, order: ["head", "baseline"] },
  ])("orders pair $pairIndex as $order", ({ pairIndex, order }) => {
    const request = { pairIndex };

    const pairOrder = createPairOrder(request);

    expect(pairOrder).toEqual(order);
  });
});
