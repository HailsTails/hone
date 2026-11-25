import type { Result } from "../../../src/domain/result.ts";
import type { RunnerFailure } from "../../../src/domain/runner/runner-failure.ts";

export type ConsumerText = { readonly path: string; readonly text: string };

export type ConsumerPackage =
  | { readonly kind: "written"; readonly name: string; readonly texts: readonly ConsumerText[] }
  | {
      readonly kind: "installed";
      readonly name: string;
      readonly nodeModules: string;
      readonly folder: string;
    };

export type ConsumerContents = {
  readonly texts: readonly ConsumerText[];
  readonly packages: readonly ConsumerPackage[];
};

export type ConsumerResolution = "bundler" | "nodenext";

export type ConsumerForm = "typescript" | "checked-javascript";

export type ConsumerProgram = ConsumerContents & {
  readonly entry: string;
  readonly resolution: ConsumerResolution;
  readonly form: ConsumerForm;
};

export type ConsumerDiagnostic = {
  readonly path: string | undefined;
  readonly code: number;
  readonly message: string;
};

export type ConsumerTypesPort = {
  readonly read: (
    program: ConsumerProgram,
  ) => Promise<Result<readonly ConsumerDiagnostic[], RunnerFailure>>;
};
