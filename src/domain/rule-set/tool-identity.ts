export type ToolIdentity = {
  readonly name: string;
  readonly packageName: string;
  readonly command: string;
  readonly ownRuleSet: string;
  readonly reservedEslintNamespace: string;
  readonly description: string;
  readonly repository: string;
  readonly unrelatedNpmPackage: string;
};

const identified = <Identity extends ToolIdentity>(identity: Identity): Identity => identity;

export const TOOL_IDENTITY = identified({
  name: "Hone",
  packageName: "@hailstails/hone",
  command: "hone",
  ownRuleSet: "hone",
  reservedEslintNamespace: "hone-core",
  description:
    "Checks a repository against the disciplines it selects, applies its recorded exceptions and prints one verdict.",
  repository: "https://github.com/HailsTails/hone",
  unrelatedNpmPackage: "hone",
} as const);

const SCOPE_MARKER = "@";

const SCOPE_SEPARATOR = "/";

const FILE_STEM_SEPARATOR = "-";

export const packageFileStemOf = (request: { readonly packageName: string }): string => {
  const unscoped = request.packageName.startsWith(SCOPE_MARKER)
    ? request.packageName.slice(SCOPE_MARKER.length)
    : request.packageName;
  return unscoped.replace(SCOPE_SEPARATOR, FILE_STEM_SEPARATOR);
};
