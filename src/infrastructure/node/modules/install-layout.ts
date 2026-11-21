import { BUILT_MODULE_EXTENSION, type ModuleExtension } from "../../../application/ports/host/module-extension.ts";

export type InstallEntry = "api" | "command" | "runner";

const FOLDERS_BETWEEN_INSTALL_ROOT_AND_ENTRY: Readonly<Record<InstallEntry, number>> = {
  api: 1,
  command: 1,
  runner: 5,
};

export const installRootAboveEntry = (request: {
  readonly entryFile: string;
  readonly entry: InstallEntry;
  readonly directoryOf: (path: string) => string;
}): string =>
  Array.from({ length: FOLDERS_BETWEEN_INSTALL_ROOT_AND_ENTRY[request.entry] + 1 }).reduce<string>(
    (path) => request.directoryOf(path),
    request.entryFile,
  );

export type InstallForm = "package" | "source";

export const installFormOf = (request: { readonly moduleExtension: ModuleExtension }): InstallForm =>
  request.moduleExtension === BUILT_MODULE_EXTENSION ? "package" : "source";

export const runnerModuleSegmentsOf = (request: {
  readonly installRoot: string;
  readonly mechanism: string;
  readonly moduleExtension: ModuleExtension;
}): readonly string[] => [request.installRoot, "src", "infrastructure", "engines", request.mechanism, "runner", `runner${request.moduleExtension}`];
