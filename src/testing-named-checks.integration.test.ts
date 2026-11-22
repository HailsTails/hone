import { assert, describe, expect, it } from "vitest";
import { checkConformanceOf, checkUnderTestOf, type CheckRequest } from "./testing.ts";
import { engineIdSchema } from "./infrastructure/hone-config-file/identifiers.ts";

const manifests = import.meta.glob(["./infrastructure/engines/*/*/*/piece.json"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const requests = Object.keys(manifests).map((path): CheckRequest => {
  const [, , , engine, symptom, check] = path.split("/");
  assert(symptom !== undefined && check !== undefined, path);
  return { check: `${symptom}#${check}`, engine: engineIdSchema.parse(engine) };
});

describe("installed named check examples", () => {
  it("discovers the independent class-keyword declarations for both engines", () => {
    expect(requests).toEqual(expect.arrayContaining([
      { check: "authored-class-or-this#class-keyword", engine: "walker" },
      { check: "authored-class-or-this#class-keyword", engine: "eslint" },
    ]));
  });

  it.each(requests)("$engine $check conforms to its named examples", async (request) => {
    expect(checkUnderTestOf(request)).toMatchObject({
      outcome: "ok",
      value: { ...request, examples: expect.arrayContaining([expect.objectContaining({ source: expect.any(String) })]) },
    });
    await expect(checkConformanceOf(request)).resolves.toEqual({ outcome: "ok", value: [] });
  });
});
