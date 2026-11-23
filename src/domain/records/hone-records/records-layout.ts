import { isCatalogueName } from "../../language-layer/catalogue-name.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { isRepoPath } from "../../repository/repo-path.ts";
import type { Result } from "../../result.ts";
import type { RuleSetIdentity } from "../../rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { isRuleSetName } from "../../rule-set/identifiers.ts";
import type { RecordsFolderKind } from "./hone-record.ts";

export const RECORDS_VERSION = 2;

export const RECORDS_FOLDER = "hone-records";

export const RECORDS_FILE_EXTENSION = ".json";

const RECORDS_ROOT = repoPathOf(RECORDS_FOLDER);

export type NamedFolderKind = Extract<
  RecordsFolderKind,
  "authorised-locations" | "debt" | "deviations"
>;

export type SingleFileKind = Extract<RecordsFolderKind, "boundary-records" | "dependency-records">;

export const NAMED_FOLDER_KINDS: readonly NamedFolderKind[] = [
  "authorised-locations",
  "debt",
  "deviations",
];

export const SINGLE_FILE_KINDS: readonly SingleFileKind[] = [
  "boundary-records",
  "dependency-records",
];

export type RecordsFileStanding =
  | {
      readonly standing: "named";
      readonly ruleSet: RuleSetIdentity;
      readonly kind: NamedFolderKind;
      readonly name: string;
    }
  | { readonly standing: "single"; readonly kind: SingleFileKind }
  | { readonly standing: "not-a-records-file" };

export type NotARecordsName = { readonly kind: "not-a-records-name"; readonly name: string };

const NOT_A_RECORDS_FILE: RecordsFileStanding = { standing: "not-a-records-file" };

const namedKindOf = (request: { readonly folder: string }): NamedFolderKind | undefined =>
  NAMED_FOLDER_KINDS.find((candidate) => candidate === request.folder);

const namedFileOf = (request: {
  readonly ruleSet: RuleSetIdentity;
  readonly folder: string;
  readonly name: string;
}): RecordsFileStanding => {
  const kind = namedKindOf(request);
  return kind === undefined ||
    !request.name.endsWith(RECORDS_FILE_EXTENSION) ||
    request.name.length === RECORDS_FILE_EXTENSION.length
    ? NOT_A_RECORDS_FILE
    : {
        standing: "named",
        ruleSet: request.ruleSet,
        kind,
        name: request.name.slice(0, -RECORDS_FILE_EXTENSION.length),
      };
};

const ruleSetFolderOf = (request: { readonly folder: string }): RuleSetIdentity | undefined =>
  isRuleSetName(request.folder) &&
  request.folder !== TOOL_RULE_SET &&
  namedKindOf(request) === undefined
    ? { name: request.folder }
    : undefined;

const ruleSetFileOf = (request: {
  readonly folder: string;
  readonly kindFolder: string;
  readonly name: string;
}): RecordsFileStanding => {
  const ruleSet = ruleSetFolderOf(request);
  return ruleSet === undefined
    ? NOT_A_RECORDS_FILE
    : namedFileOf({ ruleSet, folder: request.kindFolder, name: request.name });
};

const singleFileOf = (request: { readonly name: string }): RecordsFileStanding => {
  const kind = SINGLE_FILE_KINDS.find(
    (candidate) => `${candidate}${RECORDS_FILE_EXTENSION}` === request.name,
  );
  return kind === undefined ? NOT_A_RECORDS_FILE : { standing: "single", kind };
};

export const recordsFileStandingOf = (request: {
  readonly file: RepoPath;
}): RecordsFileStanding => {
  const [root, first, second, third, ...rest] = request.file.split("/");
  if (root !== RECORDS_FOLDER || first === undefined || rest.length > 0) {
    return NOT_A_RECORDS_FILE;
  }
  if (second === undefined) {
    return singleFileOf({ name: first });
  }
  return third === undefined
    ? namedFileOf({ ruleSet: TOOL_RULE_SET, folder: first, name: second })
    : ruleSetFileOf({ folder: first, kindFolder: second, name: third });
};

const ruleSetFoldersOf = (request: { readonly ruleSet: RuleSetIdentity }): readonly string[] =>
  request.ruleSet === TOOL_RULE_SET ? [RECORDS_FOLDER] : [RECORDS_FOLDER, request.ruleSet.name];

export const namedRecordsFolderOf = (request: {
  readonly ruleSet: RuleSetIdentity;
  readonly kind: NamedFolderKind;
}): RepoPath => {
  const folder = [...ruleSetFoldersOf(request), request.kind].join("/");
  return isRepoPath(folder) ? folder : RECORDS_ROOT;
};

export const namedRecordsFileOf = (request: {
  readonly ruleSet: RuleSetIdentity;
  readonly kind: NamedFolderKind;
  readonly name: string;
}): Result<RepoPath, NotARecordsName> => {
  const file = [
    ...ruleSetFoldersOf(request),
    request.kind,
    `${request.name}${RECORDS_FILE_EXTENSION}`,
  ].join("/");
  return isCatalogueName(request.name) && isRepoPath(file)
    ? { outcome: "ok", value: file }
    : { outcome: "failed", error: { kind: "not-a-records-name", name: request.name } };
};
