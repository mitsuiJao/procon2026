export type Op = ">=" | ">" | "<=" | "<" | "==" | "!=";

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { var: string; op: Op; value: number };

/** rules.yaml に書いたままの条件。value は数値か、params を指す "$名前" */
export type CondDef =
  | { all: CondDef[] }
  | { any: CondDef[] }
  | { not: CondDef }
  | { var: string; op: Op; value: number | string };

/** 閾値ルールの結果レベル */
export type RuleLevel = "near_threshold" | "conditions_met";

/** ルール単位の結果。none = 該当なし、undetermined = 入力不足で判定不能 */
export type ResultLevel = RuleLevel | "none" | "undetermined";

/** 値が確定したルール（"$名前" の参照と段階の上書きを解決済み）。評価はこの形だけを受け取る */
export type Rule = {
  id: string;
  diseaseId: string;
  enabled: boolean;
  when?: Cond;
  evaluator?: { name: string; params: Record<string, number> };
  level?: RuleLevel;
  /** 警告が続く間、出し直す間隔（日数）。無ければ毎日出す */
  repeatDays?: number;
  candidateFrac: string[];
  confidence: "A" | "B";
  sourceIds: string[];
};

/**
 * rules.yaml に書いたままのルール。感度の段階を決めて resolveRules に通すと Rule になる。
 * params は when から "$名前" で参照する値。levels は段階 1, 2, … での上書き（段階 0 は本体のまま）で、
 * キーは enabled か、params / evaluator.params のキー。
 */
export type RuleDef = Omit<Rule, "when"> & {
  when?: CondDef;
  params?: Record<string, number>;
  levels?: Record<string, number | boolean>[];
};

/** 時別の観測値。time は UTC の Date。欠損は null */
export type HourlyPoint = {
  time: Date;
  tempC: number | null;
  rhPercent: number | null;
};

export type EvalInput = {
  /** 生育ステージ・日平均気温などの scalar 変数。欠損は null / 未定義（= 判定不能） */
  scalars: Partial<Record<string, number | null>>;
  /** 時別の系列（時刻昇順）。式モデル（broome / gublerThomas）の入力 */
  hourly: HourlyPoint[];
};

export type RuleResult = {
  ruleId: string;
  diseaseId: string;
  level: ResultLevel;
  /** 式モデルの値（Broome の logit、GT 指数）。閾値ルールでは undefined */
  value?: number;
  candidateFrac: string[];
  /** 警告が続いていて、この日は出し直さないときだけ付く。続き始めた日 (YYYY-MM-DD) */
  ongoingSince?: string;
};

export type DiseaseResult = {
  diseaseId: string;
  level: ResultLevel;
  /** 警告レベルのルールが全部「続いている」ときだけ付く。そのうち一番早く続き始めた日 */
  ongoingSince?: string;
  rules: RuleResult[];
};
