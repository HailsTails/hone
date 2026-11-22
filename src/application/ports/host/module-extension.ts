export type ModuleExtension = ".ts" | ".js";

export const BUILT_MODULE_EXTENSION: ModuleExtension = ".js";

const SOURCE_MODULE_EXTENSION: ModuleExtension = ".ts";

export const moduleExtensionOf = (request: { readonly moduleUrl: string }): ModuleExtension =>
  new URL(request.moduleUrl).pathname.endsWith(BUILT_MODULE_EXTENSION)
    ? BUILT_MODULE_EXTENSION
    : SOURCE_MODULE_EXTENSION;

const MODULE_EXTENSIONS: readonly ModuleExtension[] = [
  SOURCE_MODULE_EXTENSION,
  BUILT_MODULE_EXTENSION,
];

export const moduleFileForm = (request: {
  readonly text: string;
}): "module-file" | "not-module-file" =>
  MODULE_EXTENSIONS.some((extension) => request.text.endsWith(extension))
    ? "module-file"
    : "not-module-file";
