import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { Chip } from "@/components/grape-protect/chip";
import { ALERT_SHADES, fmtWeek, SeasonGrid } from "@/components/grape-protect/season-grid";
import { COLORS, styles } from "@/components/grape-protect/styles";
import type {
  DiseaseInfo,
  LookbackItem,
  RiskByDate,
  SprayRecord,
  StageData,
  WeatherByDate,
} from "@/components/grape-protect/types";
import {
  buildLookback,
  buildSeasonWeeks,
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

/** 選んだシーズンの記録と判定。risk と weather は取れなければ null */
export type SeasonRecords = {
  year: number;
  /** 表示する期間（4/1〜今日か 11/30） */
  start: string;
  end: string;
  sprays: SprayRecord[];
  observations: { date: string; diseaseId: string }[];
  diary: Record<string, string>;
  risk: RiskByDate | null;
  weather: WeatherByDate | null;
};

/** 比べる前のシーズンの記録。今季を見ているときは、前年の今日と同じ日までに絞ってある */
export type PrevSeason = {
  year: number;
  sprays: SprayRecord[];
  observations: { date: string; diseaseId: string }[];
};

/** 収穫期のステージの value（stages.yaml） */
const HARVEST_STAGE = 9;
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
  const { year, start, end, sprays, observations, diary, risk, weather } = season;
  // シーズンを切り替えたら選んでいた週は外す
  const [selected, setSelected] = useState<{ year: number; index: number } | null>(null);
  const selectedIndex = selected?.year === year ? selected.index : null;
  const [kind, setKind] = useState<KindFilter>("all");

  const byPriority = useMemo(() => [...diseases].sort((a, b) => b.priority - a.priority), [diseases]);
  const stageName = (stage: number | null | undefined) =>
    stage == null ? null : (stages.names[stage] ?? `生育状態 ${stage}`);

  const weeks = useMemo(
    () => buildSeasonWeeks({ year, end, risk: risk ?? {}, weather: weather ?? {}, observations, sprays }),
    [year, end, risk, weather, observations, sprays],
  );
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

  // ステージの切り替わりは、前のシーズンはシーズン全体で比べる
  const curStages = transitionsIn(stages.transitions, start, end);
  const prevStages = prev ? transitionsIn(stages.transitions, seasonStartOf(prev.year), seasonLastOf(prev.year)) : {};
  const stageRows = Object.keys(stages.names)
    .map(Number)
    .filter((v) => curStages[v] || prevStages[v])
    .sort((a, b) => a - b);

  const harvest = curStages[HARVEST_STAGE];
  const prevHarvest = prevStages[HARVEST_STAGE];

  const week = selectedIndex == null ? null : weeks[selectedIndex];
  const weekItems = week ? items.filter((it) => it.date >= week.start && it.date <= week.end) : [];

  // 病害ごとのまとめは、発生か判定のある病害だけ
  const diseaseSummaries = byPriority
    .map((d) => {
      const dates = observations.filter((o) => o.diseaseId === d.id).map((o) => o.date);
      const prevDates = prev ? prev.observations.filter((o) => o.diseaseId === d.id).map((o) => o.date) : [];
      return { disease: d, dates, prevDates, alert: alerts?.byDisease[d.id] };
    })
    .filter((s) => s.dates.length > 0 || s.alert);

  const monthCounts = new Map<number, number>();
  for (let mo = 4; mo <= Number(end.slice(5, 7)); mo++) monthCounts.set(mo, 0);
  for (const s of sprays) {
    const mo = Number(s.sprayedOn.slice(5, 7));
    monthCounts.set(mo, (monthCounts.get(mo) ?? 0) + 1);
  }
  const maxMonthCount = Math.max(1, ...monthCounts.values());
  const pesticideCounts = [...sprays.reduce((m, s) => m.set(s.pesticide, (m.get(s.pesticide) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));

  const shownItems = kind === "all" ? items : items.filter((it) => it.kind === kind);
  const itemsByMonth = new Map<string, LookbackItem[]>();
  for (const it of shownItems) {
    const key = it.date.slice(0, 7);
    itemsByMonth.set(key, [...(itemsByMonth.get(key) ?? []), it]);
  }

  return (
    <>
      <View style={styles.tiles}>
        <Tile
          label="病害の発生"
          value={`${observations.length}件`}
          sub={prev ? `${prevLabel} ${prev.observations.length}件` : null}
        />
        <Tile label="散布" value={`${sprays.length}回`} sub={prev ? `${prevLabel} ${prev.sprays.length}回` : null} />
        <Tile
          label="感染条件に該当した日"
          value={alerts ? `${alerts.metDays}日` : "—"}
          sub={alerts ? "どれかの病害で該当" : "判定を取得できませんでした"}
        />
        <Tile
          label={`${stageName(HARVEST_STAGE) ?? "収穫期"}に入った日`}
          value={harvest ? fmtMd(harvest) : "—"}
          sub={
            harvest && prevHarvest
              ? `前年より${fmtDayDiff(seasonDay(harvest) - seasonDay(prevHarvest))}`
              : prevHarvest
                ? `前年 ${fmtMd(prevHarvest)}`
                : null
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>病害の発生表</Text>
        <SeasonGrid
          year={year}
          weeks={weeks}
          diseases={byPriority}
          hasRisk={!!risk}
          selected={selectedIndex}
          onSelect={(index) => setSelected(selectedIndex === index ? null : { year, index })}
        />
        <View style={[styles.legend, styles.gridLegend]}>
          <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: ALERT_SHADES.many }]} /><Text style={styles.legendText}>該当 3日以上</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: ALERT_SHADES.some }]} /><Text style={styles.legendText}>該当 1〜2日</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: ALERT_SHADES.near }]} /><Text style={styles.legendText}>条件に近い</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, styles.dotObserved]} /><Text style={styles.legendText}>発生</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, styles.dotSpray]} /><Text style={styles.legendText}>散布</Text></View>
        </View>
        <Text style={styles.gridNote}>
          1マス = 1週。生育は色が濃いほど進んだステージ、雨は雨の日が多い週ほど濃い。{"\n"}
          感染条件は、今の判定ルール（今季の感度の段階）で計算し直したものです。
        </Text>
        {week && (
          <View style={styles.weekBox}>
            <Text style={styles.weekTitle}>
              {fmtWeek(week)}
              {stageName(week.stage) ? `（${stageName(week.stage)}）` : ""}
            </Text>
            {byPriority
              .filter((d) => week.alerts[d.id])
              .map((d) => {
                const a = week.alerts[d.id];
                const parts = [
                  a.met > 0 ? `${LEVEL_LABEL.conditions_met} ${a.met}日` : null,
                  a.near > 0 ? `${LEVEL_LABEL.near_threshold} ${a.near}日` : null,
                ].filter(Boolean);
                return <Text key={d.id} style={styles.weekAlert}>{d.name}　{parts.join("・")}</Text>;
              })}
            {weekItems.length === 0 ? (
              <Text style={styles.emptyNote}>この週の記録はありません</Text>
            ) : (
              weekItems.map((it, i) => <ItemRow key={i} item={it} />)
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>病害ごとのまとめ</Text>
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>生育の進み</Text>
        {stageRows.length === 0 ? (
          <Text style={styles.emptyNote}>ステージの記録はありません（日の画面で記録できます）</Text>
        ) : (
          <>
            <View style={styles.compareHead}>
              <Text style={[styles.tableLabel, { flex: 1 }]}>ステージ</Text>
              <Text style={styles.compareHeadCell}>{year}年</Text>
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
        <Text style={styles.sectionTitle}>散布のまとめ</Text>
        {sprays.length === 0 ? (
          <Text style={styles.emptyNote}>このシーズンの散布の記録はありません</Text>
        ) : (
          <>
            <Text style={styles.label}>月ごとの回数</Text>
            {[...monthCounts].map(([mo, count]) => (
              <View key={mo} style={styles.barRow}>
                <Text style={styles.barLabel}>{mo}月</Text>
                <View style={styles.barTrack}>
                  {count > 0 && <View style={[styles.bar, { width: `${(count / maxMonthCount) * 100}%` }]} />}
                </View>
                <Text style={styles.barCount}>{count}回</Text>
              </View>
            ))}
            <Text style={styles.label}>薬剤ごとの回数</Text>
            {pesticideCounts.map(([name, count]) => (
              <View key={name} style={styles.tableRow}>
                <Text style={[styles.tableValue, { flex: 1 }]}>{name}</Text>
                <Text style={styles.tableValue}>{count}回</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>記録の一覧</Text>
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

function Tile({ label, value, sub }: { label: string; value: string; sub: string | null }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {sub && <Text style={styles.tileSub}>{sub}</Text>}
    </View>
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
