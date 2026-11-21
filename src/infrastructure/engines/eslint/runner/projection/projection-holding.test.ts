import { describe, expect, it } from "vitest";
import type { ExceptionRecord } from "../../../../discipline-exceptions-folder/exception-records.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { VERSION_ONE_CAUSAL_WHY_CHAIN } from "../../../../../../tests/version-one-causal-why-chain.ts";
import { projectionHolding } from "./projection-holding.ts";

const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");
const FOR_OF = clauseAddressSchema.parse("CD-15#no-for-of");
const ESLINT = mechanismIdSchema.parse("eslint");
const FACTORY = repoPathSchema.parse("src/factory.ts");
const OTHER_FILE = repoPathSchema.parse("src/a.ts");

const FACTORY_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source: "fictional unit fixture mechanisms/eslint/runner/projection-holding.test.ts#FACTORY_LOCATION; not historical authorisation",
  },
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: FACTORY,
  reason: "the wrapping factory for the library",
};

const FACTORY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: FACTORY,
  reason: "Inherited class awaiting paydown",
};

const CLAUSE_WIDE: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  reason: "Class syntax carved out during migration",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

describe("projectionHolding", () => {
  it("is projected-off for the file an authorised location names, on its clause", () => {
    expect(projectionHolding({ records: [FACTORY_LOCATION], clause: CLASS_SYNTAX, file: FACTORY })).toBe("projected-off");
  });

  it("is projected-off for the file a file carve-out names, on its clause", () => {
    expect(projectionHolding({ records: [FACTORY_CARVE_OUT], clause: CLASS_SYNTAX, file: FACTORY })).toBe("projected-off");
  });

  it("is projected-off for any file under a clause-wide carve-out on its clause", () => {
    expect(projectionHolding({ records: [CLAUSE_WIDE], clause: CLASS_SYNTAX, file: OTHER_FILE })).toBe("projected-off");
  });

  it("is not-held for a file no record names", () => {
    expect(projectionHolding({ records: [FACTORY_LOCATION], clause: CLASS_SYNTAX, file: OTHER_FILE })).toBe("not-held");
  });

  it("is not-held for a file whose record names another clause", () => {
    expect(projectionHolding({ records: [FACTORY_LOCATION], clause: FOR_OF, file: FACTORY })).toBe("not-held");
  });

  it("is not-held under a clause-wide carve-out on another clause", () => {
    expect(projectionHolding({ records: [CLAUSE_WIDE], clause: FOR_OF, file: FACTORY })).toBe("not-held");
  });

  it("is not-held when there are no records", () => {
    expect(projectionHolding({ records: [], clause: CLASS_SYNTAX, file: FACTORY })).toBe("not-held");
  });
});
