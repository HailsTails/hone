import { describe, expect, it } from "vitest";

import { editionOf } from "../../../src/domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../src/domain/runner/check-binding.ts";
import type { ListedPiece } from "./listed-piece.ts";
import { findPiecesNotRun, type PieceRefusal } from "./pieces-not-run.ts";

const LET_PIECE: ListedPiece = {
  engine: "walker",
  check: "rebinding#test-body",
  editions: [editionOf("1"), editionOf("2")],
};

const ANY_PIECE: ListedPiece = {
  engine: "eslint",
  check: "untyped-value#explicit-any",
  editions: [editionOf("1")],
};

const LET_FIRST: CheckBinding = {
  address: "rebinding#test-body",
  ruleSet: "hone",
  engine: "walker",
  edition: editionOf("1"),
  settings: {},
  pieceRoot: "/repo/rebinding/test-body",
  anchor: { kind: "file" },
  checkSettings: {},
};

const LET_SECOND: CheckBinding = { ...LET_FIRST, edition: editionOf("2") };

const ANY: CheckBinding = {
  ...LET_FIRST,
  address: "untyped-value#explicit-any",
  ruleSet: "hone",
  engine: "eslint",
  checkOptions: { kind: "none" },
};

type RunRow = {
  readonly name: string;
  readonly pieces: readonly ListedPiece[];
  readonly bindings: readonly CheckBinding[];
  readonly refusals: readonly PieceRefusal[];
};

describe("findPiecesNotRun", () => {
  it.each<RunRow>([
    {
      name: "nothing where each listed piece runs at each edition",
      pieces: [LET_PIECE, ANY_PIECE],
      bindings: [LET_FIRST, LET_SECOND, ANY],
      refusals: [],
    },
    {
      name: "a piece with no binding",
      pieces: [LET_PIECE, ANY_PIECE],
      bindings: [ANY],
      refusals: [
        {
          kind: "piece-not-run",
          engine: "walker",
          check: "rebinding#test-body",
          edition: editionOf("1"),
        },
        {
          kind: "piece-not-run",
          engine: "walker",
          check: "rebinding#test-body",
          edition: editionOf("2"),
        },
      ],
    },
    {
      name: "an edition with no binding",
      pieces: [LET_PIECE],
      bindings: [LET_SECOND],
      refusals: [
        {
          kind: "piece-not-run",
          engine: "walker",
          check: "rebinding#test-body",
          edition: editionOf("1"),
        },
      ],
    },
    {
      name: "a piece of an engine stripped from the bindings, where another engine runs its check",
      pieces: [ANY_PIECE],
      bindings: [{ ...ANY, engine: "walker" }],
      refusals: [
        {
          kind: "piece-not-run",
          engine: "eslint",
          check: "untyped-value#explicit-any",
          edition: editionOf("1"),
        },
      ],
    },
    {
      name: "an empty listing",
      pieces: [],
      bindings: [LET_FIRST],
      refusals: [{ kind: "no-piece-listed" }],
    },
  ])("refuses $name", ({ pieces, bindings, refusals }) => {
    const found = findPiecesNotRun({ pieces, bindings });

    expect(found).toEqual(refusals);
  });
});
