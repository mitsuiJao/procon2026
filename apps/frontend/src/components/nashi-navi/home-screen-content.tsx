import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { COLORS, styles } from "@/components/nashi-navi/styles";
import { maxLevel, type wIcon as WIcon } from "@/components/nashi-navi/utils";
import type { DayData, RiskByDate, SprayRecord, TodayWeather, WeatherByDate } from "@/components/nashi-navi/types";

const fmtDeg = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);

/** センサーの受信時刻。今日なら時刻だけ、それ以外は日付も付ける（JST） */
const fmtReceived = (iso: string | null, todayStr: string) => {
  if (!iso) return "未受信";
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const time = d.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
  return date === todayStr ? `${time} 受信` : `${Number(date.slice(5, 7))}/${Number(date.slice(8))} ${time} 受信`;
};

type HomeScreenContentProps = {
  y: number;
  m: number;
  todayStr: string;
  todayWeather: TodayWeather | null;
  /** 日付ごとの病害リスク。マスの背景色に使う */
  monthRisk: RiskByDate;
  /** 日付（YYYY-MM-DD）ごとの記録 */
  monthData: Record<string, DayData>;
  weatherByDate: WeatherByDate;
  historyItems: SprayRecord[];
  weekdays: readonly string[];
  cells: (number | null)[];
  wIcon: typeof WIcon;
  dateKeyOf: (year: number, month: number, day: number) => string;
  changeMonth: (delta: number) => void;
  openDay: (day: number) => void;
  onPressWeather: () => void;
};

export function HomeScreenContent({
  y,
  m,
  todayStr,
  todayWeather,
  monthRisk,
  monthData,
  weatherByDate,
  historyItems,
  weekdays,
  cells,
  wIcon,
  dateKeyOf,
  changeMonth,
  openDay,
  onPressWeather,
}: HomeScreenContentProps) {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ワイングレープロテクト</Text>
          <Text style={styles.subtitle}>圃場の栽培日誌</Text>
        </View>
        <TouchableOpacity style={styles.weatherMini} onPress={onPressWeather} accessibilityLabel="センサーの状態を見る">
          {todayWeather ? (
            <>
              {wIcon(todayWeather.code) && (
                <Feather name={wIcon(todayWeather.code)!.icon} size={22} color={COLORS.inkSoft} />
              )}
              <View>
                <Text style={styles.weatherTemp}>{todayWeather.temp ?? "—"}℃</Text>
                <Text style={styles.weatherSub}>湿度 {todayWeather.humidity ?? "—"}%</Text>
                {/* 古いときは色で知らせる */}
                <Text style={todayWeather.stale ? styles.weatherStale : styles.weatherSub}>
                  {fmtReceived(todayWeather.updatedAt, todayStr)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.weatherSub}>気象を取得中</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)} accessibilityLabel="前の月">
          <Feather name="chevron-left" size={22} color={COLORS.inkSoft} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{y}年{m + 1}月</Text>
        <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)} accessibilityLabel="次の月">
          <Feather name="chevron-right" size={22} color={COLORS.inkSoft} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {weekdays.map((w) => (
          <Text key={w} style={styles.weekLabel}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (!day) {
            return <View key={idx} style={styles.cellEmpty} />;
          }
          const dstr = dateKeyOf(y, m, day);
          const entry = monthData[dstr];
          const w = weatherByDate[dstr];
          const kind = w ? wIcon(w.code) : null;
          const isToday = dstr === todayStr;
          const risk = maxLevel(monthRisk[dstr]);

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.cell,
                risk === "conditions_met" && styles.cellRiskMet,
                risk === "near_threshold" && styles.cellRiskNear,
                isToday && styles.cellToday,
              ]}
              onPress={() => openDay(day)}
            >
              <View style={styles.dayRow}>
                <Text style={isToday ? styles.dayNumToday : styles.dayNum}>{day}</Text>
                {entry?.observed.length ? <View style={[styles.dot, styles.dotObserved]} /> : null}
                {entry?.sprays.length ? <View style={[styles.dot, styles.dotSpray]} /> : null}
                {entry?.memo ? <View style={[styles.dot, styles.dotMemo]} /> : null}
              </View>
              {w && (
                <View style={styles.cellWeather}>
                  {kind && <Feather name={kind.icon} size={22} color={COLORS.inkSoft} />}
                  <Text style={styles.cellTempMax}>
                    {fmtDeg(w.tmax)}
                    <Text style={styles.cellTempMin}>/{fmtDeg(w.tmin)}</Text>
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, styles.cellRiskMet]} /><Text style={styles.legendText}>感染条件に該当</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, styles.cellRiskNear]} /><Text style={styles.legendText}>条件に近い</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.dotObserved]} /><Text style={styles.legendText}>病害の発生</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.dotSpray]} /><Text style={styles.legendText}>散布</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.dotMemo]} /><Text style={styles.legendText}>日誌メモ</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近の散布</Text>
        {historyItems.length === 0 ? (
          <Text style={styles.emptyNote}>日付をタップすると散布を記録できます</Text>
        ) : (
          historyItems.map((it) => (
            <View key={it.id} style={styles.historyItem}>
              <Text style={styles.historyDate}>{it.sprayedOn.replaceAll("-", "/")}</Text>
              <Text style={styles.historyName}>{it.pesticide}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
