import type { CatalogueName } from "../language-layer/catalogue-name.ts";
import type { DisciplineId, MechanismId } from "./identifier-types.ts";

export const enginesFolderSegmentsOf = (request: {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
}): readonly string[] =>
  request.ruleSetRoot === request.installRoot ? ["src", "infrastructure", "engines"] : ["mechanisms"];

export const pieceFolderSegmentsOf = (request: {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
  readonly mechanism: MechanismId;
  readonly discipline: DisciplineId;
}): readonly string[] => [request.ruleSetRoot, ...enginesFolderSegmentsOf(request), request.mechanism, request.discipline];

export const namedPieceFolderSegmentsOf = (request: {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
  readonly mechanism: MechanismId;
  readonly symptom: CatalogueName;
  readonly check: CatalogueName;
}): readonly string[] => [request.ruleSetRoot, ...enginesFolderSegmentsOf(request), request.mechanism, request.symptom, request.check];
