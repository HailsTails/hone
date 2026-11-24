import type { Result } from "../../src/domain/result.ts";

export type TargetPackageManager = "pnpm" | "bun";

type TargetLockfile = "pnpm-lock.yaml" | "bun.lock" | "bun.lockb";

type UnsupportedLockfile = "package-lock.json" | "npm-shrinkwrap.json" | "yarn.lock";

export type TargetPackageManagerFailure =
  | { readonly kind: "lockfile-unsupported"; readonly lockfile: UnsupportedLockfile }
  | { readonly kind: "lockfile-missing" };

const TARGET_LOCKFILES = {
  "pnpm-lock.yaml": "pnpm",
  "bun.lock": "bun",
  "bun.lockb": "bun",
} satisfies Readonly<Record<TargetLockfile, TargetPackageManager>>;

const LOCKFILE_PRECEDENCE: readonly TargetLockfile[] = ["pnpm-lock.yaml", "bun.lock", "bun.lockb"];

const UNSUPPORTED_LOCKFILES: readonly UnsupportedLockfile[] = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
];

export const SUPPORTED_LOCKFILES: readonly TargetLockfile[] = ["pnpm-lock.yaml", "bun.lock"];

export const mapFilesToTargetPackageManager = (request: {
  readonly files: readonly string[];
}): Result<TargetPackageManager, TargetPackageManagerFailure> => {
  const lockfile = LOCKFILE_PRECEDENCE.find((candidate) => request.files.includes(candidate));
  if (lockfile !== undefined) return { outcome: "ok", value: TARGET_LOCKFILES[lockfile] };
  const unsupported = UNSUPPORTED_LOCKFILES.find((candidate) => request.files.includes(candidate));
  return unsupported === undefined
    ? { outcome: "failed", error: { kind: "lockfile-missing" } }
    : { outcome: "failed", error: { kind: "lockfile-unsupported", lockfile: unsupported } };
};
