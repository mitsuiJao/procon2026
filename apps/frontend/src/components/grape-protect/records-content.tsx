import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { Chip } from "@/components/grape-protect/chip";
import { COLORS, styles } from "@/components/grape-protect/styles";
import type {
  DiseaseInfo,
  LookbackItem,
  RiskByDate,
  SprayRecord,
  StageData,
} from "@/components/grape-protect/types";
import {
  buildLookback,
  countAlertDays,
  fmtDayDiff,
  fmtMd,
  LEVEL_LABEL,
  LOOKBACK_KIND_LABEL,
  seasonDay,
  seasonLastOf,
  seasonStartOf,
  transitionsIn,
} from "@/components/grape-protect/utils";

/** 選んだシーズンの記録と判定。risk は取れなければ null */
export type SeasonRecords = {
  year: number;
  /** 表示する期間（4/1〜今日か 11/30） */
  start: string;
  end: string;
  sprays: SprayRecord[];
  observations: { date: string; diseaseId: string }[];
  diary: Record<string, string>;
  risk: RiskByDate | null;
};

/** 比べる前のシーズンの記録。今季を見ているときは、前年の今日と同じ日までに絞ってある */
export type PrevSeason = {
  year: number;
  observations: { date: string; diseaseId: string }[];
};

/** 記録の一覧でメモの1行目を切る長さ */
const LIST_MEMO_MAX = 60;

type KindFilter = "all" | LookbackItem["kind"];
const KIND_FILTERS: KindFilter[] = ["all", "observation", "spray", "stage", "memo"];

type RecordsContentProps = {
  year: number;
  /** 今季の年。これより先には進めない */
  maxYear: number;
  onChangeYear: (year: number) => void;
  /** 取得中は null。取れなかったら failed */
  season: SeasonRecords | null;
  failed: boolean;
  prev: PrevSeason | null;
  /** 前のシーズンの数字に付ける言葉（「前年の同じ時期」など） */
  prevLabel: string;
  stages: StageData;
  diseases: DiseaseInfo[];
};

/** 記録タブの中身。見るだけで、記録はホームのカレンダーから付ける */
export function RecordsContent({
  year,
  maxYear,
  onChangeYear,
  season,
  failed,
  prev,
  prevLabel,
  stages,
  diseases,
}: RecordsContentProps) {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>記録</Text>
        </View>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => onChangeYear(year - 1)} accessibilityLabel="前のシーズン">
          <Feather name="chevron-left" size={22} color={COLORS.inkSoft} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{year}年シーズン</Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => onChangeYear(year + 1)}
          disabled={year >= maxYear}
          accessibilityLabel="次のシーズン"
        >
          <Feather name="chevron-right" size={22} color={year >= maxYear ? COLORS.line : COLORS.inkSoft} />
        </TouchableOpacity>
      </View>

      {failed ? (
        <Text style={styles.emptyNote}>記録を取得できませんでした。通信状況を確認してください。</Text>
      ) : !season ? (
        <Text style={styles.emptyNote}>読み込み中…</Text>
      ) : (
        <SeasonBody season={season} prev={prev} prevLabel={prevLabel} stages={stages} diseases={diseases} />
      )}
    </ScrollView>
  );
}

type SeasonBodyProps = {
  season: SeasonRecords;
  prev: PrevSeason | null;
  prevLabel: string;
  stages: StageData;
  diseases: DiseaseInfo[];
};

function SeasonBody({ season, prev, prevLabel, stages, diseases }: SeasonBodyProps) {
  const { start, end, sprays, observations, diary, risk } = season;
  const [kind, setKind] = useState<KindFilter>("all");

  const stageName = (stage: number | null | undefined) =>
    stage == null ? null : (stages.names[stage] ?? `生育状態 ${stage}`);

  const alerts = useMemo(() => (risk ? countAlertDays(risk) : null), [risk]);
  const items = useMemo(
    () =>
      buildLookback({
        start,
        end,
        sprays,
        observations,
        diary,
        transitions: stages.transitions,
        diseases,
        stageNames: stages.names,
        memoMax: LIST_MEMO_MAX,
      }),
    [start, end, sprays, observations, diary, stages, diseases],
  );

  // 病害は、発生か判定のある病害だけを重要度の順に
  const diseaseSummaries = [...diseases]
    .sort((a, b) => b.priority - a.priority)
    .map((d) => {
      const dates = observations.filter((o) => o.diseaseId === d.id).map((o) => o.date);
      const prevDates = prev ? prev.observations.filter((o) => o.diseaseId === d.id).map((o) => o.date) : [];
      return { disease: d, dates, prevDates, alert: alerts?.byDisease[d.id] };
    })
    .filter((s) => s.dates.length > 0 || s.alert);

  // ステージの切り替わりは、前のシーズンはシーズン全体で比べる
  const curStages = transitionsIn(stages.transitions, start, end);
  const prevStages = prev ? transitionsIn(stages.transitions, seasonStartOf(prev.year), seasonLastOf(prev.year)) : {};
  const stageRows = Object.keys(stages.names)
    .map(Number)
    .filter((v) => curStages[v] || prevStages[v])
    .sort((a, b) => a - b);

  const shownItems = kind === "all" ? items : items.filter((it) => it.kind === kind);
  const itemsByMonth = new Map<string, LookbackItem[]>();
  for (const it of shownItems) {
    const key = it.date.slice(0, 7);
    itemsByMonth.set(key, [...(itemsByMonth.get(key) ?? []), it]);
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>病害</Text>
        {diseaseSummaries.length === 0 ? (
          <Text style={styles.emptyNote}>このシーズンは発生の記録も警告もありません</Text>
        ) : (
          diseaseSummaries.map(({ disease, dates, prevDates, alert }) => (
            <View key={disease.id} style={styles.summaryItem}>
              <Text style={styles.summaryName}>{disease.name}</Text>
              <Text style={styles.summaryLine}>
                発生 {dates.length}回{prev ? `（${prevLabel} ${prevDates.length}回）` : ""}
              </Text>
              {dates.length > 0 ? (
                <Text style={styles.summaryLine}>
                  初発 {fmtMd(dates[0])}
                  {prevDates.length > 0
                    ? `（前年 ${fmtMd(prevDates[0])}、${fmtDayDiff(seasonDay(dates[0]) - seasonDay(prevDates[0]))}）`
                    : ""}
                </Text>
              ) : prevDates.length > 0 ? (
                <Text style={styles.summaryLine}>前年の初発 {fmtMd(prevDates[0])}</Text>
              ) : null}
              {dates.length > 0 && (
                <Text style={styles.summaryLine}>
                  {dates
                    .map((date) => {
                      const name = stageName(risk?.[date]?.stage);
                      return name ? `${fmtMd(date)}（${name}）` : fmtMd(date);
                    })
                    .join("、")}
                </Text>
              )}
              {alert && (
                <Text style={styles.summaryLine}>
                  {LEVEL_LABEL.conditions_met} {alert.met}日・{LEVEL_LABEL.near_threshold} {alert.near}日
                </Text>
              )}
            </View>
          ))
        )}
        {risk && <Text style={styles.forecastNote}>感染条件は、今の判定ルール（今季の感度の段階）で計算し直したものです。</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>生育</Text>
        {stageRows.length === 0 ? (
          <Text style={styles.emptyNote}>ステージの記録はありません（日の画面で記録できます）</Text>
        ) : (
          <>
            <View style={styles.compareHead}>
              <Text style={[styles.tableLabel, { flex: 1 }]}>ステージ</Text>
              <Text style={styles.compareHeadCell}>{season.year}年</Text>
              <Text style={styles.compareHeadCell}>{prev ? `${prev.year}年` : ""}</Text>
              <Text style={[styles.compareHeadCell, { width: 72 }]}>差</Text>
            </View>
            {stageRows.map((v) => {
              const cur = curStages[v];
              const old = prevStages[v];
              return (
                <View key={v} style={styles.compareRow}>
                  <Text style={styles.compareName}>{stageName(v)}</Text>
                  <Text style={styles.compareCell}>{cur ? fmtMd(cur) : "—"}</Text>
                  <Text style={styles.compareCell}>{old ? fmtMd(old) : "—"}</Text>
                  <Text style={styles.compareDiff}>{cur && old ? fmtDayDiff(seasonDay(cur) - seasonDay(old)) : ""}</Text>
                </View>
              );
            })}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>記録一覧</Text>
        <View style={styles.chipRow}>
          {KIND_FILTERS.map((k) => (
            <Chip key={k} label={k === "all" ? "すべて" : LOOKBACK_KIND_LABEL[k]} on={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        {shownItems.length === 0 ? (
          <Text style={styles.emptyNote}>記録はありません</Text>
        ) : (
          [...itemsByMonth].map(([month, list]) => (
            <View key={month}>
              <Text style={styles.monthHead}>{Number(month.slice(5, 7))}月</Text>
              {list.map((it, i) => <ItemRow key={i} item={it} />)}
            </View>
          ))
        )}
      </View>
    </>
  );
}

/** 記録の1行（日付・種類・名前）。日の画面の「去年の今ごろ」と同じ形 */
function ItemRow({ item }: { item: LookbackItem }) {
  return (
    <View style={styles.lookbackRow}>
      <Text style={styles.lookbackDate}>{fmtMd(item.date)}</Text>
      <Text style={styles.lookbackKind}>{LOOKBACK_KIND_LABEL[item.kind]}</Text>
      <Text style={styles.lookbackText}>{item.text}</Text>
    </View>
  );
}
