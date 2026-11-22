import { assert, describe, expect, it, vi } from "vitest";

import type { PackageLocationPort } from "../../../../node/modules/package-location-port.ts";
import { defaultTypeScriptModules, type TypeScriptModules } from "./typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
  type TypeScriptPeers,
  typeScriptPeersNamed,
} from "./typescript-toolchain.ts";

const INSTALL_ROOT = "/repo/tools/hone";

const DEVELOPMENT_ROOT = `${import.meta.dirname}/../../../../../..`;

const DEVELOPMENT_PEERS = defaultTypeScriptPeers({
  installRoot: DEVELOPMENT_ROOT,
  installForm: "source",
});

const FLOOR_PEERS: TypeScriptPeers = typeScriptPeersNamed({
  installRoot: DEVELOPMENT_ROOT,
  installForm: "source",
  packageName: "typescript-floor",
});

const SUPPORTED_LINES: readonly {
  readonly line: string;
  readonly peers: TypeScriptPeers;
  readonly version: RegExp;
}[] = [
  { line: "typescript", peers: DEVELOPMENT_PEERS, version: /^6\./ },
  { line: "typescript-floor", peers: FLOOR_PEERS, version: /^4\.8\.4$/ },
];

const TWO_STATEMENTS = "const a = 1;\nconst b = 2;\n";

const typescriptAt = (request: { readonly version: string }): TypeScriptModules => ({
  typescript: () =>
    defaultTypeScriptModules
      .typescript()
      .then((loaded) => ({ default: { ...loaded.default, version: request.version } })),
});

const locatedAt = (request: { readonly location: string }): PackageLocationPort => ({
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: () => ({ outcome: "ok", value: request.location }),
});

describe("loadParsePort over each supported TypeScript line in the development install", () => {
  it.each(SUPPORTED_LINES)("parses with the $line line", async ({ line, peers, version }) => {
    const loaded = await loadParsePort({ peers });
    assert(loaded.outcome === "ok", `the ${line} line loads from the development install`);
    assert(
      version.test(loaded.value.syntaxApi.version),
      `the ${line} line runs TypeScript ${loaded.value.syntaxApi.version}`,
    );
    expect(
      loaded.value.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS }).statements,
    ).toHaveLength(2);
  });
});

describe("loadParsePort when typescript is missing, unsupported or shadowed", () => {
  it.each(["4.8.3", "7.0.0", "6.1.0-dev.20261101"])(
    "names the installed typescript %s as outside >=4.8.4 <7.0.0",
    async (version) => {
      await expect(
        loadParsePort({
          peers: {
            location: locatedAt({ location: "/repo/node_modules/typescript/lib/typescript.js" }),
            modules: typescriptAt({ version }),
          },
        }),
      ).resolves.toEqual({
        outcome: "failed",
        error: {
          kind: "toolchain-unavailable",
          peers: [
            {
              packageName: "typescript",
              peer: "required",
              supported: ">=4.8.4 <7.0.0",
              found: version,
            },
          ],
        },
      });
    },
  );

  it("names typescript as shadowed when it resolves from inside the core install, and never loads it", async () => {
    const typescript = vi.fn<TypeScriptModules["typescript"]>();
    await expect(
      loadParsePort({
        peers: {
          location: locatedAt({
            location: `${INSTALL_ROOT}/node_modules/typescript/lib/typescript.js`,
          }),
          modules: { typescript },
        },
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "toolchain-shadowed", packageName: "typescript" },
    });
    expect(typescript).not.toHaveBeenCalled();
  });

  it("names typescript unloadable when the package it is loaded from by name is not TypeScript", async () => {
    await expect(
      loadParsePort({
        peers: typeScriptPeersNamed({
          installRoot: DEVELOPMENT_ROOT,
          installForm: "source",
          packageName: "zod",
        }),
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "toolchain-unavailable",
        peers: [{ packageName: "typescript", found: expect.stringMatching(/^unloadable: /) }],
      },
    });
  });
});
