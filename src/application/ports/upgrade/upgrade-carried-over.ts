import type { ProofCarriedOver } from "./proof-outcome.ts";
import type { VersionOneMentions } from "./upgrade-mentions.ts";

export type UpgradeCarriedOver = ProofCarriedOver & VersionOneMentions;
