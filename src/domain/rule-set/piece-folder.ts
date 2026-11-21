export const enginesFolderSegmentsOf = (request: {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
}): readonly string[] =>
  request.ruleSetRoot === request.installRoot ? ["src", "infrastructure", "engines"] : ["mechanisms"];

export const pieceFolderSegmentsOf = (request: {
  readonly ruleSetRoot: string;
  readonly installRoot: string;
  readonly mechanism: string;
  readonly discipline: string;
}): readonly string[] => [request.ruleSetRoot, ...enginesFolderSegmentsOf(request), request.mechanism, request.discipline];
