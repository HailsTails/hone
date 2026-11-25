import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import type { ImportForm, ModuleImport } from "./module-imports.ts";

export type ImportAllowance =
  | {
      readonly kind: "specifier";
      readonly specifier: RegExp;
      readonly forms: readonly ImportForm[];
    }
  | { readonly kind: "relative-reach"; readonly reach: RegExp };

export type ImportVerdict = "allowed" | "outside";

const RELATIVE_SPECIFIER = /^\.\.?\//;

export const STATIC_FORMS: readonly ImportForm[] = ["value", "type-only"];

export const EVERY_FORM: readonly ImportForm[] = ["value", "type-only", "dynamic"];

export const RELATIVE_IMPORT: ImportAllowance = {
  kind: "specifier",
  specifier: RELATIVE_SPECIFIER,
  forms: STATIC_FORMS,
};

export const RELATIVE_IMPORT_OF_ANY_FORM: ImportAllowance = {
  kind: "specifier",
  specifier: RELATIVE_SPECIFIER,
  forms: EVERY_FORM,
};

export const NODE_BUILTIN_IMPORT: ImportAllowance = {
  kind: "specifier",
  specifier: /^node:/,
  forms: STATIC_FORMS,
};

export const COMPUTED_LOAD: ImportAllowance = {
  kind: "specifier",
  specifier: /[^\w@/.:-]/,
  forms: ["dynamic"],
};

export const PACKAGE_OR_COMPUTED_IMPORT: ImportAllowance = {
  kind: "specifier",
  specifier: /^[^.]/,
  forms: EVERY_FORM,
};

export const ZOD_IMPORT: ImportAllowance = {
  kind: "specifier",
  specifier: /^zod$/,
  forms: STATIC_FORMS,
};

export const VITEST_IMPORT: ImportAllowance = {
  kind: "specifier",
  specifier: /^vitest$/,
  forms: STATIC_FORMS,
};

type JudgedImport = {
  readonly file: string;
  readonly moduleImport: Pick<ModuleImport, "specifier" | "form">;
  readonly path: Pick<PathPort, "joinRepository" | "repositoryDirectoryOf">;
};

const decideReach = (request: JudgedImport & { readonly reach: RegExp }): ImportVerdict => {
  const { file, moduleImport, path, reach } = request;
  if (!RELATIVE_SPECIFIER.test(moduleImport.specifier)) {
    return "outside";
  }
  const reached = path.joinRepository({
    segments: [path.repositoryDirectoryOf({ path: file }), moduleImport.specifier],
  });
  return reach.test(reached) ? "allowed" : "outside";
};

const decideByAllowance = (
  request: JudgedImport & { readonly allowance: ImportAllowance },
): ImportVerdict => {
  const { allowance, moduleImport } = request;
  if (allowance.kind === "relative-reach") {
    return decideReach({ ...request, reach: allowance.reach });
  }
  return allowance.specifier.test(moduleImport.specifier) &&
    allowance.forms.includes(moduleImport.form)
    ? "allowed"
    : "outside";
};

export const decideImport = (
  request: JudgedImport & { readonly allowed: readonly ImportAllowance[] },
): ImportVerdict =>
  request.allowed.some((allowance) => decideByAllowance({ ...request, allowance }) === "allowed")
    ? "allowed"
    : "outside";
