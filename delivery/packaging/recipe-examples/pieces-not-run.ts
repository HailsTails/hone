import type { CheckAddressText } from "../../../src/domain/language-layer/check-address-text.ts";
import type { Edition } from "../../../src/domain/rule-set/edition-types.ts";
import type { EngineId } from "../../../src/domain/rule-set/identifier-types.ts";
import type { CheckBinding } from "../../../src/domain/runner/check-binding.ts";
import type { ListedPiece } from "./listed-piece.ts";

export type PieceRefusal =
  | { readonly kind: "no-piece-listed" }
  | {
      readonly kind: "piece-not-run";
      readonly engine: EngineId;
      readonly check: CheckAddressText;
      readonly edition: Edition;
    };

const findBinding = (request: {
  readonly piece: ListedPiece;
  readonly edition: Edition;
  readonly bindings: readonly CheckBinding[];
}): CheckBinding | undefined =>
  request.bindings.find(
    ({ engine, address, edition }) =>
      engine === request.piece.engine &&
      address === request.piece.check &&
      edition === request.edition,
  );

export const findPiecesNotRun = (request: {
  readonly pieces: readonly ListedPiece[];
  readonly bindings: readonly CheckBinding[];
}): readonly PieceRefusal[] =>
  request.pieces.length === 0
    ? [{ kind: "no-piece-listed" }]
    : request.pieces.flatMap((piece) =>
        piece.editions
          .filter(
            (edition) => findBinding({ piece, edition, bindings: request.bindings }) === undefined,
          )
          .map((edition) => ({
            kind: "piece-not-run",
            engine: piece.engine,
            check: piece.check,
            edition,
          })),
      );
