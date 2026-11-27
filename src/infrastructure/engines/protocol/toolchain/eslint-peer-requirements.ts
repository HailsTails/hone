import type { ToolchainRequirement } from "./toolchain-requirement.ts";

export const ESLINT_REQUIREMENT: ToolchainRequirement = {
  packageName: "eslint",
  peer: "optional",
  lines: [
    { floor: "9.39.5", below: "10.0.0" },
    { floor: "10.15.0", below: "11.0.0" },
  ],
};

export const TYPESCRIPT_ESLINT_PARSER_REQUIREMENT: ToolchainRequirement = {
  packageName: "@typescript-eslint/parser",
  peer: "optional",
  lines: [{ floor: "8.73.0", below: "9.0.0" }],
};

export const TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT: ToolchainRequirement = {
  packageName: "@typescript-eslint/eslint-plugin",
  peer: "optional",
  lines: [{ floor: "8.73.0", below: "9.0.0" }],
};

export const ESLINT_TOOLCHAIN_REQUIREMENTS: readonly ToolchainRequirement[] = [
  ESLINT_REQUIREMENT,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
];
