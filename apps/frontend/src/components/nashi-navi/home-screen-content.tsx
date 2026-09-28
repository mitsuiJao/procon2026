import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { styles } from "@/components/nashi-navi/styles";
import type { DayEntry, DiseaseRisk, HistoryItem, TodayWeather, WeatherByDate } from "@/components/nashi-navi/types";

const fmtDeg = (v: number | null) => (v == null ? "—" : `${Math.round(v)}°`);

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
  wIcon: (code: number | null) => string;
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
        <TouchableOpacity style={styles.weatherMini} onPress={onPressWeather}>
          {todayWeather ? (
            <>
              <Text style={styles.weatherIcon}>{wIcon(todayWeather.code)}</Text>
              <View>
                <Text style={styles.weatherTemp}>{todayWeather.temp ?? "—"}℃</Text>
                <Text style={styles.weatherSub}>湿度 {todayWeather.humidity ?? "—"}%</Text>
                {todayWeather.stale && <Text style={styles.weatherSub}>センサー未受信</Text>}
              </View>
            </>
          ) : (
            <Text style={styles.weatherSub}>気象取得中…</Text>
          )}
        </TouchableOpacity>
      </View>

      {activeRisks.length > 0 && (
        <View style={styles.warningContainer}>
          {activeRisks.map((risk) => (
            <TouchableOpacity
              key={risk.id}
              style={styles.warningBanner}
              onPress={() => onPressRisk(risk)}
            >
              <View style={styles.warningBannerInner}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <View>
                  <Text style={styles.warningTitle}>{risk.name} の感染リスク上昇</Text>
                  <Text style={styles.warningSub}>現在の気象が発病条件と一致しています</Text>
                </View>
              </View>
              <Text style={styles.warningArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{y}年 {m + 1}月</Text>
        <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
          <Text style={styles.navBtnText}>›</Text>
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
          const isToday = dstr === todayStr;

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.cell, isToday && styles.cellToday]}
              onPress={() => openDay(day)}
            >
              <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{day}</Text>
              {w && (
                <View style={styles.cellWeather}>
                  <Text style={styles.cellWeatherIcon}>{wIcon(w.code)}</Text>
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
        <View style={styles.legendItem}><View style={[styles.dot, styles.dotSpray]} /><Text style={styles.legendText}>農薬散布</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.dotMemo]} /><Text style={styles.legendText}>日誌メモ</Text></View>
      </View>

      {/* <View style={styles.sideCard}>
        <Text style={styles.sideCardTitle}>今月のまとめ</Text>
        <View style={styles.statRow}><Text style={styles.statLabel}>散布記録</Text><Text style={styles.statValue}>{statSpray}件</Text></View>
        <View style={styles.statRow}><Text style={styles.statLabel}>日誌メモ</Text><Text style={styles.statValue}>{statMemo}件</Text></View>
      </View> */}

      <View style={styles.sideCard}>
        <Text style={styles.sideCardTitle}>散布履歴（直近）</Text>
        {historyItems.length === 0 ? (
          <Text style={styles.emptyNote}>記録はまだありません</Text>
        ) : (
          historyItems.map((it, i) => (
            <View key={i} style={styles.historyItem}>
              <Text style={styles.historyDate}>{it.date}</Text>
              <Text style={styles.historyName}>
                {it.name}{it.dilution ? `（${it.dilution}）` : ""}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* <Text style={styles.footer}>
        気象データ: Open-Meteo（実測に近い過去データ・予報を表示。アメダス実測値とは誤差があります）
      </Text> */}
    </ScrollView>
  );
}
