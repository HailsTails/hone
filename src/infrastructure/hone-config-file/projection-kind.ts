import { z } from "zod";

import {
  PROJECTION_KINDS,
  type ProjectionKind,
} from "../../application/ports/settings/settings-file-format.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const projectionKindSchema = z.enum(PROJECTION_KINDS);

export const isProjectionKindSchemaEqual: Equal<
  z.output<typeof projectionKindSchema>,
  ProjectionKind
> = true;
