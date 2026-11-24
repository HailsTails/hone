import {
  type CheckAddressText,
  checkAddressTextOf,
} from "../../../src/domain/language-layer/check-address-text.ts";
import type {
  AnsweredForm,
  CheckContent,
  RecipeExample,
} from "../../../src/domain/language-layer/symptom-catalogue.ts";
import type { Result } from "../../../src/domain/result.ts";
import type {
  BlockFlag,
  BlockFlagsPort,
  BlockTypeError,
  FlaggedFormsPort,
  TypeErrorsPort,
} from "./block-verdicts-port.ts";
import type { ExampleBlock } from "./example-block.ts";
import type { PageExample } from "./page-examples.ts";
import type { ReadRecipePage, RecipePage } from "./recipe-pages.ts";

type Located = { readonly recipe: string; readonly anchor: string };

type Addressed = { readonly check: CheckAddressText; readonly form: string };

export type ExampleRefusal =
  | { readonly kind: "page-unreadable"; readonly recipe: string; readonly detail: string }
  | (Addressed & { readonly kind: "form-without-an-example" })
  | (Located & Addressed & { readonly kind: "example-answers-no-form" })
  | (Located & {
      readonly kind:
        | "example-missing-on-page"
        | "page-example-not-declared"
        | "example-without-before-block"
        | "example-without-after-block";
    })
  | (Located &
      Addressed & {
        readonly kind: "flagged-form-not-named";
        readonly named: readonly string[];
      })
  | (Located & {
      readonly kind: "after-block-flagged";
      readonly position: number;
      readonly check: CheckAddressText;
      readonly lines: readonly number[];
    })
  | (Located & {
      readonly kind: "after-block-does-not-compile";
      readonly position: number;
      readonly message: string;
    })
  | { readonly kind: "diagnostic-outside-the-blocks"; readonly message: string }
  | { readonly kind: "verdicts-failed"; readonly detail: string };

type FormedCheck = Pick<CheckContent, "name" | "symptom" | "forms">;

export type ExamplesProof = {
  readonly checks: readonly FormedCheck[];
  readonly pages: readonly RecipePage[];
  readonly typeErrors: TypeErrorsPort;
  readonly flags: BlockFlagsPort;
  readonly flaggedForms: FlaggedFormsPort;
};

const mapAnswerToAddressed = (request: { readonly answer: AnsweredForm }): Addressed => ({
  check: checkAddressTextOf({ check: request.answer.check }),
  form: request.answer.form,
});

const listDeclaredForms = (request: {
  readonly checks: readonly FormedCheck[];
}): readonly Addressed[] =>
  request.checks.flatMap((check) =>
    check.forms.map((form) => ({ check: checkAddressTextOf({ check }), form })),
  );

const findAddressed = (request: {
  readonly among: readonly Addressed[];
  readonly wanted: Addressed;
}): Addressed | undefined =>
  request.among.find(
    ({ check, form }) => check === request.wanted.check && form === request.wanted.form,
  );

const listUnreadable = (request: { readonly page: RecipePage }): readonly ExampleRefusal[] =>
  request.page.kind === "unreadable"
    ? [{ kind: "page-unreadable", recipe: request.page.recipe, detail: request.page.detail }]
    : [];

const listUnanswered = (request: {
  readonly declared: readonly Addressed[];
  readonly answered: readonly Addressed[];
}): readonly ExampleRefusal[] =>
  request.declared
    .filter((wanted) => findAddressed({ among: request.answered, wanted }) === undefined)
    .map((unanswered) => ({ kind: "form-without-an-example", ...unanswered }));

const listFormless = (request: {
  readonly declared: readonly Addressed[];
  readonly page: ReadRecipePage;
}): readonly ExampleRefusal[] =>
  request.page.declared.flatMap(({ anchor, answers }) =>
    answers
      .map((answer) => mapAnswerToAddressed({ answer }))
      .filter((wanted) => findAddressed({ among: request.declared, wanted }) === undefined)
      .map((formless) => ({
        kind: "example-answers-no-form",
        recipe: request.page.recipe,
        anchor,
        ...formless,
      })),
  );

const listUnmatched = (request: { readonly page: ReadRecipePage }): readonly ExampleRefusal[] => {
  const { recipe, declared, shown } = request.page;
  const declaredAnchors = declared.map(({ anchor }) => anchor);
  const shownAnchors = shown.map(({ anchor }) => anchor);
  return [
    ...declaredAnchors
      .filter((anchor) => !shownAnchors.includes(anchor))
      .map((anchor): ExampleRefusal => ({ kind: "example-missing-on-page", recipe, anchor })),
    ...shownAnchors
      .filter((anchor) => !declaredAnchors.includes(anchor))
      .map((anchor): ExampleRefusal => ({ kind: "page-example-not-declared", recipe, anchor })),
  ];
};

const listBlockless = (request: { readonly page: ReadRecipePage }): readonly ExampleRefusal[] => {
  const { recipe, shown } = request.page;
  return [
    ...shown
      .filter(({ before }) => before === undefined)
      .map(({ anchor }): ExampleRefusal => ({
        kind: "example-without-before-block",
        recipe,
        anchor,
      })),
    ...shown
      .filter(({ before, after }) => before !== undefined && after.length === 0)
      .map(({ anchor }): ExampleRefusal => ({
        kind: "example-without-after-block",
        recipe,
        anchor,
      })),
  ];
};

const mapShownToBlocks = (request: {
  readonly recipe: string;
  readonly shown: PageExample;
}): readonly ExampleBlock[] =>
  request.shown.after.map((source, index) => ({
    recipe: request.recipe,
    anchor: request.shown.anchor,
    position: index + 1,
    source,
  }));

const mapTypeErrorToRefusal = (request: { readonly error: BlockTypeError }): ExampleRefusal => {
  const { error } = request;
  return error.kind === "outside-the-blocks"
    ? { kind: "diagnostic-outside-the-blocks", message: error.message }
    : {
        kind: "after-block-does-not-compile",
        recipe: error.block.recipe,
        anchor: error.block.anchor,
        position: error.block.position,
        message: error.message,
      };
};

const mapFlagsToRefusals = (request: {
  readonly flags: Result<readonly BlockFlag[], string>;
}): readonly ExampleRefusal[] =>
  request.flags.outcome === "failed"
    ? [{ kind: "verdicts-failed", detail: request.flags.error }]
    : request.flags.value.map(({ block, check, lines }) => ({
        kind: "after-block-flagged",
        recipe: block.recipe,
        anchor: block.anchor,
        position: block.position,
        check,
        lines,
      }));

type ProvenAnswer = Located & Addressed & { readonly source: string };

const mapExampleToProvenAnswers = (request: {
  readonly page: ReadRecipePage;
  readonly example: RecipeExample;
}): readonly ProvenAnswer[] => {
  const { page, example } = request;
  const { anchor } = example;
  const source = page.shown.find((shown) => shown.anchor === anchor)?.before;
  return source === undefined
    ? []
    : example.answers.map((answer) => ({
        recipe: page.recipe,
        anchor,
        source,
        ...mapAnswerToAddressed({ answer }),
      }));
};

const listUnnamed = async (request: {
  readonly proven: ProvenAnswer;
  readonly flaggedForms: FlaggedFormsPort;
}): Promise<readonly ExampleRefusal[]> => {
  const { recipe, anchor, source, check, form } = request.proven;
  const named = await request.flaggedForms.read({ source, check });
  if (named.outcome === "failed") {
    return [{ kind: "verdicts-failed", detail: named.error }];
  }
  return named.value.includes(form)
    ? []
    : [{ kind: "flagged-form-not-named", recipe, anchor, check, form, named: named.value }];
};

export const findExampleRefusals = async (
  proof: ExamplesProof,
): Promise<readonly ExampleRefusal[]> => {
  const pages = proof.pages.flatMap((page) => (page.kind === "read" ? [page] : []));
  const declared = listDeclaredForms(proof);
  const answered = pages.flatMap((page) =>
    page.declared.flatMap(({ answers }) =>
      answers.map((answer) => mapAnswerToAddressed({ answer })),
    ),
  );
  const blocks = pages.flatMap((page) =>
    page.shown.flatMap((shown) => mapShownToBlocks({ recipe: page.recipe, shown })),
  );
  const proven = pages.flatMap((page) =>
    page.declared.flatMap((example) => mapExampleToProvenAnswers({ page, example })),
  );
  const [flags, unnamed] = await Promise.all([
    proof.flags.read({ blocks }),
    Promise.all(
      proven.map((each) => listUnnamed({ proven: each, flaggedForms: proof.flaggedForms })),
    ),
  ]);
  return [
    ...proof.pages.flatMap((page) => listUnreadable({ page })),
    ...listUnanswered({ declared, answered }),
    ...pages.flatMap((page) => listFormless({ declared, page })),
    ...pages.flatMap((page) => listUnmatched({ page })),
    ...pages.flatMap((page) => listBlockless({ page })),
    ...proof.typeErrors.read({ blocks }).map((error) => mapTypeErrorToRefusal({ error })),
    ...mapFlagsToRefusals({ flags }),
    ...unnamed.flat(),
  ];
};
