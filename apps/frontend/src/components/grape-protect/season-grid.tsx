import React from "react";
import { ScrollView, Text, TouchableOpacity, View, type ViewStyle } from "react-native";

import { styles } from "@/components/grape-protect/styles";
import type { DiseaseInfo, SeasonWeek } from "@/components/grape-protect/types";
import { fmtMd } from "@/components/grape-protect/utils";

/** マスの幅＋間隔。月の目盛りの位置に使う */
const CELL_STEP = 17;
const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11];

// 濃さで段階を出す。病害は日の画面・カレンダーと同じ danger 系、ステージは leaf 系、雨は inkSoft 系
const stageColor = (stage: number | null) => (stage == null ? undefined : `rgba(78,107,58,${0.08 + stage * 0.05})`);
const rainColor = (days: number) => (days === 0 ? undefined : `rgba(107,100,112,${0.12 + (days / 7) * 0.5})`);
/** 病害のマスの濃さ。many = 該当 3日以上、some = 該当 1〜2日、near = 条件に近いだけ */
export const ALERT_SHADES = { many: "rgba(162,71,46,0.6)", some: "rgba(162,71,46,0.32)", near: "rgba(162,71,46,0.1)" };
const alertColor = (a: { met: number; near: number } | undefined) => {
  if (!a) return undefined;
  if (a.met >= 3) return ALERT_SHADES.many;
  if (a.met >= 1) return ALERT_SHADES.some;
  return a.near > 0 ? ALERT_SHADES.near : undefined;
};

type SeasonGridProps = {
  year: number;
  weeks: SeasonWeek[];
  /** 行に出す病害（並べたい順） */
  diseases: DiseaseInfo[];
  /** 判定（ステージ・病害の濃さ）が取れたか。取れなければその行は印だけ */
  hasRisk: boolean;
  selected: number | null;
  onSelect: (index: number) => void;
};

/** 病害の発生表。横が週、縦がステージ・雨・病害・散布。マスを押すとその週を選ぶ */
export function SeasonGrid({ year, weeks, diseases, hasRisk, selected, onSelect }: SeasonGridProps) {
  const rows: { key: string; label: string; cell: (w: SeasonWeek) => { bg?: string; dot?: ViewStyle } }[] = [
    { key: "stage", label: "生育", cell: (w) => ({ bg: hasRisk ? stageColor(w.stage) : undefined }) },
    { key: "rain", label: "雨", cell: (w) => ({ bg: rainColor(w.rainyDays) }) },
    ...diseases.map((d) => ({
      key: d.id,
      label: d.name,
      cell: (w: SeasonWeek) => ({
        bg: alertColor(w.alerts[d.id]),
        dot: w.observed.includes(d.id) ? styles.dotObserved : undefined,
      }),
    })),
    { key: "spray", label: "散布", cell: (w) => ({ dot: w.sprays > 0 ? styles.dotSpray : undefined }) },
  ];

  // 月の1日を含む週の位置に目盛りを置く（週はシーズン全体を覆うので必ず見つかる）
  const monthTicks = MONTHS.map((month) => {
    const first = `${year}-${String(month).padStart(2, "0")}-01`;
    return { month, index: weeks.findIndex((w) => w.start <= first && first <= w.end) };
  });

  return (
    <View style={styles.gridWrap}>
      <View style={styles.gridLabels}>
        <View style={styles.gridMonthRow} />
        {rows.map((r) => (
          <Text key={r.key} style={styles.gridLabel} numberOfLines={1}>{r.label}</Text>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.gridMonthRow, { width: weeks.length * CELL_STEP }]}>
            {monthTicks.map((t) => (
              <Text key={t.month} style={[styles.gridMonth, { left: t.index * CELL_STEP }]}>{t.month}月</Text>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.key} style={styles.gridRow}>
              {weeks.map((w, i) => {
                const { bg, dot } = w.future ? {} : r.cell(w);
                return (
                  <TouchableOpacity
                    key={w.start}
                    disabled={w.future}
                    onPress={() => onSelect(i)}
                    accessibilityLabel={`${w.start}からの週`}
                    style={[
                      styles.gridCell,
                      w.future && styles.gridCellFuture,
                      bg != null && { backgroundColor: bg },
                      selected === i && styles.gridCellSelected,
                    ]}
                  >
                    {dot && <View style={[styles.dot, dot]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** 週の見出し（例: 6/14〜6/20） */
export const fmtWeek = (w: SeasonWeek) => `${fmtMd(w.start)}〜${fmtMd(w.end)}`;
