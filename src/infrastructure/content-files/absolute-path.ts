import { z } from "zod";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { brandedTextSchema } from "./branded-schema.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";

const POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT = /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/])/;

const isAbsolutePath = (text: string): text is AbsolutePath => POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT.test(text);

export const absolutePathSchema = brandedTextSchema({
  text: z.string().regex(POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT),
  isBranded: isAbsolutePath,
  refusal: "not an absolute path",
});

export const isAbsolutePathSchemaEqual: Equal<z.output<typeof absolutePathSchema>, AbsolutePath> = true;
