import { assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../../src/infrastructure/content-files/absolute-path.ts";
import { readBoundCatalogue } from "../../../src/infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultDirectoryPort } from "../../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { createBlockFlagsPort } from "./block-flags.ts";
import { createTypeErrorsPort } from "./block-type-errors.ts";
import { readCheckBindings } from "./check-bindings.ts";
import { findExampleRefusals } from "./example-refusals.ts";
import { createFlaggedFormsPort } from "./flagged-forms.ts";
import { readRecipePages } from "./recipe-pages.ts";

describe("the examples on this repository's recipe pages", () => {
  it("answer every form of every check, each before block is flagged with the form it answers, and each after block compiles and is flagged by no check", async () => {
    const fileText = createDefaultFileTextPort({});
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", "..", ".."] }),
    );
    const holding = readBoundCatalogue({
      ruleSet: "hone",
      inheritedRecordKinds: [],
      directory: createDefaultDirectoryPort({}),
      fileText,
      path,
      ruleSetRoot: repoRoot,
      installRoot: repoRoot,
    });
    assert(holding.outcome === "ok", "the shipped catalogue reads");
    assert(holding.value.held === "catalogue", "the shipped catalogue is present");
    const { checks, recipes } = holding.value.catalogue;
    const parse = await loadParsePort({
      peers: defaultTypeScriptPeers({ installRoot: repoRoot, installForm: "source" }),
    });
    assert(parse.outcome === "ok", "the typescript line loads from the development install");
    const bindings = readCheckBindings({ checks, repoRoot, fileText, path });
    assert(bindings.outcome === "ok", "the pieces of the checks read");

    const refusals = await findExampleRefusals({
      checks,
      pages: readRecipePages({ recipes, ruleSetRoot: repoRoot, fileText, path }),
      typeErrors: createTypeErrorsPort({ syntaxApi: parse.value.syntaxApi, repoRoot }),
      flags: createBlockFlagsPort({ bindings: bindings.value }),
      flaggedForms: createFlaggedFormsPort({
        parse: parse.value,
        repoRoot,
        fileText,
        path,
        bindings: bindings.value,
      }),
    });

    expect(refusals).toEqual([]);
  });
});
