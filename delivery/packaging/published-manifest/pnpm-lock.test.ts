import { describe, expect, it } from "vitest";

import { lockedDependenciesOf } from "./pnpm-lock.ts";

const lockOf = (request: {
  readonly header: string;
  readonly importers: string;
}): string => `${request.header}
${request.importers}
snapshots:

  zod@4.4.3: {}
`;

const HEADER = "lockfileVersion: '9.0'";

const IMPORTERS = `importers:

  .:
    dependencies:
      '@eslint/plugin-kit':
        specifier: 0.7.3
        version: 0.7.3
      zod:
        specifier: 4.4.3
        version: 4.4.3
    devDependencies:
      vitest:
        specifier: 4.1.11
        version: 4.1.11(@types/node@25.9.1)
`;

const LOCK = lockOf({ header: HEADER, importers: IMPORTERS });

const importersHoldingZodAt = (request: { readonly version: string }): string => `importers:

  .:
    dependencies:
      zod:
        specifier: ${request.version}
        version: ${request.version}
`;

const lockHoldingZodAt = (request: { readonly version: string }): string =>
  lockOf({ header: HEADER, importers: importersHoldingZodAt(request) });

const UNSUPPORTED_VERSION = lockOf({ header: "lockfileVersion: '8.0'", importers: IMPORTERS });

const WITHOUT_IMPORTERS = lockOf({ header: HEADER, importers: "" });

const WITHOUT_ROOT_IMPORTER = lockOf({
  header: HEADER,
  importers: "importers:\n\n  other:\n    dependencies: {}\n",
});

const DOUBLE_QUOTED_KEY = lockOf({
  header: HEADER,
  importers: `importers:

  .:
    dependencies:
      "@eslint/plugin-kit":
        specifier: 0.7.3
        version: 0.7.3
`,
});

const DEPENDENCIES = ["zod", "@eslint/plugin-kit"];

describe("lockedDependenciesOf", () => {
  it("reads the version the lock holds for each of core's dependencies, development tools left out", () => {
    expect(lockedDependenciesOf({ lockText: LOCK, dependencies: DEPENDENCIES })).toEqual({
      outcome: "ok",
      value: [
        { name: "zod", version: "4.4.3" },
        { name: "@eslint/plugin-kit", version: "0.7.3" },
      ],
    });
  });

  it("reads a version without the peer suffix the lock adds to it", () => {
    expect(
      lockedDependenciesOf({
        lockText: lockHoldingZodAt({ version: "4.4.3(typescript@6.0.3)" }),
        dependencies: ["zod"],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ name: "zod", version: "4.4.3" }],
    });
  });
});

describe("lockedDependenciesOf on a lock it does not read", () => {
  it("fails naming a dependency of core the lock does not hold", () => {
    expect(lockedDependenciesOf({ lockText: LOCK, dependencies: ["zod", "esbuild"] })).toEqual({
      outcome: "failed",
      error: "core depends on esbuild, which the lock does not hold",
    });
  });

  it("fails naming a lockfileVersion other than the one it reads", () => {
    expect(
      lockedDependenciesOf({ lockText: UNSUPPORTED_VERSION, dependencies: DEPENDENCIES }),
    ).toEqual({
      outcome: "failed",
      error: "the lock's lockfileVersion is 8.0, which is not the supported 9.0",
    });
  });

  it("fails naming a section the lock lacks", () => {
    expect([
      lockedDependenciesOf({ lockText: WITHOUT_IMPORTERS, dependencies: DEPENDENCIES }),
      lockedDependenciesOf({ lockText: WITHOUT_ROOT_IMPORTER, dependencies: DEPENDENCIES }),
    ]).toEqual([
      { outcome: "failed", error: "the lock holds no importers section" },
      { outcome: "failed", error: "the lock holds no importer for the repository root" },
    ]);
  });

  it("fails naming a double-quoted key it does not read", () => {
    expect(
      lockedDependenciesOf({ lockText: DOUBLE_QUOTED_KEY, dependencies: DEPENDENCIES }),
    ).toEqual({
      outcome: "failed",
      error:
        'the lock holds a double-quoted key, which this reader does not read: "@eslint/plugin-kit":',
    });
  });

  it("fails naming each value of the root importer that is not a plain semver version", () => {
    expect([
      lockedDependenciesOf({
        lockText: lockHoldingZodAt({ version: "link:../zod" }),
        dependencies: ["zod"],
      }),
      lockedDependenciesOf({
        lockText: lockHoldingZodAt({ version: "file:../zod" }),
        dependencies: ["zod"],
      }),
      lockedDependenciesOf({
        lockText: lockHoldingZodAt({ version: "workspace:*" }),
        dependencies: ["zod"],
      }),
      lockedDependenciesOf({
        lockText: lockHoldingZodAt({ version: "npm:zod@4.4.3" }),
        dependencies: ["zod"],
      }),
      lockedDependenciesOf({
        lockText: lockHoldingZodAt({ version: "other@4.4.3" }),
        dependencies: ["zod"],
      }),
      lockedDependenciesOf({
        lockText: lockHoldingZodAt({ version: "latest" }),
        dependencies: ["zod"],
      }),
      lockedDependenciesOf({
        lockText: lockHoldingZodAt({ version: "{a: 1}" }),
        dependencies: ["zod"],
      }),
    ]).toEqual([
      { outcome: "failed", error: "the root importer holds a link: value for zod: link:../zod" },
      { outcome: "failed", error: "the root importer holds a file: value for zod: file:../zod" },
      {
        outcome: "failed",
        error: "the root importer holds a workspace: value for zod: workspace:*",
      },
      { outcome: "failed", error: "the root importer holds an alias for zod: npm:zod@4.4.3" },
      { outcome: "failed", error: "the root importer holds an alias for zod: other@4.4.3" },
      {
        outcome: "failed",
        error: "the root importer holds a version that is not semver for zod: latest",
      },
      { outcome: "failed", error: "the root importer holds a flow value for zod: {a: 1}" },
    ]);
  });

  it("fails naming a dependency the root importer holds with no version", () => {
    expect(
      lockedDependenciesOf({
        lockText: lockOf({
          header: HEADER,
          importers:
            "importers:\n\n  .:\n    dependencies:\n      zod:\n        specifier: 4.4.3\n",
        }),
        dependencies: ["zod"],
      }),
    ).toEqual({ outcome: "failed", error: "the root importer holds an empty version for zod" });
  });
});
