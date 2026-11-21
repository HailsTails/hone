import type { ConventionKey } from "../../infrastructure/hone-config-file/conventions.ts";

export type SettingsNote = { readonly kind: "declared-not-read"; readonly key: ConventionKey };
