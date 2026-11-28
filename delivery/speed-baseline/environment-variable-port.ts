export type EnvironmentVariablePort = {
  readonly read: (request: { readonly name: string }) => string | undefined;
};
