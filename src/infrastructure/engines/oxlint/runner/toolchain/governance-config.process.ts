import { createDefaultRequestPort } from "../../../../node/process/request-port.ts";

const entry = new URL(import.meta.url);

export const createGovernanceResolver = (loader: URL) => {
  const virtualName = loader.searchParams.get("configuration");
  const moduleUrl = new URL(loader);
  moduleUrl.search = "?read-configuration";
  return <Context, Resolution>(
    ...[specifier, context, next]: [
      string,
      Context,
      (specifier: string, context: Context) => Resolution,
    ]
  ) =>
    virtualName !== null &&
    specifier.startsWith("file:") &&
    new URL(specifier).pathname.endsWith(`/${virtualName}`)
      ? { url: moduleUrl.href, shortCircuit: true }
      : next(specifier, context);
};

export const resolve = createGovernanceResolver(entry);

const readConfiguration = (): unknown => JSON.parse(createDefaultRequestPort().read());

export default entry.search === "?read-configuration" ? readConfiguration() : undefined;
