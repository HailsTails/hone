import type { Branded } from "../repository/branded.ts";

export type RuleSetName = Branded<string, "RuleSetName">;
export type DisciplineId = Branded<string, "DisciplineId">;
export type ClauseId = Branded<string, "ClauseId">;
export const ENGINE_IDS = ["walker", "eslint", "oxlint"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];
