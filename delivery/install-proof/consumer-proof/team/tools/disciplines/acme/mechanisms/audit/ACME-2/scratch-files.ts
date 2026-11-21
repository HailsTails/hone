import { editionReaches, isEdition, type PieceHit, type RunnerClause, type WalkerPiece } from "@hailstails/hone/audit";

const SCRATCH_MARKER = ".scratch.";
const DRAFT_MARKER = ".draft.";
const DRAFT_EDITION = "2";

const markersOf = (request: { readonly clause: RunnerClause }): readonly string[] =>
  isEdition(DRAFT_EDITION) && editionReaches({ edition: request.clause.edition, introducedIn: DRAFT_EDITION }) === "reached"
    ? [SCRATCH_MARKER, DRAFT_MARKER]
    : [SCRATCH_MARKER];

const scratchHits = (request: { readonly clauses: readonly RunnerClause[]; readonly file: string }): readonly PieceHit[] =>
  request.clauses
    .filter((clause) => markersOf({ clause }).some((marker) => request.file.includes(marker)))
    .map((clause) => ({ clause: clause.address, anchor: { line: 1, column: 0 }, snippet: request.file }));

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => ({ outcome: "ok", value: { kind: "complete", hits: scratchHits({ clauses, file }) } }),
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
