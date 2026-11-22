import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { UpgradeCarriedOver } from "../../../application/ports/upgrade/upgrade-carried-over.ts";
import { checkAddressOf } from "../../../domain/language-layer/check-address.ts";
import type { RecordLine } from "../../../domain/records/upgrade/records-mapping.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
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
  const { recordKind, clause, file, newKind, check } = request.record;
  return `${recordKind} ${clauseAddressText({ address: clause })} ${file} -> ${newKind} ${checkAddressOf({ check })}`;
};

const carriedLinesOf = (request: { readonly records: readonly RecordLine[] }): readonly string[] =>
  request.records
    .filter(({ holding }) => holding === "carried")
    .map(({ check, file }) => `carried ${checkAddressOf({ check })} ${file}`);

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
      ...carried.unread.map(({ file, detail }) => `mention-unread ${file} ${detail}`),
      `upgrade: same findings (${carried.findings}), same verdict`,
    ]
      .map((line) => `${line}\n`)
      .join(""),
  };
};
