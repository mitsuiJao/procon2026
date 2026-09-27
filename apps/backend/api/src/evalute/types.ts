export type Op = ">=" | ">" | "<=" | "<" | "==" | "!=";

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { var: string; op: Op; value: number };

/** 閾値ルールの結果レベル */
export type RuleLevel = "near_threshold" | "conditions_met";

/** ルール単位の結果。none = 該当なし、undetermined = 入力不足で判定不能 */
export type ResultLevel = RuleLevel | "none" | "undetermined";

export type Rule = {
  id: string;
  diseaseId: string;
  enabled: boolean;
  when?: Cond;
  evaluator?: { name: string; params: Record<string, number> };
  level?: RuleLevel;
  candidateFrac: string[];
  confidence: "A" | "B";
  sourceIds: string[];
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
};

export type DiseaseResult = {
  diseaseId: string;
  level: ResultLevel;
  rules: RuleResult[];
};
