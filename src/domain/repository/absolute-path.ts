import type { AbsolutePath } from "./absolute-path-types.ts";

export const POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT = /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/])/;

export const isAbsolutePath = (text: string): text is AbsolutePath => POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT.test(text);
