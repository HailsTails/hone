import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import { debtForfeitureAt } from "./debt-forfeiture.ts";

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const OTHER_FILE = repoPathOf("src/orders/refund-order.ts");

const ORDER_TOUCHED: TouchedSet = { measured: "yes", paths: new Set([ORDER_FILE]) };

describe("whether a run forfeits the debt on a file", () => {
  it("forfeits debt on a file the measured change touched", () => {
    expect(debtForfeitureAt({ touched: ORDER_TOUCHED, file: ORDER_FILE })).toBe("forfeits");
  });

  it("keeps debt on a file the measured change left alone", () => {
    expect(debtForfeitureAt({ touched: ORDER_TOUCHED, file: OTHER_FILE })).toBe("keeps");
  });

  it("keeps debt when the change could not be measured", () => {
    expect(
      debtForfeitureAt({
        touched: { measured: "no", base: { state: "not-given" } },
        file: ORDER_FILE,
      }),
    ).toBe("keeps");
  });

  it("keeps debt when forfeiture is assessed elsewhere", () => {
    expect(debtForfeitureAt({ touched: { measured: "elsewhere" }, file: ORDER_FILE })).toBe(
      "keeps",
    );
  });
});
