import type { Result } from "../../../domain/result.ts";

export type ModuleLoad = Result<
  unknown,
  {
    readonly kind: "module-unloadable";
    readonly path: string;
    readonly detail: string;
  }
>;

export type ModuleLoaderPort = {
  readonly load: (request: { readonly path: string }) => Promise<ModuleLoad>;
};
