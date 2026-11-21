import { projectionOutputNamesOf, projectionOutputsOf } from "../src/infrastructure/engines/protocol/projection-outputs.ts";

const ESLINT_ENGINE_NAME = "eslint";

const REPOSITORY_ROOT = ".";

const keyIn = (request: { readonly folder: string; readonly name: string }): string => `${request.folder}/${request.name}`;

export const ROOT_PROJECTION_DECLARATION_KEY: string = keyIn({ folder: REPOSITORY_ROOT, name: projectionOutputsOf({ engineName: ESLINT_ENGINE_NAME }).declaration });

export const projectionDeclarationKeyIn = (request: { readonly folder: string }): string =>
  keyIn({ folder: `${REPOSITORY_ROOT}/${request.folder}`, name: projectionOutputsOf({ engineName: ESLINT_ENGINE_NAME }).declaration });

const WRITTEN_AT_THE_ROOT: readonly string[] = projectionOutputNamesOf({ engineNames: [ESLINT_ENGINE_NAME] }).map((name) =>
  keyIn({ folder: REPOSITORY_ROOT, name }),
);

export const withoutProjectionOutputs = (request: { readonly sources: Readonly<Record<string, string>> }): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([file]) => !WRITTEN_AT_THE_ROOT.includes(file)));
