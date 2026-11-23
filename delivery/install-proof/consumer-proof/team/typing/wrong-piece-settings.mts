import type { EslintPieceSettings } from "@hailstails/hone/rule-set";

const piece = { version: 2, anchor: { kind: "keyword", keyword: "console" }, settings: { pluginNamespace: "acme", pluginModule: "acme.eslint-plugin.ts", rule: 1 } };

type Settled<Settings extends EslintPieceSettings> = Settings;

export type PieceSettings = Settled<(typeof piece)["settings"]>;
