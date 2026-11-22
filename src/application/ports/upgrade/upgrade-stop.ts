import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { VersionOneReadFailure } from "../records/version-one-reading.ts";
import type { ProofRefusal } from "./proof-outcome.ts";

export type UpgradeFailure = VersionOneReadFailure | ProofRefusal;

export type UpgradeStop =
  | { readonly stopped: "load-failed"; readonly failure: LoadFailure }
  | { readonly stopped: "refused"; readonly failure: UpgradeFailure };
