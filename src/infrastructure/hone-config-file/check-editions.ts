import { z } from "zod";

export const checkEditionsSchema = z.enum(["pinned", "latest"]);

export type CheckEditions = z.infer<typeof checkEditionsSchema>;
