export const CHECK_EDITIONS = ["pinned", "latest"] as const;

export type CheckEditions = (typeof CHECK_EDITIONS)[number];
