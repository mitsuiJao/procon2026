import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { COLORS, styles } from "@/components/nashi-navi/styles";
import { risksForDay, type wIcon as WIcon } from "@/components/nashi-navi/utils";
import type { DayEntry, DiseaseRisk, HistoryItem, TodayWeather, WeatherByDate } from "@/components/nashi-navi/types";

// マスが狭いので ° は付けない
const fmtDeg = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);

type HomeScreenContentProps = {
  y: number;
  m: number;
  todayStr: string;
  todayWeather: TodayWeather | null;
  activeRisks: DiseaseRisk[];
  monthData: Record<string, DayEntry>;
  weatherByDate: WeatherByDate;
  historyItems: HistoryItem[];
  statSpray: number;
  statMemo: number;
  weekdays: readonly string[];
  cells: (number | null)[];
  wIcon: typeof WIcon;
  dateKeyOf: (year: number, month: number, day: number) => string;
  changeMonth: (delta: number) => void;
  openDay: (day: number) => void;
  onPressRisk: (risk: DiseaseRisk) => void;
  onPressWeather: () => void;
};

export function HomeScreenContent({
  y,
  m,
  todayStr,
  todayWeather,
  activeRisks,
  monthData,
  weatherByDate,
  historyItems,
  statSpray,
  statMemo,
  weekdays,
  cells,
  wIcon,
  dateKeyOf,
  changeMonth,
  openDay,
  onPressRisk,
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
                {todayWeather.stale && <Text style={styles.weatherStale}>センサー未受信</Text>}
              </View>
            </>
          ) : (
            <Text style={styles.weatherSub}>気象を取得中</Text>
          )}
        </TouchableOpacity>
      </View>

      {activeRisks.length > 0 && (
        <View style={styles.warningList}>
          {activeRisks.map((risk) => (
            <TouchableOpacity key={risk.id} style={styles.warningRow} onPress={() => onPressRisk(risk)}>
              <View style={styles.warningBody}>
                <Text style={styles.warningTitle}>{risk.name}の感染条件に該当</Text>
                <Text style={styles.warningSub}>{risk.triggerText}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.inkSoft} />
            </TouchableOpacity>
          ))}
        </View>
      )}

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
          const entry = monthData[String(day)];
          const w = weatherByDate[dstr];
          const kind = w ? wIcon(w.code) : null;
          const isToday = dstr === todayStr;
          const hasRisk = risksForDay(w, m + 1).length > 0;

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.cell, isToday && styles.cellToday]}
              onPress={() => openDay(day)}
            >
              {hasRisk && <View style={styles.cellRisk} />}
              <Text style={isToday ? styles.dayNumToday : styles.dayNum}>{day}</Text>
              {w && (
                <View style={styles.cellWeather}>
                  {kind && <Feather name={kind.icon} size={15} color={COLORS.inkSoft} />}
                  <Text style={styles.cellWeatherTemp}>
                    {fmtDeg(w.tmax)}/{fmtDeg(w.tmin)}
                  </Text>
                </View>
              )}
              <View style={styles.dots}>
                {entry?.pesticide?.name ? <View style={[styles.dot, styles.dotSpray]} /> : null}
                {entry?.memo ? <View style={[styles.dot, styles.dotMemo]} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={styles.legendRisk} /><Text style={styles.legendText}>感染条件に該当</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.dotSpray]} /><Text style={styles.legendText}>散布</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.dotMemo]} /><Text style={styles.legendText}>日誌メモ</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近の散布</Text>
        {historyItems.length === 0 ? (
          <Text style={styles.emptyNote}>日付をタップすると散布を記録できます</Text>
        ) : (
          historyItems.map((it, i) => (
            <View key={i} style={styles.historyItem}>
              <Text style={styles.historyDate}>{it.date.replaceAll("-", "/")}</Text>
              <Text style={styles.historyName}>
                {it.name}{it.dilution ? `　${it.dilution}` : ""}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
