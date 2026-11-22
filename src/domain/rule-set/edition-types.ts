import type { Branded } from "../repository/branded.ts";
import type { ClauseAddress } from "./clause-address-types.ts";
import type { EngineId } from "./identifier-types.ts";

export type Edition = Branded<string, "Edition">;

export type ClauseEditions = {
  readonly declared: readonly Edition[];
  readonly default: Edition;
  readonly latest: Edition;
};

export type EditionReach = "reached" | "not-reached";

export type ClauseEditionReading = {
  readonly address: ClauseAddress;
  readonly mechanism: EngineId;
  readonly edition: Edition;
  readonly latest: Edition;
};
