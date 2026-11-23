import type { ConventionKey } from "./conventions.ts";

export type UnreadConventionKey = Exclude<ConventionKey, "testFiles">;

export type SettingsNote = {
  readonly kind: "declared-not-read";
  readonly key: UnreadConventionKey;
};
