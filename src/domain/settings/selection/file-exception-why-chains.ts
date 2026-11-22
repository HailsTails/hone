export const FILE_EXCEPTION_WHY_CHAINS = ["required", "optional"] as const;

export type FileExceptionWhyChains = (typeof FILE_EXCEPTION_WHY_CHAINS)[number];
