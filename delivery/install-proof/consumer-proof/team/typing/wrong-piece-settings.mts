import type { EslintPieceSettings } from "@hailstails/hone/rule-set";

const piece = { clauses: [{ clause: "console-calls", settings: { pluginNamespace: "acme", pluginModule: "acme.eslint-plugin.ts", rule: 1 } }] };

type Settled<Settings extends EslintPieceSettings> = Settings;

export type PieceSettings = Settled<(typeof piece)["clauses"][number]["settings"]>;
