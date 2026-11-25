import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { UpgradeCarriedOver } from "../../../application/ports/upgrade/upgrade-carried-over.ts";
import { checkAddressOf } from "../../../domain/language-layer/check-address.ts";
import type { RecordLine } from "../../../domain/records/upgrade/records-mapping.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import { RULE_SET_NAMES_SEGMENTS } from "../../../domain/rule-set/version-one-names-location.ts";
import type { CommandOutcome } from "../../command-line/outcomes/command-outcome.ts";
import { debtOutcomeLine, prunedDebtLine } from "../records/record-command-lines.ts";
import { recordSubjectText } from "../records/record-lines.ts";

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

const SEPARATE_WORDS = /\s+/;

const recordLineOf = (request: { readonly record: RecordLine }): string => {
  const { record } = request;
  const clause = clauseAddressText({ address: record.clause });
  if ("reason" in record) {
    return `reason ${clause}: ${record.reason.trim().split(SEPARATE_WORDS).join(" ")}`;
  }
  if (record.newKind === "not-carried") {
    return `${record.recordKind} ${clause} ${record.file} -> nothing it answers; not carried`;
  }
  if ("file" in record) {
    const party = record.outsideParty === undefined ? "" : ` for ${record.outsideParty}`;
    return `${record.recordKind} ${clause} ${record.file} -> ${record.newKind} ${checkAddressOf({ check: record.check })}${party}`;
  }
  return `${record.recordKind} ${clause} -> ${record.newKind} ${checkAddressOf({ check: record.check })}`;
};

const carriedLinesOf = (request: { readonly records: readonly RecordLine[] }): readonly string[] =>
  request.records.flatMap((record) =>
    "holding" in record && record.holding === "carried"
      ? [`carried ${checkAddressOf({ check: record.check })} ${record.file}`]
      : [],
  );

const countWrittenRecords = (request: { readonly records: readonly RecordLine[] }): number =>
  request.records.filter((record) => "holding" in record).length;

const mapSmoothedToLines = (request: {
  readonly carried: UpgradeCarriedOver;
}): readonly string[] => {
  const { records, smoothed } = request.carried;
  const recordedDebt = smoothed.recordedDebt.filter(({ effect }) => effect === "recorded");
  return [
    ...smoothed.removedCarried.map(
      ({ record }) => `removed ${recordSubjectText({ record })}: it answers nothing`,
    ),
    ...recordedDebt.map((outcome) => debtOutcomeLine({ outcome })),
    ...smoothed.prunedDebt.map((pruned) => prunedDebtLine({ pruned })),
    ...smoothed.projected.map((file) => `projected ${file}`),
    `upgrade: records written ${countWrittenRecords({ records })}, carried records removed ${smoothed.removedCarried.length}, debt recorded ${recordedDebt.length}, debt pruned ${smoothed.prunedDebt.length}; version 2's check passes`,
  ];
};

const NAMES_FILE_END = `/${RULE_SET_NAMES_SEGMENTS.join("/")}`;

const createNamesLines = (request: { readonly written: readonly RepoPath[] }): readonly string[] =>
  request.written
    .filter((file) => `/${file}`.endsWith(NAMES_FILE_END))
    .map(
      (file) =>
        `keep ${file} until your main branch is on version 2, then you can delete it: until then the check judges carried records by it`,
    );

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
      ...createNamesLines({ written: carried.written }),
      ...mapSmoothedToLines({ carried }),
    ]
      .map((line) => `${line}\n`)
      .join(""),
  };
};
