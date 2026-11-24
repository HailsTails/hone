import type { HoneRecordsFailure } from "../../../domain/records/hone-records-failure.ts";
import type { RecordsDocument } from "../../../domain/records/hone-records/hone-record.ts";
import {
  type RecordsEdit,
  recordsTextOf,
} from "../../../domain/records/hone-records/records-edit.ts";
import { mapListedAddressToCurrent } from "../../../domain/records/upgrade/former-names.ts";
import { mapHeldRecordsToCurrentNames } from "../../../domain/records/upgrade/records-refiling.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { SettingsRenameRefusal } from "../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { absoluteWithin } from "../../../domain/repository/absolute-within.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { RecordsReader } from "../../ports/records/records-reader.ts";
import type { RecordsSource } from "../../ports/records/records-source.ts";
import type {
  CheckListingKey,
  KeysRenamed,
  KeysUnrenamed,
  RenamedCheck,
  SettingsFileFormat,
} from "../../ports/settings/settings-file-format.ts";
import type { CurrentNamesUpgrade } from "../../ports/upgrade/current-names-upgrade.ts";
import type { ProofEffect, ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import { proofWritesAppliedOf, rolledBackWrites } from "../proof-writes/proof-writes.ts";

export type CurrentNamesUpgradePorts = {
  readonly source: Pick<RecordsSource, "read">;
  readonly recordsReader: Pick<RecordsReader, "readEntries">;
  readonly fileText: Pick<FileTextPort, "read">;
  readonly repoRoot: AbsolutePath;
  readonly settingsPath: AbsolutePath;
  readonly settingsFormat: Pick<SettingsFileFormat, "renameKeys">;
  readonly effects: ProofEffects;
};

export type CurrentNamesUpgradeFailure =
  | HoneRecordsFailure
  | Extract<LoadFailure, { readonly kind: "file-unreadable" | "file-malformed" }>
  | SettingsRenameRefusal;

type RecordsFileFound = { readonly path: AbsolutePath; readonly original: string };

type Renamed = Extract<CurrentNamesUpgrade, { readonly outcome: "renamed" }>;

type SettingsRenamed = { readonly original: string; readonly renamed: KeysRenamed };

const CHECK_LISTINGS: readonly CheckListingKey[] = ["checks", "checkSettings"];

const readRecordsFile = (request: {
  readonly ports: CurrentNamesUpgradePorts;
  readonly file: RepoPath;
}): Result<RecordsFileFound, CurrentNamesUpgradeFailure> => {
  const { ports, file } = request;
  const path = absoluteWithin({ root: ports.repoRoot, file });
  const original = ports.fileText.read({ path });
  return original.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "records-folder",
          failure: { kind: "records-file-unreadable", file, detail: original.error.detail },
        },
      }
    : { outcome: "ok", value: { path, original: original.value } };
};

const readWriteEffect = (request: {
  readonly ports: CurrentNamesUpgradePorts;
  readonly held: ReadonlySet<RepoPath>;
  readonly document: RecordsDocument;
}): Result<ProofEffect, CurrentNamesUpgradeFailure> => {
  const { ports, held, document } = request;
  const text = recordsTextOf({ document: document.document });
  if (!held.has(document.file)) {
    const path = absoluteWithin({ root: ports.repoRoot, file: document.file });
    return { outcome: "ok", value: { kind: "create-file", path, text } };
  }
  const found = readRecordsFile({ ports, file: document.file });
  return found.outcome === "failed"
    ? found
    : { outcome: "ok", value: { kind: "replace-file", text, ...found.value } };
};

const readRemovalEffect = (request: {
  readonly ports: CurrentNamesUpgradePorts;
  readonly file: RepoPath;
}): Result<ProofEffect, CurrentNamesUpgradeFailure> => {
  const found = readRecordsFile(request);
  return found.outcome === "failed"
    ? found
    : { outcome: "ok", value: { kind: "remove-restorable-file", ...found.value } };
};

const readEditEffects = (request: {
  readonly ports: CurrentNamesUpgradePorts;
  readonly documents: readonly RecordsDocument[];
  readonly edit: RecordsEdit;
}): Result<readonly ProofEffect[], CurrentNamesUpgradeFailure> => {
  const { ports } = request;
  const held = new Set(request.documents.map(({ file }) => file));
  const writes = everyOk({
    entries: request.edit.write,
    resolve: (document) => readWriteEffect({ ports, held, document }),
  });
  if (writes.outcome === "failed") {
    return writes;
  }
  const removals = everyOk({
    entries: request.edit.remove,
    resolve: (file) => readRemovalEffect({ ports, file }),
  });
  return removals.outcome === "failed"
    ? removals
    : { outcome: "ok", value: [...writes.value, ...removals.value] };
};

const mapSettingsToEffects = (request: {
  readonly path: AbsolutePath;
  readonly original: string;
  readonly text: string;
}): readonly ProofEffect[] =>
  request.text === request.original ? [] : [{ kind: "replace-file", ...request }];

const applyEffects = (request: {
  readonly effects: ProofEffects;
  readonly planned: readonly ProofEffect[];
  readonly renamed: Renamed;
}): CurrentNamesUpgrade => {
  const applied = proofWritesAppliedOf({
    applied: request.effects.apply({ effects: request.planned }),
  });
  if (applied.outcome === "written") {
    return request.renamed;
  }
  const unrestored = rolledBackWrites({ effects: request.effects, writes: applied.attempted });
  return unrestored.length === 0
    ? { outcome: "unwritten", failure: applied.failure }
    : { outcome: "unrestored", failure: applied.failure, unrestored };
};

const mapUnrenamedToFailure = (request: {
  readonly path: AbsolutePath;
  readonly unrenamed: KeysUnrenamed;
}): CurrentNamesUpgradeFailure =>
  request.unrenamed.kind === "malformed"
    ? { kind: "file-malformed", path: request.path, detail: request.unrenamed.detail }
    : { ...request.unrenamed, path: request.path };

const findDoubledListing = (request: { readonly renamed: KeysRenamed }): RenamedCheck | undefined =>
  request.renamed.renamed.find(({ under, to }) =>
    request.renamed.listed.some(
      (listing) => listing.under === under && listing.checks.includes(to),
    ),
  );

const renameSettings = (request: {
  readonly ports: CurrentNamesUpgradePorts;
}): Result<SettingsRenamed, CurrentNamesUpgradeFailure> => {
  const { ports } = request;
  const path = ports.settingsPath;
  const original = ports.fileText.read({ path });
  if (original.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path, detail: original.error.detail },
    };
  }
  const renamed = ports.settingsFormat.renameKeys({
    text: original.value,
    under: CHECK_LISTINGS,
    rename: mapListedAddressToCurrent,
  });
  if (renamed.outcome === "failed") {
    return { outcome: "failed", error: mapUnrenamedToFailure({ path, unrenamed: renamed.error }) };
  }
  const doubled = findDoubledListing({ renamed: renamed.value });
  return doubled === undefined
    ? { outcome: "ok", value: { original: original.value, renamed: renamed.value } }
    : { outcome: "failed", error: { kind: "listed-under-both-names", path, ...doubled } };
};

export const writeCurrentNames = (request: {
  readonly ports: CurrentNamesUpgradePorts;
}): Result<CurrentNamesUpgrade, CurrentNamesUpgradeFailure> => {
  const { ports } = request;
  const documents = ports.source.read();
  if (documents.outcome === "failed") {
    return { outcome: "failed", error: { kind: "records-folder", failure: documents.error } };
  }
  const refiling = mapHeldRecordsToCurrentNames({
    held: documents.value.map((document) => ({
      file: document.file,
      records: ports.recordsReader.readEntries({ document }),
    })),
  });
  if (refiling.outcome === "failed") {
    return { outcome: "failed", error: { kind: "records-documents", refusals: [refiling.error] } };
  }
  const settings = renameSettings({ ports });
  if (settings.outcome === "failed") {
    return settings;
  }
  const records = readEditEffects({
    ports,
    documents: documents.value,
    edit: refiling.value.edit,
  });
  if (records.outcome === "failed") {
    return records;
  }
  const planned = [
    ...records.value,
    ...mapSettingsToEffects({
      path: ports.settingsPath,
      original: settings.value.original,
      text: settings.value.renamed.text,
    }),
  ];
  const renamed: Renamed = {
    outcome: "renamed",
    records: refiling.value.renamed,
    checks: settings.value.renamed.renamed,
  };
  return {
    outcome: "ok",
    value: applyEffects({ effects: ports.effects, planned, renamed }),
  };
};
