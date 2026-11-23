export type Standing = "accepted" | "proposed";

export type RecordKindName =
  | "authorised-location"
  | "deviation"
  | "debt"
  | "boundary-record"
  | "dependency-record";

export type SeenBy = "syntax" | "types" | "graph" | "app" | "files" | "history" | "person";

export type AuthoredPointed = { readonly rule: string } | { readonly principle: string };

export type CaseItem = { readonly standing: Standing; readonly owes: readonly AuthoredPointed[] };

export type RecipeItem = {
  readonly serves: AuthoredPointed;
  readonly standing: Standing;
  readonly reason: { readonly text: string; readonly standing: Standing };
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
  readonly correctUses: readonly {
    readonly situation: string;
    readonly kind: RecordKindName;
    readonly at?: string | undefined;
  }[];
  readonly howItIsSeen?: string | undefined;
  readonly breachACheckCouldName?: string | undefined;
  readonly toNameTheBreach?: string | undefined;
};

export type CheckItem = {
  readonly flagsBeyondTheSymptom?: string | undefined;
  readonly misses?: string | undefined;
  readonly settingsTracedTo?: string | undefined;
};
