import type { ConventionKey } from "./conventions.ts";

export type SettingsNote = { readonly kind: "declared-not-read"; readonly key: ConventionKey };
