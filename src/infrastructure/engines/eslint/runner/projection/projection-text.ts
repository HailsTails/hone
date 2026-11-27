import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import {
  clauseAddressText,
  sameClauseAddress,
} from "../../../../../domain/rule-set/clause-address.ts";
import type { RuleOptions } from "../../../../../domain/runner/check-binding.ts";
import { enabledRuleEntry, reservedNamespace } from "../toolchain/eslint-instance.ts";
import { escapedGlobPath } from "./projection.ts";

export type ProjectedClause = {
  readonly address: ClauseAddress;
  readonly ruleId: string;
  readonly options: RuleOptions;
};

export type ProjectedPiece = {
  readonly pluginNamespace: string;
  readonly pluginImport: string;
  readonly clauses: readonly ProjectedClause[];
};

type RuleLine = { readonly ruleId: string; readonly entry: string };

type FileRecord = Exclude<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }>;

type ClauseWideRecord = Extract<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }>;

type FileClauses = {
  readonly file: RepoPath;
  readonly clauses: readonly ClauseAddress[];
  readonly clausesText: string;
};

type FileRecordGroup = {
  readonly clausesText: string;
  readonly clauses: readonly ClauseAddress[];
  readonly files: readonly RepoPath[];
};

export const PROJECTION_PATH: RepoPath = repoPathOf("disciplines.eslint.mjs");

const SOURCE_FILES = "**/*.{ts,tsx,mts,cts}";

const FILE_RECORDS_CATEGORY = "file-records";

const CLAUSE_SEPARATOR = ", ";

const codeUnitOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left < request.right) {
    return -1;
  }
  return request.left > request.right ? 1 : 0;
};

const quoted = (request: { readonly text: string }): string => JSON.stringify(request.text);

const rulesLine = (request: { readonly rules: readonly RuleLine[] }): string =>
  `    rules: { ${[...request.rules]
    .sort((left, right) => codeUnitOrder({ left: left.ruleId, right: right.ruleId }))
    .map((rule) => `${quoted({ text: rule.ruleId })}: ${rule.entry}`)
    .join(", ")} },`;

const enabledLine = (request: { readonly clause: ProjectedClause }): RuleLine => ({
  ruleId: request.clause.ruleId,
  entry: JSON.stringify(enabledRuleEntry({ options: request.clause.options })),
});

const offLines = (request: { readonly ruleIds: readonly string[] }): readonly RuleLine[] =>
  request.ruleIds.map((ruleId) => ({ ruleId, entry: quoted({ text: "off" }) }));

const blockText = (request: { readonly lines: readonly string[] }): string =>
  ["  {", ...request.lines, "  },"].join("\n");

const pieceBlock = (request: {
  readonly piece: ProjectedPiece;
  readonly importName: string;
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({ text: `${reservedNamespace}/piece/${request.piece.pluginNamespace}` })},`,
      `    files: [${quoted({ text: SOURCE_FILES })}],`,
      `    plugins: { ${quoted({ text: request.piece.pluginNamespace })}: ${request.importName} },`,
      rulesLine({ rules: request.piece.clauses.map((clause) => enabledLine({ clause })) }),
    ],
  });

const ruleIdsOfClause = (request: {
  readonly pieces: readonly ProjectedPiece[];
  readonly address: ClauseAddress;
}): readonly string[] =>
  request.pieces
    .flatMap((piece) => piece.clauses)
    .filter(
      (clause) => sameClauseAddress({ left: clause.address, right: request.address }) === "same",
    )
    .map((clause) => clause.ruleId)
    .sort((left, right) => codeUnitOrder({ left, right }));

const filesLines = (request: { readonly files: readonly RepoPath[] }): readonly string[] => [
  "    files: [",
  ...request.files.map((file) => `      ${quoted({ text: escapedGlobPath({ path: file }) })},`),
  "    ],",
];

const fileRecordGroupBlock = (request: {
  readonly group: FileRecordGroup;
  readonly pieces: readonly ProjectedPiece[];
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({ text: `${reservedNamespace}/${FILE_RECORDS_CATEGORY}/${request.group.clausesText}` })},`,
      ...filesLines({ files: request.group.files }),
      rulesLine({
        rules: offLines({
          ruleIds: [
            ...new Set(
              request.group.clauses.flatMap((address) =>
                ruleIdsOfClause({ pieces: request.pieces, address }),
              ),
            ),
          ],
        }),
      }),
    ],
  });

const clauseWideBlock = (request: {
  readonly record: ClauseWideRecord;
  readonly pieces: readonly ProjectedPiece[];
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({
        text: `${reservedNamespace}/${request.record.kind}/${clauseAddressText({ address: request.record.clause })}`,
      })},`,
      rulesLine({
        rules: offLines({
          ruleIds: ruleIdsOfClause({ pieces: request.pieces, address: request.record.clause }),
        }),
      }),
    ],
  });

const clauseWideOrder = (request: {
  readonly left: ClauseWideRecord;
  readonly right: ClauseWideRecord;
}): number =>
  codeUnitOrder({
    left: clauseAddressText({ address: request.left.clause }),
    right: clauseAddressText({ address: request.right.clause }),
  });

const fileRecordsOf = (request: {
  readonly records: readonly ExceptionRecord[];
}): readonly FileRecord[] =>
  request.records.flatMap((record) => (record.kind === "clause-wide-carve-out" ? [] : [record]));

const distinctSortedClauses = (request: {
  readonly clauses: readonly ClauseAddress[];
}): readonly ClauseAddress[] =>
  [...new Map(request.clauses.map((address) => [clauseAddressText({ address }), address]))]
    .sort(([left], [right]) => codeUnitOrder({ left, right }))
    .map(([, address]) => address);

const clausesOfEachFile = (request: {
  readonly records: readonly FileRecord[];
}): readonly FileClauses[] =>
  [...Map.groupBy(request.records, (record) => record.file)].map(([file, records]) => {
    const clauses = distinctSortedClauses({ clauses: records.map((record) => record.clause) });
    return {
      file,
      clauses,
      clausesText: clauses.map((address) => clauseAddressText({ address })).join(CLAUSE_SEPARATOR),
    };
  });

const fileRecordGroups = (request: {
  readonly records: readonly ExceptionRecord[];
}): readonly FileRecordGroup[] =>
  [
    ...Map.groupBy(
      clausesOfEachFile({ records: fileRecordsOf(request) }),
      (fileClauses) => fileClauses.clausesText,
    ),
  ]
    .sort(([left], [right]) => codeUnitOrder({ left, right }))
    .map(([clausesText, sharers]) => ({
      clausesText,
      clauses: distinctSortedClauses({
        clauses: sharers.flatMap((fileClauses) => fileClauses.clauses),
      }),
      files: sharers
        .map((fileClauses) => fileClauses.file)
        .sort((left, right) => codeUnitOrder({ left, right })),
    }));

const sortedClauseWideRecords = (request: {
  readonly records: readonly ExceptionRecord[];
}): readonly ClauseWideRecord[] =>
  request.records
    .flatMap((record) => (record.kind === "clause-wide-carve-out" ? [record] : []))
    .sort((left, right) => clauseWideOrder({ left, right }));

const sortedPieces = (request: {
  readonly pieces: readonly ProjectedPiece[];
}): readonly ProjectedPiece[] =>
  [...request.pieces].sort((left, right) =>
    codeUnitOrder({ left: left.pluginNamespace, right: right.pluginNamespace }),
  );

const importLines = (request: { readonly pieces: readonly ProjectedPiece[] }): readonly string[] =>
  request.pieces.map(
    (piece, index) => `import piece${index} from ${quoted({ text: piece.pluginImport })};`,
  );

const configBlocks = (request: {
  readonly pieces: readonly ProjectedPiece[];
  readonly records: readonly ExceptionRecord[];
}): readonly string[] => [
  ...request.pieces.map((piece, index) => pieceBlock({ piece, importName: `piece${index}` })),
  ...fileRecordGroups({ records: request.records }).map((group) =>
    fileRecordGroupBlock({ group, pieces: request.pieces }),
  ),
  ...sortedClauseWideRecords({ records: request.records }).map((record) =>
    clauseWideBlock({ record, pieces: request.pieces }),
  ),
];

export const projectionText = (request: {
  readonly selectedPieces: readonly ProjectedPiece[];
  readonly records: readonly ExceptionRecord[];
}): string => {
  const pieces = sortedPieces({ pieces: request.selectedPieces });
  const imports = importLines({ pieces });
  const blocks = configBlocks({ pieces, records: request.records });
  return `${imports.join("\n")}\n\nexport default [\n${blocks.join("\n")}\n];\n`;
};
