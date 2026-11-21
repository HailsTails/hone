import { describe, expect, it } from "vitest";
import type { AbsolutePath } from "./absolute-path-types.ts";
import type { Branded } from "./branded.ts";
import type { ClauseId, DisciplineId, MechanismId, RuleSetName } from "../rule-set/identifier-types.ts";
import type { RepoPath } from "./repo-path-types.ts";
import type { Equal } from "../../infrastructure/engines/protocol/runner-module/type-equality.ts";

type Brands = {
  readonly repoPath: RepoPath;
  readonly absolutePath: AbsolutePath;
  readonly ruleSetName: RuleSetName;
  readonly disciplineId: DisciplineId;
  readonly clauseId: ClauseId;
  readonly mechanismId: MechanismId;
};

type BrandsAssignableToAnother = {
  readonly [Left in keyof Brands]: {
    readonly [Right in Exclude<keyof Brands, Left>]: Brands[Left] extends Brands[Right] ? Right : never;
  }[Exclude<keyof Brands, Left>];
}[keyof Brands];

const noBrandIsAnother: Equal<BrandsAssignableToAnother, never> = true;

const plainTextIsNotBranded: Equal<string extends Branded<string, "Any"> ? true : false, false> = true;

describe("Branded", () => {
  it("gives every brand a distinct name, so no branded value passes for another", () => {
    expect(noBrandIsAnother).toBe(true);
  });

  it("does not accept plain text where a branded value is expected", () => {
    expect(plainTextIsNotBranded).toBe(true);
  });
});
