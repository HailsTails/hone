import { describe, expect, it } from "vitest";
import { PUBLIC_TYPE_ENTRIES } from "./package-declarations.ts";
import { createDefaultTypeScriptDeclarationPort } from "./typescript-declaration-port.ts";
import { publicTypeReachOf } from "../../../tests/public-type-reach.ts";
import { defaultParsePort } from "../../../tests/typescript-parse-port.ts";

const ENTRY_SOURCES = ["src/audit.ts", "src/eslint-plugin.ts", "src/rule-set.ts", "src/testing.ts"];

const reach = publicTypeReachOf({
  syntaxApi: defaultParsePort.syntaxApi,
  emitted: await createDefaultTypeScriptDeclarationPort({}).emit({ sourceRoot: `${import.meta.dirname}/../../..`, entryPoints: ENTRY_SOURCES }),
  entries: PUBLIC_TYPE_ENTRIES,
  requiredPeers: ["typescript"],
});

describe("the declarations the public type entries ship, emitted in memory by the package build's own port (CD-47: nothing is spawned or written)", () => {
  it("emit every entry with no diagnostic and publish every declaration they reach", () => {
    expect(reach.problems).toEqual([]);
  });

  it("import no package but typescript from the audit entry, and none at all from the eslint-plugin, rule-set and testing entries", () => {
    expect(reach.entries).toMatchObject({
      audit: { packageImports: ["typescript"] },
      "eslint-plugin": { packageImports: [] },
      "rule-set": { packageImports: [] },
      testing: { packageImports: [] },
    });
  });

  it("reach from the eslint-plugin entry only its own declaration, which names its plugin type in its own words, never ESLint's", () => {
    expect(reach.entries).toMatchObject({ "eslint-plugin": { reached: ["src/eslint-plugin.d.ts"] } });
  });

  it("reach no internal port, toolchain or tool identity from the audit entry", () => {
    expect(reach.entries).toMatchObject({
      audit: {
        reached: expect.not.arrayContaining([
          expect.stringMatching(
            /^src\/(?:infrastructure\/engines\/protocol\/toolchain\/toolchain-requirement|application\/ports\/runner-failure(?:-types)?|infrastructure\/node\/modules\/package-location-port|infrastructure\/node\/modules\/install-layout|domain\/rule-set\/tool-identity)\.d\.ts$/,
          ),
        ]),
      },
    });
  });

  it("ship no declaration but an entry's own that claims an exported value", () => {
    expect(reach.valueDeclaring).toEqual([]);
  });

  it("declare folderScope, editionReaches and isEdition from the audit entry, the three testing functions from the testing entry, only the default export from the eslint-plugin entry, and no named value from the rule-set entry", () => {
    expect(reach.entryValues).toEqual({ audit: ["folderScope", "editionReaches", "isEdition"], "eslint-plugin": ["export default plugin;"], "rule-set": [], testing: ["clauseConformanceOf", "clauseUnderTestOf", "repoPathOf"] });
  });

  it("ship no declaration that mentions zod", () => {
    expect(reach.zodMentioning).toEqual([]);
  });
});
