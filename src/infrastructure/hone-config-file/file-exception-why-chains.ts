import { z } from "zod";

import {
  FILE_EXCEPTION_WHY_CHAINS,
  type FileExceptionWhyChains,
} from "../../domain/settings/selection/file-exception-why-chains.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const fileExceptionWhyChainsSchema = z.enum(FILE_EXCEPTION_WHY_CHAINS);

export const isFileExceptionWhyChainsSchemaEqual: Equal<
  z.output<typeof fileExceptionWhyChainsSchema>,
  FileExceptionWhyChains
> = true;
