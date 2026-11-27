import type { EngineId } from "./identifier-types.ts";

export const versionOneEngineNameOf = (engine: EngineId): "audit" | "eslint" | "oxlint" =>
  engine === "walker" ? "audit" : engine;
