import { editionReaches, isEdition, type PieceHit, type CheckBinding, type WalkerPiece } from "@hailstails/hone/audit";

const SCRATCH_MARKER = ".scratch.";
const DRAFT_MARKER = ".draft.";
const DRAFT_EDITION = "2";

const markersOf = (request: { readonly binding: CheckBinding }): readonly string[] =>
  isEdition(DRAFT_EDITION) && editionReaches({ edition: request.binding.edition, introducedIn: DRAFT_EDITION }) === "reached"
    ? [SCRATCH_MARKER, DRAFT_MARKER]
    : [SCRATCH_MARKER];

const scratchHits = (request: { readonly bindings: readonly CheckBinding[]; readonly file: string }): readonly PieceHit[] =>
  request.bindings
    .filter((binding) => markersOf({ binding }).some((marker) => request.file.includes(marker)))
    .map((binding) => ({ check: binding.address, anchor: { line: 1, column: 0 }, snippet: request.file }));

export const check: WalkerPiece = {
  prepare: ({ bindings }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => ({ outcome: "ok", value: { kind: "complete", hits: scratchHits({ bindings, file }) } }),
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
