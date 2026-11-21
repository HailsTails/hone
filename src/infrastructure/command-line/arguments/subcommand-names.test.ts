import { describe, expect, it } from "vitest";
import { PRUNE_DEBT_SUBCOMMAND, RECORD_DEBT_SUBCOMMAND } from "./subcommand-names.ts";

describe("the debt subcommand names", () => {
  it("are the words the command line takes", () => {
    expect({ record: RECORD_DEBT_SUBCOMMAND, prune: PRUNE_DEBT_SUBCOMMAND }).toEqual({ record: "record-debt", prune: "prune-debt" });
  });
});
