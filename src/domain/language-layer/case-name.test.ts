import { describe, expect, it } from "vitest";

import { findCaseNameFaults, mapTitleToCaseName } from "./case-name.ts";

describe("mapTitleToCaseName", () => {
  it.each([
    { title: "Checks conditions before its work", name: "checks-conditions-before-its-work" },
    { title: "Causes an effect (writes, logs)", name: "causes-an-effect" },
    { title: "Gives a value its type!", name: "gives-a-value-its-type" },
    { title: "Uses 2 ports", name: "uses-2-ports" },
  ])("names the case titled $title as $name", ({ title, name }) => {
    const mapped = mapTitleToCaseName({ title });

    expect(mapped).toBe(name);
  });
});

describe("findCaseNameFaults", () => {
  it("finds no fault when the name is the one its title gives", () => {
    const faults = findCaseNameFaults({
      name: "uses-2-ports",
      title: "Uses 2 ports",
    });

    expect(faults).toEqual([]);
  });

  it("names the name its title gives when the case names another", () => {
    const faults = findCaseNameFaults({
      name: "uses-ports",
      title: "Uses 2 ports",
    });

    expect(faults).toEqual([
      "cases names uses-ports, which its title Uses 2 ports names uses-2-ports",
    ]);
  });
});
