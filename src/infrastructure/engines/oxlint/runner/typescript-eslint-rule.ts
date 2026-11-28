import { z } from "zod";

import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { locateInstalledPackage } from "../../../node/modules/package-location-port.ts";
import { TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT } from "../../protocol/toolchain/eslint-peer-requirements.ts";

const pluginSchema = z.object({
  default: z.object({
    rules: z.record(z.string(), z.unknown()),
  }),
});

const modules = createDefaultModuleLoaderPort({});

const ruleSchema = z.looseObject({
  create: z.function({ input: [z.unknown()], output: z.unknown() }),
});

export const readTypescriptEslintRule = async (request: { readonly name: string }) => {
  const location = locateInstalledPackage({
    packageName: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT.packageName,
  });
  if (location.outcome === "failed") throw new Error(location.error.detail);
  const loaded = await modules.load({ path: location.value });
  if (loaded.outcome === "failed") throw new Error(loaded.error.detail);
  return ruleSchema.parse(pluginSchema.parse(loaded.value).default.rules[request.name]);
};
