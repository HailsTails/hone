import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { UpgradeCarriedOver } from "../../../application/ports/upgrade/upgrade-mentions.ts";
import type { RecordLine } from "../../../domain/records/upgrade/records-mapping.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { CommandOutcome } from "../../command-line/outcomes/command-outcome.ts";

export const ALREADY_ON_VERSION_TWO: CommandOutcome = {
  code: 0,
  text: "already on version 2; nothing to upgrade\n",
};

const shownOf = (request: {
  readonly path: Pick<PathPort, "relative">;
  readonly repoRoot: AbsolutePath;
  readonly target: AbsolutePath;
}): string => {
  const location = request.path.relative({ from: request.repoRoot, to: request.target });
  return location.relation === "within-root" ? location.path : request.target;
};

const recordLineOf = (request: { readonly record: RecordLine }): string => {
  const { oldKind, oldAddress, file, newKind, symptom } = request.record;
  return `${oldKind} ${oldAddress} ${file} -> ${newKind} ${symptom}`;
};

const carriedLinesOf = (request: { readonly records: readonly RecordLine[] }): readonly string[] =>
  request.records
    .filter(({ holding }) => holding === "carried")
    .map(({ symptom, file }) => `carried ${symptom} ${file}`);

export const upgradeSuccessOutcomeOf = (request: {
  readonly carried: UpgradeCarriedOver;
  readonly repoRoot: AbsolutePath;
  readonly path: Pick<PathPort, "relative">;
}): CommandOutcome => {
  const { carried, repoRoot, path } = request;
  const removed = [...carried.removed.files, ...carried.removed.folders];
  return {
    code: 0,
    text: [
      "upgraded to version 2",
      ...carried.written.map((file) => `wrote ${file}`),
      ...carried.replaced.map((file) => `rewrote ${file}`),
      ...removed.map((target) => `removed ${shownOf({ path, repoRoot, target })}`),
      ...carried.records.map((record) => recordLineOf({ record })),
      ...carriedLinesOf({ records: carried.records }),
      ...carried.mentions.map(({ file, line }) => `mention ${file}:${line}`),
      `upgrade: same findings (${carried.findings}), same verdict`,
    ]
      .map((line) => `${line}\n`)
      .join(""),
  };
};
