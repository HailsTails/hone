import { describe, expect, it } from "vitest";

import { commentValueOf } from "./checks-comment-value.ts";

describe("commentValueOf", () => {
  it("gives a line comment's text after its slashes", () => {
    expect(commentValueOf({ text: "// eslint-disable-next-line hone/a" })).toBe(
      " eslint-disable-next-line hone/a",
    );
  });

  it("gives a block comment's text between its delimiters", () => {
    expect(commentValueOf({ text: "/* eslint-disable hone/a */" })).toBe(" eslint-disable hone/a ");
  });

  it("gives text that is not delimited as it is", () => {
    expect(commentValueOf({ text: "eslint-disable hone/a" })).toBe("eslint-disable hone/a");
  });

  it("gives an unterminated block opening as it is", () => {
    expect(commentValueOf({ text: "/* eslint-disable hone/a" })).toBe("/* eslint-disable hone/a");
  });
});
