import { z } from "zod";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { createDefaultFileRemovalPort } from "../node/file-system/file-removal-port.ts";
import type { FileRemovalPort } from "../../application/ports/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../node/file-system/file-system-port.ts";
import type { DirectoryEntry, DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import { createDefaultFileTextPort } from "../node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { createDefaultGitPort, createDefaultGitTreePort } from "../git/git-port.ts";
import type { GitPort, GitTreePort } from "../../application/ports/git-port.ts";
import type { GitFailure } from "../../domain/repository/git-failure.ts";
import { createDefaultPathPort } from "../node/path-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import { readVersionOneJson } from "../content-files/rule-sets/rule-set-reader.ts";
import { absolutePathSchema } from "../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { clauseAddressSchema } from "./clause-address.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { fixedRepoPath } from "../../domain/repository/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import type { RecordPlace } from "../../domain/records/discipline-exceptions/exception-record.ts";
import { exceptionEntriesOfDocument, exceptionEntriesOfText, foreignKeysOfDocument, placedInSingleFile } from "./exception-records.ts";
import type { ExceptionRepository, ExceptionRepositoryOf, RecordsSplit } from "../../application/ports/records/exception-repository.ts";
import type { PlacedEntry, StructuralExceptionEntry } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import { type DebtPair, debtPairKey, entryPairKey } from "../../domain/records/discipline-exceptions/debt-pair.ts";
import { exceptionsTextWith, exceptionsTextWithout, type WritableEntry } from "./exceptions-text.ts";

export type ExceptionLayoutPorts = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly directory: DirectoryPort;
  readonly fileRemoval: FileRemovalPort;
  readonly git: GitPort;
  readonly gitTree: GitTreePort;
};

type LayoutRequest = ExceptionLayoutPorts & { readonly repoRoot: AbsolutePath };

type Layout = "single-file" | "split" | "none";

type Listing = Result<readonly RepoPath[], LoadFailure>;

type Placement = { readonly placed: "yes"; readonly file: RepoPath } | { readonly placed: "no"; readonly detail: string };

type RuleFileGroup = { readonly file: RepoPath; readonly entries: readonly WritableEntry[] };

type RecordsDocument = { readonly entries: readonly StructuralExceptionEntry[]; readonly foreignKeys: readonly string[] };

const SINGLE_FILE = fixedRepoPath("discipline-exceptions.json");

const SPLIT_FOLDER = fixedRepoPath("discipline-exceptions");

const RECORDS_FILE_EXTENSION = ".json";

const KIND_FOLDER_OF: Readonly<Record<StructuralExceptionEntry["kind"], string>> = {
  "authorised-location": "authorised-locations",
  "file-carve-out": "file-carve-outs",
  "clause-wide-carve-out": "clause-wide-carve-outs",
};

const KIND_FOLDERS: readonly string[] = Object.values(KIND_FOLDER_OF);

const STRAY_DETAIL = `is not a records file: ${SPLIT_FOLDER} holds only the folders ${KIND_FOLDERS.join(", ")}, each holding one <discipline>${RECORDS_FILE_EXTENSION} for each discipline, inside a folder named for its rule set when that rule set is not ${TOOL_RULE_SET}`;

const textOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const inTextOrder = (request: { readonly paths: readonly RepoPath[] }): readonly RepoPath[] =>
  request.paths.toSorted((left, right) => textOrder({ left, right }));

const absoluteOf = (request: LayoutRequest & { readonly file: string }): AbsolutePath =>
  absolutePathSchema.parse(request.path.join({ segments: [request.repoRoot, request.file] }));

export const placementOf = (request: { readonly entry: WritableEntry }): Placement => {
  const clause = clauseAddressSchema.safeParse(request.entry.clause);
  if (!clause.success) {
    return { placed: "no", detail: z.prettifyError(clause.error) };
  }
  const ruleFile = `${clause.data.discipline.toLowerCase()}${RECORDS_FILE_EXTENSION}`;
  const withinKind = clause.data.ruleSet === TOOL_RULE_SET ? ruleFile : `${clause.data.ruleSet.name}/${ruleFile}`;
  return { placed: "yes", file: repoPathSchema.parse(`${SPLIT_FOLDER}/${KIND_FOLDER_OF[request.entry.kind]}/${withinKind}`) };
};

const layoutOf = (request: LayoutRequest): Result<Layout, LoadFailure> => {
  const single = request.fileText.exists({ path: absoluteOf({ ...request, file: SINGLE_FILE }) });
  const split = request.fileText.exists({ path: absoluteOf({ ...request, file: SPLIT_FOLDER }) });
  if (single === "present" && split === "present") {
    return {
      outcome: "failed",
      error: {
        kind: "records-in-both-layouts",
        path: absoluteOf({ ...request, file: SINGLE_FILE }),
        folder: absoluteOf({ ...request, file: SPLIT_FOLDER }),
      },
    };
  }
  if (split === "present") {
    return { outcome: "ok", value: "split" };
  }
  return { outcome: "ok", value: single === "present" ? "single-file" : "none" };
};

const joinedListings = (request: { readonly listings: readonly Listing[] }): Listing => {
  const failure = request.listings.find((listing) => listing.outcome === "failed");
  if (failure !== undefined) {
    return failure;
  }
  return { outcome: "ok", value: request.listings.flatMap((listing) => (listing.outcome === "ok" ? listing.value : [])) };
};

const strayFailure = (request: LayoutRequest & { readonly file: string }): Listing => ({
  outcome: "failed",
  error: { kind: "file-malformed", path: absoluteOf(request), detail: STRAY_DETAIL },
});

const folderEntries = (request: LayoutRequest & { readonly folder: string }): Result<readonly DirectoryEntry[], LoadFailure> => {
  const path = absoluteOf({ ...request, file: request.folder });
  const listed = request.directory.list({ path });
  return listed.outcome === "failed" ? { outcome: "failed", error: { kind: "file-unreadable", path, detail: listed.error.detail } } : listed;
};

const recordsFileListing = (request: LayoutRequest & { readonly file: string; readonly entry: DirectoryEntry }): Listing => {
  const path = repoPathSchema.safeParse(request.file);
  return request.entry.kind === "file" && request.file.endsWith(RECORDS_FILE_EXTENSION) && path.success
    ? { outcome: "ok", value: [path.data] }
    : strayFailure(request);
};

const listingOf = (
  request: LayoutRequest & { readonly folder: string; readonly listingFor: (entry: DirectoryEntry) => Listing },
): Listing => {
  const entries = folderEntries(request);
  return entries.outcome === "failed" ? entries : joinedListings({ listings: entries.value.map(request.listingFor) });
};

const ruleSetFolderFiles = (request: LayoutRequest & { readonly folder: string }): Listing =>
  listingOf({ ...request, listingFor: (entry) => recordsFileListing({ ...request, file: `${request.folder}/${entry.name}`, entry }) });

const kindFolderFiles = (request: LayoutRequest & { readonly folder: string }): Listing =>
  listingOf({
    ...request,
    listingFor: (entry) =>
      entry.kind === "directory"
        ? ruleSetFolderFiles({ ...request, folder: `${request.folder}/${entry.name}` })
        : recordsFileListing({ ...request, file: `${request.folder}/${entry.name}`, entry }),
  });

const splitFiles = (request: LayoutRequest): Listing => {
  const listing = listingOf({
    ...request,
    folder: SPLIT_FOLDER,
    listingFor: (entry) =>
      entry.kind === "directory" && KIND_FOLDERS.includes(entry.name)
        ? kindFolderFiles({ ...request, folder: `${SPLIT_FOLDER}/${entry.name}` })
        : strayFailure({ ...request, file: `${SPLIT_FOLDER}/${entry.name}` }),
  });
  return listing.outcome === "failed" ? listing : { outcome: "ok", value: inTextOrder({ paths: listing.value }) };
};

const recordsDocumentOf = (request: LayoutRequest & { readonly file: RepoPath }): Result<RecordsDocument, LoadFailure> => {
  const path = absoluteOf(request);
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const entries = exceptionEntriesOfDocument({ document: document.value });
  return entries.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-malformed", path, detail: entries.error.detail } }
    : { outcome: "ok", value: { entries: entries.value, foreignKeys: foreignKeysOfDocument({ document: document.value }) } };
};

const documentEntries = (request: LayoutRequest & { readonly file: RepoPath }): Result<readonly StructuralExceptionEntry[], LoadFailure> => {
  const document = recordsDocumentOf(request);
  return document.outcome === "failed" ? document : { outcome: "ok", value: document.value.entries };
};

const placedIn = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
  readonly layout: RecordPlace["layout"];
  readonly file: RepoPath;
}): readonly PlacedEntry[] => request.entries.map((entry, index) => ({ place: { layout: request.layout, file: request.file, index }, entry }));

const misplacedDetail = (request: { readonly entries: readonly StructuralExceptionEntry[]; readonly file: RepoPath }): string | undefined =>
  request.entries.flatMap((entry, index) => {
    const placement = placementOf({ entry });
    return placement.placed === "yes" && placement.file !== request.file
      ? [`exceptions[${index}] is a ${entry.kind} on ${entry.clause}, which belongs in ${placement.file}`]
      : [];
  }).at(0);

const splitFileEntries = (request: LayoutRequest & { readonly file: RepoPath }): Result<readonly PlacedEntry[], LoadFailure> => {
  const entries = documentEntries(request);
  if (entries.outcome === "failed") {
    return entries;
  }
  const misplaced = misplacedDetail({ entries: entries.value, file: request.file });
  return misplaced === undefined
    ? { outcome: "ok", value: placedIn({ entries: entries.value, layout: "split", file: request.file }) }
    : { outcome: "failed", error: { kind: "file-malformed", path: absoluteOf(request), detail: misplaced } };
};

const splitEntries = (request: LayoutRequest): Result<readonly PlacedEntry[], LoadFailure> => {
  const files = splitFiles(request);
  if (files.outcome === "failed") {
    return files;
  }
  return files.value.reduce<Result<readonly PlacedEntry[], LoadFailure>>((sofar, file) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const read = splitFileEntries({ ...request, file });
    return read.outcome === "failed" ? read : { outcome: "ok", value: [...sofar.value, ...read.value] };
  }, { outcome: "ok", value: [] });
};

const singleEntries = (request: LayoutRequest): Result<readonly PlacedEntry[], LoadFailure> => {
  const entries = documentEntries({ ...request, file: SINGLE_FILE });
  return entries.outcome === "failed"
    ? entries
    : { outcome: "ok", value: placedInSingleFile({ entries: entries.value }) };
};

const workingEntries = (request: LayoutRequest): Result<readonly PlacedEntry[], LoadFailure> => {
  const layout = layoutOf(request);
  if (layout.outcome === "failed") {
    return layout;
  }
  switch (layout.value) {
    case "none":
      return { outcome: "ok", value: [] };
    case "single-file":
      return singleEntries(request);
    case "split":
      return splitEntries(request);
  }
};

const recordsFileStanding = (request: { readonly path: RepoPath }): "records-file" | "other-file" =>
  request.path === SINGLE_FILE || (request.path.startsWith(`${SPLIT_FOLDER}/`) && request.path.endsWith(RECORDS_FILE_EXTENSION))
    ? "records-file"
    : "other-file";

const baseTextEntries = (request: LayoutRequest & { readonly revision: string; readonly file: RepoPath }): Result<readonly StructuralExceptionEntry[], GitFailure> => {
  const text = request.git.textInBase({ repoRoot: request.repoRoot, baseRevision: request.revision, file: request.file });
  if (text.outcome === "failed") {
    return text;
  }
  return { outcome: "ok", value: text.value.presence === "present-in-base" ? exceptionEntriesOfText({ text: text.value.text }) : [] };
};

const baseEntries = (request: LayoutRequest & { readonly revision: string }): Result<readonly StructuralExceptionEntry[], GitFailure> => {
  const paths = request.gitTree.pathsAt({ repoRoot: request.repoRoot, revision: request.revision });
  if (paths.outcome === "failed") {
    return paths;
  }
  const files = inTextOrder({ paths: paths.value.filter((path) => recordsFileStanding({ path }) === "records-file") });
  return files.reduce<Result<readonly StructuralExceptionEntry[], GitFailure>>((sofar, file) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const read = baseTextEntries({ ...request, file });
    return read.outcome === "failed" ? read : { outcome: "ok", value: [...sofar.value, ...read.value] };
  }, { outcome: "ok", value: [] });
};

const currentText = (request: LayoutRequest & { readonly target: AbsolutePath }): Result<string | undefined, LoadFailure> => {
  if (request.fileText.exists({ path: request.target }) === "absent") {
    return { outcome: "ok", value: undefined };
  }
  const text = request.fileText.read({ path: request.target });
  return text.outcome === "failed" ? { outcome: "failed", error: { kind: "file-unreadable", path: request.target, detail: text.error.detail } } : text;
};

const folderMade = (request: LayoutRequest & { readonly file: RepoPath }): Result<void, LoadFailure> => {
  const parent = request.file.split("/").slice(0, -1).join("/");
  if (parent.length === 0) {
    return { outcome: "ok", value: undefined };
  }
  const folder = absoluteOf({ ...request, file: parent });
  const made = request.directory.create({ path: folder });
  return made.outcome === "failed" ? { outcome: "failed", error: { kind: "file-unwritable", path: folder, detail: made.error.detail } } : made;
};

const groupWritten = (request: LayoutRequest & { readonly group: RuleFileGroup }): Result<void, LoadFailure> => {
  const path = absoluteOf({ ...request, file: request.group.file });
  const current = currentText({ ...request, target: path });
  if (current.outcome === "failed") {
    return current;
  }
  const text = exceptionsTextWith({ text: current.value, entries: request.group.entries });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-malformed", path, detail: text.error.detail } };
  }
  const folder = current.value === undefined ? folderMade({ ...request, file: request.group.file }) : { outcome: "ok" as const, value: undefined };
  if (folder.outcome === "failed") {
    return folder;
  }
  const written = request.fileText.write({ path, text: text.value });
  return written.outcome === "failed" ? { outcome: "failed", error: { kind: "file-unwritable", path, detail: written.error.detail } } : written;
};

const groupsWritten = (request: LayoutRequest & { readonly groups: readonly RuleFileGroup[] }): Result<readonly RepoPath[], LoadFailure> =>
  request.groups.reduce<Result<readonly RepoPath[], LoadFailure>>((sofar, group) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const written = groupWritten({ ...request, group });
    return written.outcome === "failed" ? written : { outcome: "ok", value: [...sofar.value, group.file] };
  }, { outcome: "ok", value: [] });

const unplaceable = (request: LayoutRequest & { readonly file: string; readonly detail: string }): Result<never, LoadFailure> => ({
  outcome: "failed",
  error: { kind: "records-unsplittable", path: absoluteOf(request), detail: request.detail },
});

const ruleFileGroupsOf = (
  request: LayoutRequest & { readonly entries: readonly WritableEntry[]; readonly from: RepoPath },
): Result<readonly RuleFileGroup[], LoadFailure> => {
  const placements = request.entries.map((entry, index) => ({ entry, index, placement: placementOf({ entry }) }));
  const unplaced = placements.find(({ placement }) => placement.placed === "no");
  if (unplaced !== undefined && unplaced.placement.placed === "no") {
    return unplaceable({
      ...request,
      file: request.from,
      detail: `exceptions[${unplaced.index}] has the clause ${JSON.stringify(unplaced.entry.clause)}, which names no discipline, so no rule's file can hold it: ${unplaced.placement.detail}; fix its clause or remove it, then split again`,
    });
  }
  const placed = placements.flatMap(({ entry, placement }) => (placement.placed === "yes" ? [{ entry, file: placement.file }] : []));
  const files = inTextOrder({ paths: [...new Set(placed.map(({ file }) => file))] });
  return { outcome: "ok", value: files.map((file) => ({ file, entries: placed.filter((candidate) => candidate.file === file).map(({ entry }) => entry) })) };
};

const added = (request: LayoutRequest & { readonly entries: readonly WritableEntry[] }): Result<void, LoadFailure> => {
  const layout = layoutOf(request);
  if (layout.outcome === "failed" || request.entries.length === 0) {
    return layout.outcome === "failed" ? layout : { outcome: "ok", value: undefined };
  }
  const groups: Result<readonly RuleFileGroup[], LoadFailure> =
    layout.value === "split"
      ? ruleFileGroupsOf({ ...request, from: SPLIT_FOLDER })
      : { outcome: "ok", value: [{ file: SINGLE_FILE, entries: request.entries }] };
  if (groups.outcome === "failed") {
    return groups;
  }
  const written = groupsWritten({ ...request, groups: groups.value });
  return written.outcome === "failed" ? written : { outcome: "ok", value: undefined };
};

const indexesWritten = (request: LayoutRequest & { readonly file: RepoPath; readonly indexes: readonly number[] }): Result<void, LoadFailure> => {
  const path = absoluteOf(request);
  const current = request.fileText.read({ path });
  if (current.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-unreadable", path, detail: current.error.detail } };
  }
  const text = exceptionsTextWithout({ text: current.value, indexes: request.indexes });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-malformed", path, detail: text.error.detail } };
  }
  const written = request.fileText.write({ path, text: text.value });
  return written.outcome === "failed" ? { outcome: "failed", error: { kind: "file-unwritable", path, detail: written.error.detail } } : written;
};

const heldFileCarveOuts = (request: { readonly placed: readonly PlacedEntry[]; readonly pairs: readonly DebtPair[] }): readonly PlacedEntry[] => {
  const removing = new Set(request.pairs.map((pair) => debtPairKey(pair)));
  return request.placed.filter(({ entry }) => {
    const key = entryPairKey({ entry });
    return entry.kind === "file-carve-out" && key !== undefined && removing.has(key);
  });
};

const recordsFileRemoved = (request: LayoutRequest & { readonly file: RepoPath }): Result<void, LoadFailure> => {
  const path = absoluteOf(request);
  const removal = request.fileRemoval.remove({ path });
  return removal.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unwritable", path, detail: removal.error.detail } }
    : { outcome: "ok", value: undefined };
};

const emptiedSplitFile = (request: {
  readonly placed: readonly PlacedEntry[];
  readonly removing: readonly PlacedEntry[];
}): "emptied" | "kept" => {
  const [first] = request.removing;
  return first !== undefined &&
    first.place.layout === "split" &&
    request.placed.filter(({ place }) => place.file === first.place.file).length === request.removing.length
    ? "emptied"
    : "kept";
};

const removedFrom = (
  request: LayoutRequest & { readonly placed: readonly PlacedEntry[]; readonly file: RepoPath; readonly removing: readonly PlacedEntry[] },
): Result<void, LoadFailure> =>
  emptiedSplitFile(request) === "emptied"
    ? recordsFileRemoved(request)
    : indexesWritten({ ...request, indexes: request.removing.map(({ place }) => place.index) });

const removed = (request: LayoutRequest & { readonly pairs: readonly DebtPair[] }): Result<readonly DebtPair[], LoadFailure> => {
  const placed = workingEntries(request);
  if (placed.outcome === "failed") {
    return placed;
  }
  const held = heldFileCarveOuts({ placed: placed.value, pairs: request.pairs });
  const byFile = [...Map.groupBy(held, ({ place }) => place.file)];
  const written = byFile.reduce<Result<void, LoadFailure>>(
    (sofar, [file, entries]) =>
      sofar.outcome === "failed" ? sofar : removedFrom({ ...request, placed: placed.value, file, removing: entries }),
    { outcome: "ok", value: undefined },
  );
  if (written.outcome === "failed") {
    return written;
  }
  const heldKeys = new Set(held.flatMap(({ entry }) => entryPairKey({ entry }) ?? []));
  return { outcome: "ok", value: request.pairs.filter((pair) => heldKeys.has(debtPairKey(pair))) };
};

const foreignKeysRefusal = (request: LayoutRequest & { readonly foreignKeys: readonly string[] }): Result<never, LoadFailure> =>
  unplaceable({
    ...request,
    file: SINGLE_FILE,
    detail: `holds the keys ${request.foreignKeys.map((key) => JSON.stringify(key)).join(", ")} beside version and exceptions, and the split layout has no file to keep them in; remove them or keep them elsewhere, then split again`,
  });

const singleFileSplit = (request: LayoutRequest): Result<RecordsSplit, LoadFailure> => {
  const document = recordsDocumentOf({ ...request, file: SINGLE_FILE });
  if (document.outcome === "failed") {
    return document;
  }
  if (document.value.entries.length === 0) {
    return { outcome: "ok", value: { effect: "no-records", path: SINGLE_FILE } };
  }
  if (document.value.foreignKeys.length > 0) {
    return foreignKeysRefusal({ ...request, foreignKeys: document.value.foreignKeys });
  }
  const groups = ruleFileGroupsOf({ ...request, entries: document.value.entries, from: SINGLE_FILE });
  if (groups.outcome === "failed") {
    return groups;
  }
  const written = groupsWritten({ ...request, groups: groups.value });
  if (written.outcome === "failed") {
    return written;
  }
  const path = absoluteOf({ ...request, file: SINGLE_FILE });
  const removed = request.fileRemoval.remove({ path });
  return removed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unwritable", path, detail: removed.error.detail } }
    : {
        outcome: "ok",
        value: {
          effect: "split",
          writes: [...written.value.map((file) => ({ path: file, effect: "written" as const })), { path: SINGLE_FILE, effect: "removed" }],
        },
      };
};

const splitOf = (request: LayoutRequest): Result<RecordsSplit, LoadFailure> => {
  const layout = layoutOf(request);
  if (layout.outcome === "failed") {
    return layout;
  }
  switch (layout.value) {
    case "none":
      return { outcome: "ok", value: { effect: "no-records", path: SINGLE_FILE } };
    case "split":
      return { outcome: "ok", value: { effect: "already-split", path: SPLIT_FOLDER } };
    case "single-file":
      return singleFileSplit(request);
  }
};

export const createExceptionRepository = (request: LayoutRequest): ExceptionRepository => ({
  read: () => workingEntries(request),
  readAt: (at) => baseEntries({ ...request, revision: at.revision }),
  add: (addition) => added({ ...request, entries: addition.entries }),
  remove: (removal) => removed({ ...request, pairs: removal.pairs }),
  moveToSplitLayout: () => splitOf(request),
});

export const exceptionRepositoryOf =
  (ports: ExceptionLayoutPorts): ExceptionRepositoryOf =>
  (request) =>
    createExceptionRepository({ ...ports, repoRoot: request.repoRoot });

export const createDefaultExceptionRepositoryOf = (_options: Record<string, never>): ExceptionRepositoryOf =>
  exceptionRepositoryOf({
    fileText: createDefaultFileTextPort({}),
    path: createDefaultPathPort({}),
    directory: createDefaultDirectoryPort({}),
    fileRemoval: createDefaultFileRemovalPort({}),
    git: createDefaultGitPort({}),
    gitTree: createDefaultGitTreePort({}),
  });
