import { EVERY_FORM } from "./import-allowances.ts";
import type { ImportBoundary } from "./import-confinement.ts";

export const ESLINT_MAJOR_BOUNDARIES: readonly ImportBoundary[] = [
  {
    name: "no ESLint major",
    holds: [/^/],
    leavesOut: [/^delivery\/install-proof\/consumer-proof\//],
    allowed: [{ kind: "specifier", specifier: /^(?!eslint(?:-9)?(?:\/|$))/, forms: EVERY_FORM }],
  },
];
