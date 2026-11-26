import type { Branded } from "../repository/branded.ts";

export type RuleSetName = Branded<string, "RuleSetName">;
export type DisciplineId = Branded<string, "DisciplineId">;
export type ClauseId = Branded<string, "ClauseId">;
export type EngineId = "walker" | "eslint" | "oxlint";
