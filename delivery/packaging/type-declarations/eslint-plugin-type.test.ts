import { describe, expect, it } from "vitest";
import { createDefaultTypeScriptDeclarationPort } from "./typescript-declaration-port.ts";

const CONSUMER_TYPING = "delivery/install-proof/consumer-proof/plugin-type/eslint-plugin-is-eslints.ts";

const emitted = await createDefaultTypeScriptDeclarationPort({}).emit({ sourceRoot: `${import.meta.dirname}/../../..`, entryPoints: [CONSUMER_TYPING] });

describe("the plugin type the eslint-plugin entry ships, type-checked in memory by the package build's own port (CD-47: nothing is spawned or written)", () => {
  it("is ESLint's own plugin type to a consumer, alone and under a namespace in a flat config", () => {
    expect(emitted).toMatchObject({ outcome: "ok", value: { diagnostics: [] } });
  });
});
