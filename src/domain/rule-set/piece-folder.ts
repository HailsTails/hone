import { versionOneEngineNameOf } from "./engine-id.ts";
import type { CatalogueName } from "../language-layer/catalogue-name.ts";
import type { DisciplineId, EngineId } from "./identifier-types.ts";

export const enginesFolderSegmentsOf = (request: {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
}): readonly string[] =>
  request.ruleSetRoot === request.installRoot ? ["src", "infrastructure", "engines"] : ["mechanisms"];

export const engineFolderOf = (request: { readonly ruleSetRoot: string; readonly installRoot: string; readonly mechanism: EngineId }): string =>
  request.ruleSetRoot === request.installRoot ? request.mechanism : versionOneEngineNameOf(request.mechanism);

export const pieceFolderSegmentsOf = (request: {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
  readonly mechanism: EngineId;
  readonly discipline: DisciplineId;
}): readonly string[] => [request.ruleSetRoot, ...enginesFolderSegmentsOf(request), engineFolderOf(request), request.discipline];

export const namedPieceFolderSegmentsOf = (request: {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
  readonly mechanism: EngineId;
  readonly symptom: CatalogueName;
  readonly check: CatalogueName;
}): readonly string[] => [request.ruleSetRoot, ...enginesFolderSegmentsOf(request), request.mechanism, request.symptom, request.check];
