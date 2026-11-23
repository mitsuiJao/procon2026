import type { Rule, RuleResult } from "./types";

const isAlert = (r: RuleResult | undefined) =>
  r !== undefined && (r.level === "near_threshold" || r.level === "conditions_met");

/**
 * repeatDays を持つルールで、警告（near_threshold / conditions_met）が続く日の出し直しを間引く。
 * 出すのは、続き始めた日と、前に出した日から repeatDays 日経った日だけ（レベルが上がっても出し直さない）。
 * ほかの日は level をそのまま残して ongoingSince（続き始めた日）を付ける。none / undetermined で途切れる。
 * @param dates  日付 (YYYY-MM-DD)。1日ずつ連続して並んでいること
 * @param perDay 日ごとのルール結果（dates と同じ並び）。結果に ongoingSince を書き込む
 */
export function applyRepeat(rules: Rule[], dates: string[], perDay: RuleResult[][]): void {
  for (const rule of rules) {
    if (!rule.repeatDays) continue;
    let since: string | null = null;
    let lastShown = 0;
    perDay.forEach((results, i) => {
      const r = results.find((x) => x.ruleId === rule.id);
      if (!isAlert(r)) {
        since = null;
        return;
      }
      if (since === null || i - lastShown >= rule.repeatDays!) {
        since ??= dates[i];
        lastShown = i;
      } else {
        r!.ongoingSince = since;
      }
    });
  }
}
