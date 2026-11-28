import {
  COMPUTED_LOAD,
  NODE_BUILTIN_IMPORT,
  PACKAGE_OR_COMPUTED_IMPORT,
  RELATIVE_IMPORT,
  RELATIVE_IMPORT_OF_ANY_FORM,
  STATIC_FORMS,
  VITEST_IMPORT,
  ZOD_IMPORT,
} from "./import-allowances.ts";
import type { ImportBoundary } from "./import-confinement.ts";

const TEST_FILE = /\.test\.[^/]+$/;

const PLACED_TEST_FILE = /^(?:(?:src|rules|delivery)\/.*)?[^/]*\.test\.[^/]+$/;

const CONSUMER_PROOF = /^delivery\/install-proof\/consumer-proof\//;

const MECHANISM = /^src\/infrastructure\/engines\/(?:walker|eslint\/[^/]+)\//;

const RUNNER = /^src\/infrastructure\/engines\/[^/]+\/runner\//;

const PLATFORM_PORT = /^src\/infrastructure\/(?:node\/(?:.*\/)?|git\/)[^/]*-port\.[^/.]+$/;

const MODULE_LOADER_PORT = /^src\/infrastructure\/node\/modules\/module-loader-port\.ts$/;

const INSTALL_PROOF_PORTS = /^delivery\/install-proof\/install-proof-ports\.ts$/;

const BUNDLER_PORT = /^delivery\/packaging\/building\/esbuild-bundler-port\.ts$/;

const TYPESCRIPT_PARSE =
  /^src\/infrastructure\/engines\/walker\/runner\/toolchain\/typescript-parse\.ts$/;

const JSONC_PARSE = /^src\/infrastructure\/engines\/walker\/runner\/pieces\/jsonc-parse\.ts$/;

const ESLINT_TOOLCHAIN =
  /^src\/infrastructure\/engines\/eslint\/runner\/toolchain\/eslint-toolchain\.ts$/;

const ESLINT_INSTANCE =
  /^src\/infrastructure\/engines\/eslint\/runner\/toolchain\/eslint-instance\.ts$/;

const INLINE_CONFIG_PARSER =
  /^src\/infrastructure\/engines\/eslint\/runner\/native-exceptions\/inline-config-parser\.ts$/;

const NATIVE_RULES = /^src\/infrastructure\/engines\/eslint\/runner\/pieces\/native-rules\.ts$/;

const OXLINT_NAMING_PLUGIN =
  /^src\/infrastructure\/engines\/oxlint\/name-off-its-casing\/naming-convention\/naming-plugin\.ts$/;

const PROBE_AUDIT_PIECE =
  /^src\/infrastructure\/content-files\/rule-sets\/probe-rule-set\/mechanisms\/audit\//;

const PROBE_ESLINT_PIECE =
  /^src\/infrastructure\/content-files\/rule-sets\/probe-rule-set\/mechanisms\/eslint\//;

export const VENDOR_BOUNDARIES: readonly ImportBoundary[] = [
  {
    name: "core",
    holds: [/^src\//],
    leavesOut: [
      TEST_FILE,
      /^src\/(?:walker|eslint-plugin|rule-set|testing)\.ts$/,
      MECHANISM,
      /^src\/infrastructure\/content-files\/rule-sets\/(?:probe|team)-rule-set\//,
    ],
    allowed: [
      {
        kind: "relative-reach",
        reach:
          /^src\/(?!(?:eslint-plugin|rule-set|testing|walker)\.ts$|infrastructure\/engines\/(?:walker|eslint\/[^/]+)\/)/,
      },
      PACKAGE_OR_COMPUTED_IMPORT,
    ],
  },
  {
    name: "outside mechanisms",
    holds: [/^/],
    leavesOut: [
      PLACED_TEST_FILE,
      CONSUMER_PROOF,
      MECHANISM,
      /^vitest\.config\.ts$/,
      INSTALL_PROOF_PORTS,
      BUNDLER_PORT,
      PLATFORM_PORT,
      PROBE_AUDIT_PIECE,
      PROBE_ESLINT_PIECE,
      OXLINT_NAMING_PLUGIN,
    ],
    allowed: [RELATIVE_IMPORT, ZOD_IMPORT],
  },
  {
    name: "Oxlint naming plugin",
    holds: [OXLINT_NAMING_PLUGIN],
    leavesOut: [],
    allowed: [
      RELATIVE_IMPORT,
      ZOD_IMPORT,
      { kind: "specifier", specifier: /^oxlint\/plugins-dev$/, forms: ["type-only"] },
    ],
  },
  {
    name: "unlisted mechanisms",
    holds: [/^src\/infrastructure\/engines\/(?:walker|eslint)\/[^/]+$/],
    leavesOut: [TEST_FILE, /^src\/infrastructure\/engines\/eslint\/eslint-config-lookup\.ts$/],
    allowed: [],
  },
  {
    name: "runners",
    holds: [RUNNER],
    leavesOut: [
      TEST_FILE,
      /^src\/infrastructure\/engines\/eslint\/runner\/native-exceptions\/[^/]+\//,
      /^src\/infrastructure\/engines\/eslint\/runner\/projection\/projection-pair\//,
      /^src\/infrastructure\/engines\/eslint\/runner\/toolchain\/eslint-9\/eslint-9-engine\.ts$/,
      TYPESCRIPT_PARSE,
      JSONC_PARSE,
      ESLINT_INSTANCE,
      ESLINT_TOOLCHAIN,
      INLINE_CONFIG_PARSER,
      NATIVE_RULES,
    ],
    allowed: [RELATIVE_IMPORT, ZOD_IMPORT],
  },
  {
    name: "platform ports",
    holds: [PLATFORM_PORT],
    leavesOut: [TEST_FILE, MODULE_LOADER_PORT],
    allowed: [RELATIVE_IMPORT, ZOD_IMPORT, NODE_BUILTIN_IMPORT],
  },
  {
    name: "module loader port",
    holds: [MODULE_LOADER_PORT],
    leavesOut: [],
    allowed: [RELATIVE_IMPORT, ZOD_IMPORT, NODE_BUILTIN_IMPORT, COMPUTED_LOAD],
  },
  {
    name: "install proof ports",
    holds: [INSTALL_PROOF_PORTS],
    leavesOut: [],
    allowed: [RELATIVE_IMPORT, NODE_BUILTIN_IMPORT],
  },
  {
    name: "bundler port",
    holds: [BUNDLER_PORT],
    leavesOut: [],
    allowed: [
      RELATIVE_IMPORT,
      NODE_BUILTIN_IMPORT,
      { kind: "specifier", specifier: /^esbuild$/, forms: STATIC_FORMS },
    ],
  },
  {
    name: "typescript parse",
    holds: [TYPESCRIPT_PARSE],
    leavesOut: [],
    allowed: [
      RELATIVE_IMPORT,
      ZOD_IMPORT,
      { kind: "specifier", specifier: /^typescript$/, forms: ["type-only", "dynamic"] },
    ],
  },
  {
    name: "jsonc parse",
    holds: [JSONC_PARSE],
    leavesOut: [],
    allowed: [
      RELATIVE_IMPORT,
      ZOD_IMPORT,
      { kind: "specifier", specifier: /^jsonc-parser$/, forms: STATIC_FORMS },
    ],
  },
  {
    name: "ESLint toolchain",
    holds: [ESLINT_TOOLCHAIN],
    leavesOut: [],
    allowed: [
      RELATIVE_IMPORT,
      ZOD_IMPORT,
      {
        kind: "specifier",
        specifier: /^`\.\/\$\{folder\}\/eslint-\$\{major\}-boundary\.ts`$/,
        forms: ["dynamic"],
      },
      {
        kind: "specifier",
        specifier: /^@typescript-eslint\/eslint-plugin$/,
        forms: ["type-only", "dynamic"],
      },
      {
        kind: "specifier",
        specifier: /^(?:eslint|@typescript-eslint\/parser)$/,
        forms: ["dynamic"],
      },
    ],
  },
  {
    name: "ESLint instance",
    holds: [ESLINT_INSTANCE],
    leavesOut: [],
    allowed: [
      RELATIVE_IMPORT,
      ZOD_IMPORT,
      {
        kind: "specifier",
        specifier: /^(?:eslint|@typescript-eslint\/parser)$/,
        forms: ["type-only"],
      },
    ],
  },
  {
    name: "inline config parser",
    holds: [INLINE_CONFIG_PARSER],
    leavesOut: [],
    allowed: [
      RELATIVE_IMPORT,
      ZOD_IMPORT,
      { kind: "specifier", specifier: /^@eslint\/plugin-kit$/, forms: STATIC_FORMS },
    ],
  },
  {
    name: "native rules",
    holds: [NATIVE_RULES],
    leavesOut: [],
    allowed: [
      {
        kind: "specifier",
        specifier: /^(?:eslint\/use-at-your-own-risk|@typescript-eslint\/eslint-plugin)$/,
        forms: STATIC_FORMS,
      },
    ],
  },
  {
    name: "audit pieces",
    holds: [/^src\/infrastructure\/engines\/walker\/[^/]+\//, PROBE_AUDIT_PIECE],
    leavesOut: [RUNNER, TEST_FILE],
    allowed: [
      RELATIVE_IMPORT,
      ZOD_IMPORT,
      { kind: "specifier", specifier: /^typescript$/, forms: ["type-only"] },
    ],
  },
  {
    name: "ESLint pieces",
    holds: [/^src\/infrastructure\/engines\/eslint\/[^/]+\//, PROBE_ESLINT_PIECE],
    leavesOut: [RUNNER, TEST_FILE],
    allowed: [
      RELATIVE_IMPORT,
      ZOD_IMPORT,
      { kind: "specifier", specifier: /^eslint$/, forms: ["type-only"] },
    ],
  },
  {
    name: "tests",
    holds: [TEST_FILE],
    leavesOut: [CONSUMER_PROOF],
    allowed: [RELATIVE_IMPORT_OF_ANY_FORM, VITEST_IMPORT],
  },
];
