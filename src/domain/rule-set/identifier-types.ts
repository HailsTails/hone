import type { Branded } from "../repository/branded.ts";

export type RuleSetName = Branded<string, "RuleSetName">;
export type DisciplineId = Branded<string, "DisciplineId">;
export type ClauseId = Branded<string, "ClauseId">;

type EngineIds = readonly ["walker", "eslint", "oxlint"];
export type EngineId = EngineIds[number];
export const ENGINE_IDS: EngineIds = ["walker", "eslint", "oxlint"];
