import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { namespaceOwnershipRefusal } from "./namespace-ownership.ts";

const refusalFor = (request: { readonly address: string; readonly pluginNamespace: string }): string | undefined =>
  namespaceOwnershipRefusal({
    address: clauseAddressSchema.parse(request.address),
    pluginNamespace: request.pluginNamespace,
  });

describe("namespaceOwnershipRefusal", () => {
  it.each(["hone", "hone-cd1"])("leaves the hone rule set free to use the namespace %s", (pluginNamespace) => {
    expect(refusalFor({ address: "CD-14#class-syntax", pluginNamespace })).toBeUndefined();
  });

  it.each(["acme", "acme-extras"])("lets the acme rule set use the namespace %s", (pluginNamespace) => {
    expect(refusalFor({ address: "acme/ACME-1#console-calls", pluginNamespace })).toBeUndefined();
  });

  it.each(["hone", "hone-extras"])("refuses a team rule set the namespace %s, which belongs to Hone", (pluginNamespace) => {
    expect(refusalFor({ address: "acme/ACME-1#console-calls", pluginNamespace })).toMatch(/belongs to Hone/);
  });

  it.each(["other", "acmeco"])("refuses the acme rule set the namespace %s, which it does not own", (pluginNamespace) => {
    expect(refusalFor({ address: "acme/ACME-1#console-calls", pluginNamespace })).toMatch(/not owned by the rule set acme/);
  });
});
