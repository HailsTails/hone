import { assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../../src/infrastructure/content-files/absolute-path.ts";
import { readBoundCatalogue } from "../../../src/infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import { namedChecksRunner as eslintRunner } from "../../../src/infrastructure/engines/eslint/runner/runner.ts";
import { namedChecksRunner as oxlintRunner } from "../../../src/infrastructure/engines/oxlint/runner/runner.ts";
import { namedChecksRunner as walkerRunner } from "../../../src/infrastructure/engines/walker/runner/runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultDirectoryPort } from "../../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { createBlockFlagsPort } from "./block-flags.ts";
import { createDefaultTypeErrorsPort } from "./block-type-errors.ts";
import { readCheckBindings } from "./check-bindings.ts";
import { findExampleRefusals } from "./example-refusals.ts";
import { createDefaultFlaggedFormsPort } from "./flagged-forms.ts";
import { readListedPieces } from "./piece-listing.ts";
import { readRecipePages } from "./recipe-pages.ts";

describe("the examples on this repository's recipe pages", () => {
  it("answer every form of every check, each before block is flagged with the form it answers, and each after block compiles and is flagged by no check", async () => {
    const directory = createDefaultDirectoryPort({});
    const fileText = createDefaultFileTextPort({});
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", "..", ".."] }),
    );
    const holding = readBoundCatalogue({
      ruleSet: "hone",
      inheritedRecordKinds: [],
      directory,
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

    const pieces = readListedPieces({ repoRoot, directory, fileText, path });
    assert(pieces.outcome === "ok", "the piece files list");

    const refusals = await findExampleRefusals({
      checks,
      pieces: pieces.value,
      bindings: bindings.value,
      pages: readRecipePages({ recipes, ruleSetRoot: repoRoot, fileText, path }),
      typeErrors: createDefaultTypeErrorsPort({ syntaxApi: parse.value.syntaxApi, repoRoot }),
      flags: createBlockFlagsPort({
        runners: { walker: walkerRunner, eslint: eslintRunner, oxlint: oxlintRunner },
      }),
      flaggedForms: createDefaultFlaggedFormsPort({
        parse: parse.value,
        repoRoot,
        fileText,
        path,
      }),
    });

    expect(refusals).toEqual([]);
  });
});
