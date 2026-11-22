import { z } from "zod";
import { CHECK_EDITIONS, type CheckEditions } from "../../domain/settings/clause-settings/check-editions.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const checkEditionsSchema = z.enum(CHECK_EDITIONS);

export const isCheckEditionsSchemaEqual: Equal<z.output<typeof checkEditionsSchema>, CheckEditions> = true;
