import { CHECK_ADDRESS_SEPARATOR } from "../language-layer/check-address-text.ts";

export const symptomNameOf = (request: { readonly address: string }): string => request.address.split(CHECK_ADDRESS_SEPARATOR)[0] ?? request.address;
