import type { Edition, EditionReach } from "./edition-types.ts";

export const EDITION_PATTERN = /^[1-9][0-9]*$/;

export const isEdition = (text: string): text is Edition => EDITION_PATTERN.test(text);

const ordinalOf = (request: { readonly edition: Edition }): number => Number(request.edition);

export const editionReaches = (request: {
  readonly edition: Edition;
  readonly introducedIn: Edition;
}): EditionReach =>
  ordinalOf({ edition: request.edition }) >= ordinalOf({ edition: request.introducedIn })
    ? "reached"
    : "not-reached";

export const editionOrder = (request: {
  readonly editions: readonly Edition[];
}): "ascending" | "unordered" =>
  request.editions.every((edition, index) =>
    request.editions
      .slice(0, index)
      .every((earlier) => ordinalOf({ edition: earlier }) < ordinalOf({ edition })),
  )
    ? "ascending"
    : "unordered";
