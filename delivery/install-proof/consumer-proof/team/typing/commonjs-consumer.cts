import type { WalkerPiece } from "@hailstails/hone/walker";
import type { PieceDeclaration } from "@hailstails/hone/rule-set";

export type CommonJsPiece = WalkerPiece;

export const declaration: PieceDeclaration = { version: 2, anchor: { kind: "file" }, settings: { module: "scratch-files.ts" } };
