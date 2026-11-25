export type Standing = "accepted" | "proposed";

export type RecordKindName = "authorised-location" | "deviation" | "debt" | "dependency-record";

export type Specific = "outside-party";

export type SeenBy = "syntax" | "types" | "graph" | "app" | "files" | "history" | "person";

export type AuthoredPointed = { readonly rule: string } | { readonly principle: string };

export type CaseItem = { readonly standing: Standing; readonly owes: readonly AuthoredPointed[] };

export type AuthoredAnswer = { readonly check: string; readonly form: string };

export type AuthoredRecipeExample = {
  readonly anchor: string;
  readonly answers: readonly AuthoredAnswer[];
};

export type RecipeItem = {
  readonly serves: readonly AuthoredPointed[];
  readonly standing: Standing;
  readonly reason: { readonly text: string; readonly standing: Standing };
  readonly examples?: readonly AuthoredRecipeExample[] | undefined;
};

export type RecordKindItem = { readonly phrase: string };

export type SymptomItem = {
  readonly group: string;
  readonly seen: string;
  readonly mayIndicate: readonly {
    readonly case: string;
    readonly situation?: string | undefined;
    readonly quote?: string | undefined;
    readonly points: readonly AuthoredPointed[];
  }[];
  readonly breachUsuallySits: string;
  readonly seenBy: readonly SeenBy[];
  readonly reports?: "seen" | "seen-to-breach" | undefined;
  readonly recipes: readonly string[];
  readonly correctUses: readonly (
    | {
        readonly situation: string;
        readonly kind: "authorised-location";
        readonly at?: string | undefined;
        readonly binds?: readonly Specific[] | undefined;
      }
    | {
        readonly situation: string;
        readonly kind: Exclude<RecordKindName, "authorised-location">;
        readonly at?: string | undefined;
      }
  )[];
  readonly howItIsSeen?: string | undefined;
  readonly breachACheckCouldName?: string | undefined;
  readonly toNameTheBreach?: string | undefined;
};

export type CheckItem = {
  readonly findingSpecifics?: readonly Specific[] | undefined;
  readonly flagsBeyondTheSymptom?: string | undefined;
  readonly misses?: string | undefined;
  readonly settingsTracedTo?: string | undefined;
};
