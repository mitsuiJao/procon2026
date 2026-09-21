/**
 * 梨ナビ（梨園栽培日誌） - React Native (Expo) 版
 *
 * 必要なパッケージ:
 *   npx create-expo-app nashi-navi
 *   cd nashi-navi
 *   npm install @react-native-async-storage/async-storage
 *
 * このファイルを App.js として置き換えてください。
 * 天気情報は Open-Meteo API（無料・APIキー不要）を使用しています。
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── 位置情報（鳥取県 米子付近）─────────────────────────
const LAT = 35.4265;
const LON = 133.3306;

const WMO = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️", 61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️", 80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};
const wIcon = (code) => WMO[code] || "🌡️";

const pad = (n) => String(n).padStart(2, "0");
const monthKeyOf = (y, m) => `month:${y}-${pad(m + 1)}`;
const dateKeyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const emptyForm = {
  tempActual: "",
  humidityActual: "",
  pestName: "",
  pestDilution: "",
  pestAmount: "",
  pestTarget: "",
  pestNote: "",
  memo: "",
};

export default function App() {
  const [current, setCurrent] = useState(new Date());
  const [monthData, setMonthData] = useState({});
  const [weatherByDate, setWeatherByDate] = useState({});
  const [todayWeather, setTodayWeather] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveFlash, setSaveFlash] = useState("");

  const y = current.getFullYear();
  const m = current.getMonth();
  const key = monthKeyOf(y, m);

  // ── データ読み込み ──────────────────────────────
  const loadMonth = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(key);
      setMonthData(raw ? JSON.parse(raw) : {});
    } catch (e) {
      setMonthData({});
    }
  }, [key]);

  const fetchWeather = useCallback(async () => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        `&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,weathercode` +
        `&current=temperature_2m,relative_humidity_2m,weathercode` +
        `&timezone=Asia%2FTokyo&past_days=92&forecast_days=14`;
      const r = await fetch(url);
      const data = await r.json();
      const map = {};
      if (data.daily) {
        data.daily.time.forEach((d, i) => {
          map[d] = {
            tmax: data.daily.temperature_2m_max[i],
            tmin: data.daily.temperature_2m_min[i],
            humidity: data.daily.relative_humidity_2m_mean
              ? data.daily.relative_humidity_2m_mean[i]
              : null,
            code: data.daily.weathercode[i],
          };
        });
      }
      setWeatherByDate(map);
      if (data.current) {
        setTodayWeather({
          temp: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          code: data.current.weathercode,
        });
      }
    } catch (e) {
      setTodayWeather(null);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const monthKeys = allKeys.filter((k) => k.startsWith("month:"));
      const pairs = await AsyncStorage.multiGet(monthKeys);
      let items = [];
      pairs.forEach(([k, raw]) => {
        if (!raw) return;
        const data = JSON.parse(raw);
        const ym = k.replace("month:", "");
        Object.entries(data).forEach(([d, entry]) => {
          if (entry.pesticide && entry.pesticide.name) {
            items.push({
              date: `${ym}-${pad(parseInt(d))}`,
              name: entry.pesticide.name,
              dilution: entry.pesticide.dilution,
            });
          }
        });
      });
      items.sort((a, b) => b.date.localeCompare(a.date));
      setHistoryItems(items.slice(0, 8));
    } catch (e) {
      setHistoryItems([]);
    }
  }, []);

  useEffect(() => {
    loadMonth();
    fetchWeather();
    loadHistory();
  }, [loadMonth, fetchWeather, loadHistory]);

  // ── 月移動 ──────────────────────────────
  const changeMonth = (delta) => {
    const next = new Date(current);
    next.setMonth(next.getMonth() + delta);
    setCurrent(next);
  };

  // ── 日付タップ ──────────────────────────────
  const openDay = (day) => {
    const entry = monthData[String(day)] || {};
    setForm({
      tempActual: entry.tempActual || "",
      humidityActual: entry.humidityActual || "",
      pestName: entry.pesticide?.name || "",
      pestDilution: entry.pesticide?.dilution || "",
      pestAmount: entry.pesticide?.amount || "",
      pestTarget: entry.pesticide?.target || "",
      pestNote: entry.pesticide?.note || "",
      memo: entry.memo || "",
    });
    setSelectedDay(day);
    setSaveFlash("");
    setModalVisible(true);
  };

  const saveEntry = async () => {
    const newMonthData = {
      ...monthData,
      [String(selectedDay)]: {
        tempActual: form.tempActual,
        humidityActual: form.humidityActual,
        pesticide: {
          name: form.pestName,
          dilution: form.pestDilution,
          amount: form.pestAmount,
          target: form.pestTarget,
          note: form.pestNote,
        },
        memo: form.memo,
      },
    };
    setMonthData(newMonthData);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(newMonthData));
      setSaveFlash("保存しました");
      loadHistory();
    } catch (e) {
      setSaveFlash("保存に失敗しました");
    }
  };

  const deleteEntry = async () => {
    const newMonthData = { ...monthData };
    delete newMonthData[String(selectedDay)];
    setMonthData(newMonthData);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(newMonthData));
      setSaveFlash("削除しました");
      loadHistory();
    } catch (e) {
      setSaveFlash("削除に失敗しました");
    }
  };

  // ── カレンダー描画用データ ──────────────────────────────
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  let statSpray = 0, statMeasure = 0, statMemo = 0;
  Object.values(monthData).forEach((entry) => {
    if (entry.pesticide && entry.pesticide.name) statSpray++;
    if (entry.tempActual || entry.humidityActual) statMeasure++;
    if (entry.memo) statMemo++;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>梨ナビ</Text>
            <Text style={styles.subtitle}>梨園の栽培日誌</Text>
          </View>
          <View style={styles.weatherMini}>
            {todayWeather ? (
              <>
                <Text style={styles.weatherIcon}>{wIcon(todayWeather.code)}</Text>
                <View>
                  <Text style={styles.weatherTemp}>{todayWeather.temp}℃</Text>
                  <Text style={styles.weatherSub}>湿度 {todayWeather.humidity}%</Text>
                </View>
              </>
            ) : (
              <Text style={styles.weatherSub}>気象取得中…</Text>
            )}
          </View>
        </View>

        {/* 月ナビ */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{y}年 {m + 1}月</Text>
          <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 曜日ヘッダー */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekLabel}>{w}</Text>
          ))}
        </View>

        {/* カレンダー本体 */}
        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (!day) return <View key={idx} style={styles.cellEmpty} />;
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
                      {Math.round(w.tmax)}°/{Math.round(w.tmin)}°
                    </Text>
                  </View>
                )}
                <View style={styles.dots}>
                  {entry?.pesticide?.name ? <View style={[styles.dot, styles.dotSpray]} /> : null}
                  {(entry?.tempActual || entry?.humidityActual) ? <View style={[styles.dot, styles.dotMeasure]} /> : null}
                  {entry?.memo ? <View style={[styles.dot, styles.dotMemo]} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 凡例 */}
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, styles.dotSpray]} /><Text style={styles.legendText}>農薬散布</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, styles.dotMeasure]} /><Text style={styles.legendText}>実測記録</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, styles.dotMemo]} /><Text style={styles.legendText}>日誌メモ</Text></View>
        </View>

        {/* 今月のまとめ */}
        <View style={styles.sideCard}>
          <Text style={styles.sideCardTitle}>今月のまとめ</Text>
          <View style={styles.statRow}><Text style={styles.statLabel}>散布記録</Text><Text style={styles.statValue}>{statSpray}件</Text></View>
          <View style={styles.statRow}><Text style={styles.statLabel}>実測記録</Text><Text style={styles.statValue}>{statMeasure}件</Text></View>
          <View style={styles.statRow}><Text style={styles.statLabel}>日誌メモ</Text><Text style={styles.statValue}>{statMemo}件</Text></View>
        </View>

        {/* 散布履歴 */}
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

        <Text style={styles.footer}>
          気象データ: Open-Meteo（実測に近い過去データ・予報を表示。アメダス実測値とは誤差があります）
        </Text>
      </ScrollView>

      {/* 日付詳細モーダル */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelDate}>
                {y}年{m + 1}月{selectedDay}日
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>×</Text>
              </TouchableOpacity>
            </View>

            {/* 気象データ（参考） */}
            <Text style={styles.legend2}>気象データ（参考）</Text>
            {(() => {
              const dstr = selectedDay ? dateKeyOf(y, m, selectedDay) : null;
              const w = dstr ? weatherByDate[dstr] : null;
              return w ? (
                <View style={styles.amedasBox}>
                  <View style={styles.amedasRow}><Text style={styles.amedasLabel}>最高気温</Text><Text style={styles.amedasValue}>{w.tmax}℃</Text></View>
                  <View style={styles.amedasRow}><Text style={styles.amedasLabel}>最低気温</Text><Text style={styles.amedasValue}>{w.tmin}℃</Text></View>
                  <View style={styles.amedasRow}><Text style={styles.amedasLabel}>平均湿度</Text><Text style={styles.amedasValue}>{w.humidity != null ? `${w.humidity}%` : "—"}</Text></View>
                  <View style={styles.amedasRow}><Text style={styles.amedasLabel}>天候</Text><Text style={styles.amedasValue}>{wIcon(w.code)}</Text></View>
                </View>
              ) : (
                <View style={styles.amedasBox}>
                  <Text style={styles.emptyNote}>この日の気象データはありません</Text>
                </View>
              );
            })()}

            {/* 実測記録 */}
            <Text style={styles.legend2}>実測記録（現地計測）</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>気温（℃）</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="例: 24.5"
                  value={form.tempActual}
                  onChangeText={(v) => setForm({ ...form, tempActual: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>湿度（％）</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="例: 65"
                  value={form.humidityActual}
                  onChangeText={(v) => setForm({ ...form, humidityActual: v })}
                />
              </View>
            </View>

            {/* 農薬散布記録 */}
            <Text style={styles.legend2}>農薬散布記録</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>薬剤名</Text>
                <TextInput style={styles.input} placeholder="例: ジマンダイセン水和剤" value={form.pestName} onChangeText={(v) => setForm({ ...form, pestName: v })} />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>希釈倍率</Text>
                <TextInput style={styles.input} placeholder="例: 600倍" value={form.pestDilution} onChangeText={(v) => setForm({ ...form, pestDilution: v })} />
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>散布量</Text>
                <TextInput style={styles.input} placeholder="例: 300L/10a" value={form.pestAmount} onChangeText={(v) => setForm({ ...form, pestAmount: v })} />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>対象病害虫</Text>
                <TextInput style={styles.input} placeholder="例: 黒斑病" value={form.pestTarget} onChangeText={(v) => setForm({ ...form, pestTarget: v })} />
              </View>
            </View>
            <Text style={styles.label}>備考</Text>
            <TextInput style={styles.input} placeholder="収穫前日数・天候など" value={form.pestNote} onChangeText={(v) => setForm({ ...form, pestNote: v })} />

            {/* 日誌メモ */}
            <Text style={styles.legend2}>日誌メモ</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              placeholder="作業内容、生育状況、気づいたことなど"
              value={form.memo}
              onChangeText={(v) => setForm({ ...form, memo: v })}
            />

            <View style={styles.panelActions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={deleteEntry}>
                <Text style={styles.btnSecondaryText}>この日の記録を削除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={saveEntry}>
                <Text style={styles.btnText}>保存する</Text>
              </TouchableOpacity>
            </View>
            {saveFlash ? <Text style={styles.saveFlash}>{saveFlash}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── スタイル ──────────────────────────────
const COLORS = {
  bg: "#EFE9D6",
  surface: "#FFFDF6",
  ink: "#2B3320",
  inkSoft: "#5B6650",
  primary: "#5C7A3E",
  primaryDark: "#3F5729",
  accent: "#C6852F",
  line: "#D9CFAE",
  danger: "#A5502E",
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  wrap: { padding: 16, paddingBottom: 48 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: COLORS.ink, paddingBottom: 12, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "700", color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.inkSoft, marginTop: 2 },
  weatherMini: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10 },
  weatherIcon: { fontSize: 22 },
  weatherTemp: { fontSize: 14, fontWeight: "700", color: COLORS.ink },
  weatherSub: { fontSize: 11, color: COLORS.inkSoft },

  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  navBtn: { width: 30, height: 30, borderWidth: 1, borderColor: COLORS.ink, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  navBtnText: { fontSize: 16, color: COLORS.ink },
  monthLabel: { fontSize: 17, fontWeight: "700", color: COLORS.ink },

  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, color: COLORS.inkSoft },

  grid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
  cell: { width: "14.28%", height: 68, borderWidth: 0.5, borderColor: COLORS.line, padding: 4 },
  cellEmpty: { width: "14.28%", height: 68, borderWidth: 0.5, borderColor: COLORS.line, backgroundColor: "#F5F1E4" },
  cellToday: { borderWidth: 2, borderColor: COLORS.accent },
  dayNum: { fontSize: 12, color: COLORS.inkSoft },
  dayNumToday: { color: COLORS.accent, fontWeight: "700" },
  cellWeather: { position: "absolute", top: 2, right: 3, alignItems: "center" },
  cellWeatherIcon: { fontSize: 16 },
  cellWeatherTemp: { fontSize: 9, color: COLORS.inkSoft },
  dots: { position: "absolute", bottom: 4, left: 4, flexDirection: "row", gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotSpray: { backgroundColor: COLORS.danger },
  dotMeasure: { backgroundColor: COLORS.accent },
  dotMemo: { backgroundColor: COLORS.primary },

  legend: { flexDirection: "row", gap: 14, marginTop: 10, marginBottom: 16, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendText: { fontSize: 11, color: COLORS.inkSoft },

  sideCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 14, marginBottom: 14 },
  sideCardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.ink, borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingBottom: 6, marginBottom: 8 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  statLabel: { fontSize: 12, color: COLORS.inkSoft },
  statValue: { fontSize: 14, fontWeight: "700", color: COLORS.ink },
  emptyNote: { fontSize: 12, color: COLORS.inkSoft },
  historyItem: { borderBottomWidth: 1, borderBottomColor: COLORS.line, borderStyle: "dashed", paddingVertical: 6 },
  historyDate: { fontSize: 11, color: COLORS.accent, fontWeight: "700" },
  historyName: { fontSize: 12, color: COLORS.ink },

  footer: { fontSize: 10, color: COLORS.inkSoft, textAlign: "center", marginTop: 8 },

  panel: { padding: 18, paddingBottom: 48 },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: COLORS.ink, paddingBottom: 10, marginBottom: 14 },
  panelDate: { fontSize: 19, fontWeight: "700", color: COLORS.ink },
  closeBtn: { fontSize: 22, color: COLORS.inkSoft },
  legend2: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark, marginTop: 14, marginBottom: 8 },
  amedasBox: { backgroundColor: "#F4EFDD", borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 10 },
  amedasRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  amedasLabel: { fontSize: 12, color: COLORS.inkSoft },
  amedasValue: { fontSize: 12, fontWeight: "700", color: COLORS.ink },
  fieldRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  fieldHalf: { flex: 1 },
  label: { fontSize: 11, color: COLORS.inkSoft, marginBottom: 3, marginTop: 4 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10, fontSize: 13, backgroundColor: "#FFFEFA", color: COLORS.ink },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  panelActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: { flex: 1, backgroundColor: COLORS.ink, borderRadius: 4, paddingVertical: 12, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 4, paddingVertical: 12, alignItems: "center" },
  btnSecondaryText: { color: COLORS.danger, fontSize: 13, fontWeight: "700" },
  saveFlash: { fontSize: 12, color: COLORS.primaryDark, textAlign: "center", marginTop: 8 },
});