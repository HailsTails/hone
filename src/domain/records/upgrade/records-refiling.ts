import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { Result } from "../../result.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { isJsonObject, sameJsonValue } from "../../settings/json-values/json-kind.ts";
import type { ReadonlyJsonValue } from "../../settings/json-values/json-value.ts";
import type { RecordsDocumentRefusal } from "../hone-records/hone-record.ts";
import type { NamedFolderKind } from "../hone-records/named-folder-kind.ts";
import { createRecordsDocument, type RecordsEdit } from "../hone-records/records-edit.ts";
import { namedRecordsFileOf, recordsFileStandingOf } from "../hone-records/records-layout.ts";
import {
  mapReachToCurrent,
  mapRecipeToCurrent,
  mapRecordsFileNameToCurrent,
} from "./former-names.ts";

export type HeldRecords = {
  readonly file: RepoPath;
  readonly records: Result<readonly ReadonlyJsonValue[], RecordsDocumentRefusal>;
};

export type RenamedRecordsFile = {
  readonly from: RepoPath;
  readonly to: RepoPath;
  readonly records: number;
};

export type RecordsRefiling = {
  readonly edit: RecordsEdit;
  readonly renamed: readonly RenamedRecordsFile[];
};

type Refiled = {
  readonly from: RepoPath;
  readonly to: RepoPath;
  readonly records: readonly ReadonlyJsonValue[];
};

const NAMING_FIELD: Readonly<Record<NamedFolderKind, string>> = {
  debt: "answers",
  "authorised-locations": "answers",
  deviations: "recipe",
};

const mapFieldToCurrent = (request: {
  readonly kind: NamedFolderKind;
  readonly text: string;
}): string => {
  switch (request.kind) {
    case "debt":
    case "authorised-locations":
      return mapReachToCurrent(request);
    case "deviations":
      return mapRecipeToCurrent({ name: request.text });
  }
};

const mapEntryToCurrent = (request: {
  readonly kind: NamedFolderKind;
  readonly entry: ReadonlyJsonValue;
}): ReadonlyJsonValue => {
  const { kind, entry } = request;
  if (!isJsonObject(entry)) {
    return entry;
  }
  return Object.fromEntries(
    Object.entries(entry).map(([key, field]) => [
      key,
      key === NAMING_FIELD[kind] && typeof field === "string"
        ? mapFieldToCurrent({ kind, text: field })
        : field,
    ]),
  );
};

const mapHeldToRefiled = (request: { readonly held: HeldRecords }): readonly Refiled[] => {
  const { file, records } = request.held;
  const standing = recordsFileStandingOf({ file });
  if (
    standing.standing !== "named" ||
    standing.ruleSet !== TOOL_RULE_SET ||
    records.outcome === "failed"
  ) {
    return [];
  }
  const to = namedRecordsFileOf({
    ruleSet: TOOL_RULE_SET,
    kind: standing.kind,
    name: mapRecordsFileNameToCurrent(standing),
  });
  if (to.outcome === "failed") {
    return [];
  }
  const current = records.value.map((entry) => mapEntryToCurrent({ kind: standing.kind, entry }));
  const unchanged =
    to.value === file && sameJsonValue({ left: current, right: records.value }) === "same";
  return unchanged ? [] : [{ from: file, to: to.value, records: current }];
};

const mapHeldToKeptRecords = (request: {
  readonly held: readonly HeldRecords[];
  readonly refiled: readonly Refiled[];
  readonly file: RepoPath;
}): Result<readonly ReadonlyJsonValue[], RecordsDocumentRefusal> => {
  const own = request.refiled.find(({ from }) => from === request.file);
  if (own !== undefined) {
    return { outcome: "ok", value: own.records };
  }
  const held = request.held.find(({ file }) => file === request.file);
  return held === undefined ? { outcome: "ok", value: [] } : held.records;
};

const mapHeldToFileRecords = (request: {
  readonly held: readonly HeldRecords[];
  readonly refiled: readonly Refiled[];
  readonly file: RepoPath;
}): Result<readonly ReadonlyJsonValue[], RecordsDocumentRefusal> => {
  const kept = mapHeldToKeptRecords(request);
  if (kept.outcome === "failed") {
    return kept;
  }
  const moved = request.refiled
    .filter(({ from, to }) => to === request.file && from !== request.file)
    .flatMap(({ records }) => records);
  return { outcome: "ok", value: [...kept.value, ...moved] };
};

export const mapHeldRecordsToCurrentNames = (request: {
  readonly held: readonly HeldRecords[];
}): Result<RecordsRefiling, RecordsDocumentRefusal> => {
  const refiled = request.held.flatMap((held) => mapHeldToRefiled({ held }));
  const targets = [...new Set(refiled.map(({ to }) => to))];
  const written = targets.map((file) => ({
    file,
    records: mapHeldToFileRecords({ held: request.held, refiled, file }),
  }));
  const failed = written.find(({ records }) => records.outcome === "failed");
  if (failed !== undefined && failed.records.outcome === "failed") {
    return failed.records;
  }
  return {
    outcome: "ok",
    value: {
      edit: {
        write: written.flatMap(({ file, records }) =>
          records.outcome === "ok" ? [createRecordsDocument({ file, records: records.value })] : [],
        ),
        remove: refiled.filter(({ from, to }) => from !== to).map(({ from }) => from),
      },
      renamed: refiled.map(({ from, to, records }) => ({ from, to, records: records.length })),
    },
  };
};
