import { describe, expect, it } from "vitest";
import { banStandingOf, dependencyOf } from "./outside-dependency.ts";

describe("dependencyOf", () => {
  it.each([
    { specifier: "lodash", dependency: "lodash" },
    { specifier: "lodash/fp", dependency: "lodash" },
    { specifier: "@date-fns/tz", dependency: "@date-fns/tz" },
    { specifier: "@date-fns/tz/locale", dependency: "@date-fns/tz" },
    { specifier: "JSONStream", dependency: "JSONStream" },
    { specifier: "npm:lodash", dependency: "lodash" },
    { specifier: "npm:lodash@4/fp", dependency: "lodash" },
    { specifier: "npm:@date-fns/tz@1.2.0/locale", dependency: "@date-fns/tz" },
  ])("reads $specifier as the outside dependency $dependency, since a subpath of a dependency is that dependency", ({ specifier, dependency }) => {
    expect(dependencyOf({ specifier })).toBe(dependency);
  });
});

describe("banStandingOf", () => {
  it("holds a dependency the catalogue names as banned", () => {
    expect(banStandingOf({ namedBans: [{ outsideDependency: "lodash" }], dependency: "lodash" })).toBe("banned");
  });

  it.each([{ dependency: "Lodash" }, { dependency: "LODASH" }])("holds $dependency banned, since a ban is not beaten by case", ({ dependency }) => {
    expect(banStandingOf({ namedBans: [{ outsideDependency: "lodash" }], dependency })).toBe("banned");
  });

  it("holds a sibling package not banned, since the ban list is data", () => {
    expect(banStandingOf({ namedBans: [{ outsideDependency: "lodash" }], dependency: "lodash-es" })).toBe("not-banned");
  });
});
