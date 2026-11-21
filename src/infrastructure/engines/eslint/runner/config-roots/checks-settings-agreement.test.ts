import { describe, expect, it } from "vitest";
import { SETTINGS_FILE_NAME as CORE_SETTINGS_FILE_NAME } from "../../../../hone-config-file/settings-sources.ts";
import { SETTINGS_FILE_NAME } from "./checks-nested-repositories.ts";

describe("the runner's local copy of the version 2 settings file name", () => {
  it("names the version 2 settings file as core does", () => {
    expect(SETTINGS_FILE_NAME).toBe(CORE_SETTINGS_FILE_NAME);
  });
});
