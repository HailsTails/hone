import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { RenamedCheck } from "../../../application/ports/settings/settings-file-format.ts";
import type { CurrentNamesUpgrade } from "../../../application/ports/upgrade/current-names-upgrade.ts";
import type {
  ProofWriteFailure,
  Unrestored,
} from "../../../application/ports/upgrade/proof-outcome.ts";
import type { UpgradeCarriedOver } from "../../../application/ports/upgrade/upgrade-carried-over.ts";
import { checkAddressOf } from "../../../domain/language-layer/check-address.ts";
import type { RecordLine } from "../../../domain/records/upgrade/records-mapping.ts";
import type { RenamedRecordsFile } from "../../../domain/records/upgrade/records-refiling.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import { SETTINGS_FILE_NAME } from "../../../domain/settings/settings-file.ts";
import type { CommandOutcome } from "../../command-line/outcomes/command-outcome.ts";
import { debtOutcomeLine, prunedDebtLine } from "../records/record-command-lines.ts";
import { recordSubjectText } from "../records/record-lines.ts";

const ALREADY_ON_VERSION_TWO: CommandOutcome = {
  code: 0,
  text: "already on version 2; nothing to upgrade\n",
};

const mapCountToRecordsText = (request: { readonly count: number }): string =>
  request.count === 1 ? "1 record" : `${request.count} records`;

const mapRenamedFileToLine = (request: { readonly renamed: RenamedRecordsFile }): string => {
  const { from, to, records } = request.renamed;
  return from === to
    ? `renamed the records in ${to} to the current names`
    : `renamed ${from} -> ${to} (${mapCountToRecordsText({ count: records })})`;
};

const mapRenamedCheckToLine = (request: { readonly renamed: RenamedCheck }): string =>
  `renamed ${SETTINGS_FILE_NAME} ${request.renamed.under} ${request.renamed.from} -> ${request.renamed.to}`;

const UNWRITTEN_CODE = 2;

type Shown = {
  readonly path: Pick<PathPort, "relative">;
  readonly repoRoot: AbsolutePath;
};

const shownOf = (request: Shown & { readonly target: AbsolutePath }): string => {
  const location = request.path.relative({ from: request.repoRoot, to: request.target });
  return location.relation === "within-root" ? location.path : request.target;
};

const mapFailureToLine = (request: Shown & { readonly failure: ProofWriteFailure }): string => {
  const { failure } = request;
  const shown = shownOf({ ...request, target: failure.path });
  switch (failure.kind) {
    case "path-already-exists":
      return `could not write ${shown}: it already exists`;
    case "replaced-file-unreadable":
    case "removed-file-unreadable":
      return `could not read ${shown}: ${failure.detail}`;
    case "directory-uncreatable":
      return `could not create ${shown}: ${failure.detail}`;
    case "unwritable":
      return `could not write ${shown}: ${failure.detail}`;
    case "unremovable":
      return `could not remove ${shown}: ${failure.detail}`;
  }
};

const mapUnrestoredToLine = (request: Shown & { readonly unrestored: Unrestored }): string =>
  `  ${shownOf({ ...request, target: request.unrestored.path })} (${request.unrestored.detail})`;

const mapRenamedToOutcome = (
  request: Extract<CurrentNamesUpgrade, { readonly outcome: "renamed" }>,
): CommandOutcome => {
  const lines = [
    ...request.checks.map((renamed) => mapRenamedCheckToLine({ renamed })),
    ...request.records.map((renamed) => mapRenamedFileToLine({ renamed })),
  ];
  return lines.length === 0
    ? ALREADY_ON_VERSION_TWO
    : {
        code: 0,
        text: lines.map((line) => `${line}\n`).join(""),
      };
};

export const mapCurrentNamesUpgradeToOutcome = (
  request: Shown & { readonly upgrade: CurrentNamesUpgrade },
): CommandOutcome => {
  const { upgrade } = request;
  switch (upgrade.outcome) {
    case "renamed":
      return mapRenamedToOutcome(upgrade);
    case "unwritten":
      return {
        code: UNWRITTEN_CODE,
        text: `${mapFailureToLine({ ...request, failure: upgrade.failure })}; nothing was changed\n`,
      };
    case "unrestored":
      return {
        code: UNWRITTEN_CODE,
        text: [
          `${mapFailureToLine({ ...request, failure: upgrade.failure })}, and these files could not be put back:`,
          ...upgrade.unrestored.map((unrestored) =>
            mapUnrestoredToLine({ ...request, unrestored }),
          ),
          "a second hone upgrade finishes the move",
        ]
          .map((line) => `${line}\n`)
          .join(""),
      };
  }
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
      ...mapSmoothedToLines({ carried }),
    ]
      .map((line) => `${line}\n`)
      .join(""),
  };
};
