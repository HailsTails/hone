import { z } from "zod";

import { moduleExtensionOf } from "../../../../application/ports/host/module-extension.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";

const namingPluginSchema = z.object({
  default: z.object({
    rules: z.object({
      "naming-convention": z.looseObject({
        create: z.function({ input: [z.unknown()], output: z.unknown() }),
      }),
    }),
  }),
});

const path = createDefaultPathPort({});
const modules = createDefaultModuleLoaderPort({});

export const readNamingRule = async (request: { readonly moduleUrl: string }) => {
  const extension = moduleExtensionOf(request);
  const url = new URL(
    `../../../eslint/name-off-its-casing/naming-convention/eslint-plugin${extension}`,
    request.moduleUrl,
  );
  const location = path.fromFileUrl({ url: url.href });
  if (location.outcome === "failed") throw new Error(location.error.detail);
  const loaded = await modules.load({ path: location.value });
  if (loaded.outcome === "failed") throw new Error(loaded.error.detail);
  return namingPluginSchema.parse(loaded.value).default.rules["naming-convention"];
};
