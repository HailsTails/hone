import { describe, expect, it } from "vitest";
import { dependencyRangesOf, packageVersionOf, peerKindsOf, peerNamesOf, publishManifestOf } from "./published-manifest.ts";

const DEVELOPMENT_MANIFEST = {
  version: "0.0.0",
  private: true,
  type: "module",
  description: "Runs disciplines.",
  keywords: ["disciplines", "code-quality"],
  author: "Example Author",
  license: "MIT-0",
  engines: { node: ">=22.18.0" },
  scripts: { test: "vitest run" },
  dependencies: { zod: "^4.4.3" },
  peerDependencies: { eslint: "^9.28.0 || ^10.0.0", typescript: ">=4.8.4 <7.0.0" },
  peerDependenciesMeta: { eslint: { optional: true } },
  devDependencies: { vitest: "4.1.11" },
};

const published = (developmentManifest: string) =>
  publishManifestOf({
    developmentManifest,
    identity: {
      name: "Provisional",
      packageName: "provisional-core",
      reservedEslintNamespace: "provisional-core",
      command: "provisional",
      ownRuleSet: "provisional",
      description: "Checks a repository against its disciplines.",
      repository: "https://github.com/example/provisional",
      unrelatedNpmPackage: "provisional",
    },
    command: "src/hone.js",
    files: ["LICENSE", "chunks", "core", "mechanisms"],
    exported: ["mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js"],
    typed: [
      { subpath: "audit", declaration: "api/audit.d.ts", module: "api/audit.mjs" },
      { subpath: "rule-set", declaration: "api/rule-set.d.ts", module: "api/rule-set.mjs" },
    ],
    nodeRange: "^22.18.0 || >=24",
  });

describe("publishManifestOf", () => {
  it("names, describes, tags and credits the package for consumers, links its repository, home page and issues so npm trusted publishing can match the repository, publishes publicly so a scoped name is not restricted, names its one command, exposes only its manifest, each typed entry with its declaration under the types condition and its module as the default, and the modules a projection imports by bare path, carries the optional peers, and declares its dependencies at the ranges the development manifest declares", () => {
    expect(published(JSON.stringify(DEVELOPMENT_MANIFEST))).toEqual({
      outcome: "ok",
      value: `${JSON.stringify(
        {
          name: "provisional-core",
          version: "0.0.0",
          description: "Checks a repository against its disciplines.",
          keywords: ["disciplines", "code-quality"],
          license: "MIT-0",
          author: "Example Author",
          repository: { type: "git", url: "git+https://github.com/example/provisional.git" },
          homepage: "https://github.com/example/provisional#readme",
          bugs: { url: "https://github.com/example/provisional/issues" },
          publishConfig: { access: "public" },
          type: "module",
          bin: { provisional: "src/hone.js" },
          exports: {
            "./package.json": "./package.json",
            "./audit": { types: "./api/audit.d.ts", default: "./api/audit.mjs" },
            "./rule-set": { types: "./api/rule-set.d.ts", default: "./api/rule-set.mjs" },
            "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js": "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js",
          },
          files: ["LICENSE", "chunks", "core", "mechanisms"],
          engines: { node: "^22.18.0 || >=24" },
          dependencies: { zod: "^4.4.3" },
          peerDependencies: { eslint: "^9.28.0 || ^10.0.0", typescript: ">=4.8.4 <7.0.0" },
          peerDependenciesMeta: { eslint: { optional: true } },
        },
        null,
        2,
      )}\n`,
    });
  });

  it("names the development manifest invalid when it lacks the peers", () => {
    const { peerDependencies: _peers, ...withoutPeers } = DEVELOPMENT_MANIFEST;
    expect(published(JSON.stringify(withoutPeers))).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });

  it("names the development manifest invalid when it lacks the dependencies", () => {
    const { dependencies: _dependencies, ...withoutDependencies } = DEVELOPMENT_MANIFEST;
    expect(published(JSON.stringify(withoutDependencies))).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });

  it("names the development manifest invalid when it lacks keywords or an author", () => {
    const { keywords: _keywords, ...withoutKeywords } = DEVELOPMENT_MANIFEST;
    const { author: _author, ...withoutAuthor } = DEVELOPMENT_MANIFEST;
    expect(published(JSON.stringify(withoutKeywords))).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
    expect(published(JSON.stringify(withoutAuthor))).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });

  it("names the development manifest invalid when it is not JSON", () => {
    expect(published("{")).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("peerNamesOf", () => {
  it("names each declared peer", () => {
    expect(peerNamesOf({ developmentManifest: JSON.stringify(DEVELOPMENT_MANIFEST) })).toEqual({ outcome: "ok", value: ["eslint", "typescript"] });
  });

  it("names the development manifest invalid when it declares no peers", () => {
    expect(peerNamesOf({ developmentManifest: "{}" })).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("peerKindsOf", () => {
  it("names each declared peer optional when its meta marks it so, and required otherwise", () => {
    expect(peerKindsOf({ developmentManifest: JSON.stringify(DEVELOPMENT_MANIFEST) })).toEqual({
      outcome: "ok",
      value: { eslint: "optional", typescript: "required" },
    });
  });

  it("names every declared peer required when the manifest has no peer metadata", () => {
    expect(peerKindsOf({ developmentManifest: '{ "peerDependencies": { "typescript": ">=4.8.4" } }' })).toEqual({
      outcome: "ok",
      value: { typescript: "required" },
    });
  });

  it("names the development manifest invalid when it declares no peers", () => {
    expect(peerKindsOf({ developmentManifest: "{}" })).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("dependencyRangesOf", () => {
  it("reads each runtime dependency at the range the development manifest declares, leaving out development ones", () => {
    expect(dependencyRangesOf({ developmentManifest: JSON.stringify(DEVELOPMENT_MANIFEST) })).toEqual({ outcome: "ok", value: { zod: "^4.4.3" } });
  });

  it("names the development manifest invalid when it declares no dependencies", () => {
    expect(dependencyRangesOf({ developmentManifest: "{}" })).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("packageVersionOf", () => {
  it("reads the version the package is built at", () => {
    expect(packageVersionOf({ developmentManifest: JSON.stringify(DEVELOPMENT_MANIFEST) })).toEqual({ outcome: "ok", value: "0.0.0" });
  });

  it("names the development manifest invalid when it declares no version", () => {
    expect(packageVersionOf({ developmentManifest: "{}" })).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});