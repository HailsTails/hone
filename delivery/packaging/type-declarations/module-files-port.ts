type ModulePath = { readonly path: string };

export type ModulePathKind = "file" | "directory" | "absent";

export type ModuleFilesPort = {
  readonly readKind: (request: ModulePath) => ModulePathKind;
  readonly readText: (request: ModulePath) => string | undefined;
  readonly resolvePath: (request: ModulePath) => string;
};
