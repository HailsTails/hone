export type ProjectionOutputs = { readonly configuration: string; readonly declaration: string };

export const projectionOutputsOf = (request: {
  readonly engineName: string;
}): ProjectionOutputs => ({
  configuration: `hone.${request.engineName}.mjs`,
  declaration: `hone.${request.engineName}.d.mts`,
});

export const projectionOutputNamesOf = (request: {
  readonly engineNames: readonly string[];
}): readonly string[] =>
  request.engineNames.flatMap((engineName) => Object.values(projectionOutputsOf({ engineName })));
