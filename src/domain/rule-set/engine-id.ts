import type { EngineId } from "./identifier-types.ts";

export const versionOneEngineNameOf = (engine: EngineId): "audit" | "eslint" => engine === "walker" ? "audit" : engine;
