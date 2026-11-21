import type { EslintPieceSettings } from "@hailstails/hone/rule-set";
import piece from "./piece.json" with { type: "json" };

type Settled<Settings extends EslintPieceSettings> = Settings;

export type PieceSettings = Settled<(typeof piece)["clauses"][number]["settings"]>;
