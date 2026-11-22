import { defaultInstallProofRequestOf } from "./default-install-proof-request.ts";
import { runInstallProof } from "./run-install-proof.ts";

await runInstallProof(defaultInstallProofRequestOf({ moduleUrl: import.meta.url }));
