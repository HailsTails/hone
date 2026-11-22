import type { AbsoluteRootText } from "./absolute-root-of.ts";

export const POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT = /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/])/;

export const isAbsolutePath = (text: string): text is AbsoluteRootText => POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT.test(text);
