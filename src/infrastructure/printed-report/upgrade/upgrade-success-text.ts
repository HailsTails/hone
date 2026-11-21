import type { CommandOutcome } from "../../command-line/outcomes/command-outcome.ts";
import { listedAddressText } from "../../../domain/settings/listed-address.ts";
import type { PathPort } from "../../node/path-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { ProofCarriedOver } from "../../../application/upgrade/proof/upgrade-proof.ts";
import type { MarkedNotAdopted } from "../../../application/upgrade/mapping/settings-mapping.ts";

export const ALREADY_ON_VERSION_TWO: CommandOutcome = { code: 0, text: "already on version 2; nothing to upgrade\n" };

const MARK_REASONS: Readonly<Record<MarkedNotAdopted["reason"], string>> = {
  "discipline-not-selected": "its discipline was not selected in version 1",
};

const shownOf = (request: { readonly path: Pick<PathPort, "relative">; readonly repoRoot: AbsolutePath; readonly target: AbsolutePath }): string => {
  const location = request.path.relative({ from: request.repoRoot, to: request.target });
  return location.relation === "within-root" ? location.path : request.target;
};

export const upgradeSuccessOutcomeOf = (request: {
  readonly carried: ProofCarriedOver;
  readonly repoRoot: AbsolutePath;
  readonly path: Pick<PathPort, "relative">;
}): CommandOutcome => {
  const { carried, repoRoot, path } = request;
  const removed = [...carried.removed.files, ...carried.removed.folders];
  return {
    code: 0,
    text: [
      "upgraded to version 2",
      ...carried.markedNotAdopted.map(({ check, reason }) => `marked ${listedAddressText({ address: check })} not-adopted: ${MARK_REASONS[reason]}`),
      ...carried.written.map((file) => `wrote ${file}`),
      ...carried.replaced.map((file) => `rewrote ${file}`),
      ...removed.map((target) => `removed ${shownOf({ path, repoRoot, target })}`),
    ]
      .map((line) => `${line}\n`)
      .join(""),
  };
};
