export const PROJECTION_KINDS = ["mjs", "ts"] as const;

export type ProjectionKind = (typeof PROJECTION_KINDS)[number];

export type ProjectionOutputs =
  | { readonly kind: "mjs"; readonly configuration: string; readonly declaration: string }
  | { readonly kind: "ts"; readonly configuration: string };

export const projectionOutputsOf = (request: {
  readonly engineName: string;
  readonly kind: ProjectionKind;
}): ProjectionOutputs => {
  switch (request.kind) {
    case "mjs":
      return {
        kind: "mjs",
        configuration: `hone.${request.engineName}.mjs`,
        declaration: `hone.${request.engineName}.d.mts`,
      };
    case "ts":
      return { kind: "ts", configuration: `hone.${request.engineName}.ts` };
  }
};

export const mapProjectionOutputsToNames = (request: {
  readonly outputs: ProjectionOutputs;
}): readonly string[] => {
  switch (request.outputs.kind) {
    case "mjs":
      return [request.outputs.configuration, request.outputs.declaration];
    case "ts":
      return [request.outputs.configuration];
  }
};

export const projectionOutputNamesOf = (request: {
  readonly engineNames: readonly string[];
}): readonly string[] =>
  request.engineNames.flatMap((engineName) =>
    PROJECTION_KINDS.flatMap((kind) =>
      mapProjectionOutputsToNames({ outputs: projectionOutputsOf({ engineName, kind }) }),
    ),
  );
