export const CATALOGUE_NAME = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";

const WHOLE_CATALOGUE_NAME = new RegExp(`^${CATALOGUE_NAME}$`);

export const isCatalogueName = (text: string): boolean => WHOLE_CATALOGUE_NAME.test(text);
