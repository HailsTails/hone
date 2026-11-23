import type { CatalogueName } from "../language-layer/catalogue-name.ts";
import { versionOneEngineNameOf } from "./engine-id.ts";
import type { DisciplineId, EngineId } from "./identifier-types.ts";

type RuleSetPlace = {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
};

const INSTALL_ENGINES_SEGMENTS: readonly string[] = ["src", "infrastructure", "engines"];

export const enginesFolderSegmentsOf = (request: RuleSetPlace): readonly string[] =>
  request.ruleSetRoot === request.installRoot ? INSTALL_ENGINES_SEGMENTS : ["engines"];

export const versionOneEnginesFolderSegmentsOf = (request: RuleSetPlace): readonly string[] =>
  request.ruleSetRoot === request.installRoot ? INSTALL_ENGINES_SEGMENTS : ["mechanisms"];

const versionOneEngineFolderOf = (
  request: RuleSetPlace & { readonly mechanism: EngineId },
): string =>
  request.ruleSetRoot === request.installRoot
    ? request.mechanism
    : versionOneEngineNameOf(request.mechanism);

export const pieceFolderSegmentsOf = (
  request: RuleSetPlace & {
    readonly mechanism: EngineId;
    readonly discipline: DisciplineId;
  },
): readonly string[] => [
  request.ruleSetRoot,
  ...versionOneEnginesFolderSegmentsOf(request),
  versionOneEngineFolderOf(request),
  request.discipline,
];

export const namedPieceFolderSegmentsOf = (
  request: RuleSetPlace & {
    readonly mechanism: EngineId;
    readonly symptom: CatalogueName;
    readonly check: CatalogueName;
  },
): readonly string[] => [
  request.ruleSetRoot,
  ...enginesFolderSegmentsOf(request),
  request.mechanism,
  request.symptom,
  request.check,
];
