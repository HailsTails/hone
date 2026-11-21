import { describe, expect, it } from "vitest";
import {
  AFTER,
  AFTER_REPORT,
  AFTER_TRACKED,
  BEFORE,
  BEFORE_REPORT,
  BEFORE_TRACKED,
  checkedReport,
  GUIDE,
  RECORDS_FILE,
  SETTINGS_FILE,
  SETTINGS_TEXT_AFTER,
  SETTINGS_TEXT_BEFORE,
} from "../../../../tests/walkthrough-repositories.ts";

const FOUR_BLOCKS = 4;

describe("the adopting guide's worked example, run on version 2 through the shipped engines (CD-47: the shipped pieces and the fixture's own files are the assertion's subject; nothing is spawned or written)", () => {
  it("shows exactly the four blocks the test reads: the settings, the two reports and the record", () => {
    expect(GUIDE.blocks).toBe(FOUR_BLOCKS);
  });

  it("shows the settings file both repositories hold", () => {
    expect(GUIDE.settings).toEqual(SETTINGS_FILE);
    expect(SETTINGS_TEXT_AFTER).toBe(SETTINGS_TEXT_BEFORE);
  });

  it("shows the boundary record the fixed repository holds", () => {
    expect(GUIDE.records).toEqual(RECORDS_FILE);
  });

  it("fails before the fix with one finding per violation and none in the excluded generated folder, printing the report the guide shows and exiting 1", async () => {
    expect(await checkedReport({ repo: BEFORE, tracked: BEFORE_TRACKED })).toEqual(BEFORE_REPORT);
  });

  it("passes after the fix with the clock adapter answered by its boundary record, printing the report the guide shows and exiting 0", async () => {
    expect(await checkedReport({ repo: AFTER, tracked: AFTER_TRACKED })).toEqual(AFTER_REPORT);
  });
});
