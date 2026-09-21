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

// ── 農薬・病害データ ─────────────────────────
const PESTICIDES = {
  P001: { name: "ICボルドー66D水和剤", frac: "M01", dilution: "500倍", max: "制限なし", note: "収穫前日まで使用可能。散布後の果実の汚れに注意。" },
  P002: { name: "アミスター10フロアブル", frac: "11", dilution: "2000倍", max: "年3回まで", note: "耐性菌が発生しやすいため連続使用を避ける。" },
  P003: { name: "オーソサイド水和剤80", frac: "M04", dilution: "800倍", max: "年5回まで", note: "発病前の予防散布が基本。" },
  P004: { name: "ベンレート水和剤", frac: "1", dilution: "2000倍", max: "年3回まで", note: "予防と治療の両方に効果あり。他剤とローテーションする。" },
  P005: { name: "セイビアーフロアブル20", frac: "12", dilution: "1000倍", max: "年2回まで", note: "開花直前〜落花期の予防散布が特に有効。" }
};

const DISEASES = [
  {
    id: "D001",
    name: "べと病",
    season: [5, 6, 7],
    // 条件: 20℃以上かつ降雨（WMOコード50以上を雨天と判定）
    checkRisk: (temp, humidity, code) => temp >= 20 && code >= 50,
    triggerText: "平均気温20℃以上＋降雨継続",
    symptom: "葉に黄白色の病斑が出現し、裏面に白いカビが生えます。",
    pesticides: ["P001", "P002"]
  },
  {
    id: "D002",
    name: "晩腐病",
    season: [7, 8, 9],
    // 条件: 25℃以上かつ多湿（湿度75%以上）
    checkRisk: (temp, humidity, code) => temp >= 25 && humidity >= 75,
    triggerText: "気温25℃前後＋多湿",
    symptom: "着色期以降に果実が褐色になり腐敗します。",
    pesticides: ["P003", "P004"]
  },
  {
    id: "D003",
    name: "灰色かび病",
    season: [5, 6, 8, 9, 10],
    // 条件: 15〜20℃かつ多湿
    checkRisk: (temp, humidity, code) => temp >= 15 && temp <= 22 && humidity >= 70,
    triggerText: "気温15〜20℃＋多湿",
    symptom: "開花期や成熟期に花カスや果実に灰色のカビが生えます。",
    pesticides: ["P005"]
  }
];

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

  // アラートおよびサジェスト用の状態
  const [activeRisks, setActiveRisks] = useState([]);
  const [diseaseModalVisible, setDiseaseModalVisible] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState(null);

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
        const currentW = {
          temp: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          code: data.current.weathercode,
        };
        setTodayWeather(currentW);

        // 病害リスクの判定
        const currentMonth = new Date().getMonth() + 1;
        const risks = DISEASES.filter(d => 
          d.season.includes(currentMonth) && 
          d.checkRisk(currentW.temp, currentW.humidity, currentW.code)
        );
        setActiveRisks(risks);
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

  // ── 農薬情報の自動入力 ──────────────────────────────
  const applyPesticide = (pestObj, diseaseName) => {
    // 表示月を現在の月に合わせ、選択日を「今日」にする
    const now = new Date();
    setCurrent(now);
    setSelectedDay(now.getDate());
    
    // フォームに推奨農薬を自動セット
    setForm({
      ...emptyForm,
      pestName: pestObj.name,
      pestDilution: pestObj.dilution,
      pestTarget: diseaseName,
      pestNote: pestObj.note
    });
    
    setDiseaseModalVisible(false);
    setModalVisible(true);
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
            <Text style={styles.title}>ワイングレープロテクト</Text>
            <Text style={styles.subtitle}>圃場の栽培日誌</Text>
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

        {/* ⚠️ 警告バナー表示（リスクがある場合のみ） */}
        {activeRisks.length > 0 && (
          <View style={styles.warningContainer}>
            {activeRisks.map((risk) => (
              <TouchableOpacity 
                key={risk.id} 
                style={styles.warningBanner}
                onPress={() => {
                  setSelectedDisease(risk);
                  setDiseaseModalVisible(true);
                }}
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

      {/* 病害・農薬詳細モーダル */}
      <Modal visible={diseaseModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.diseaseModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚠️ {selectedDisease?.name} 警告</Text>
              <TouchableOpacity onPress={() => setDiseaseModalVisible(false)}>
                <Text style={styles.closeBtn}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.diseaseScroll}>
              <Text style={styles.dSectionTitle}>発生条件</Text>
              <Text style={styles.dText}>{selectedDisease?.triggerText}</Text>
              
              <Text style={styles.dSectionTitle}>主な症状</Text>
              <Text style={styles.dText}>{selectedDisease?.symptom}</Text>

              <Text style={[styles.dSectionTitle, {marginTop: 20, color: COLORS.primaryDark}]}>推奨される対応農薬</Text>
              {selectedDisease?.pesticides.map(pId => {
                const pest = PESTICIDES[pId];
                return (
                  <View key={pId} style={styles.pestCard}>
                    <Text style={styles.pestName}>{pest.name}</Text>
                    <View style={styles.pestInfoRow}>
                      <Text style={styles.pestLabel}>FRAC: <Text style={styles.pestValue}>{pest.frac}</Text></Text>
                      <Text style={styles.pestLabel}>希釈: <Text style={styles.pestValue}>{pest.dilution}</Text></Text>
                      <Text style={styles.pestLabel}>上限: <Text style={styles.pestValue}>{pest.max}</Text></Text>
                    </View>
                    <Text style={styles.pestNote}>{pest.note}</Text>
                    <TouchableOpacity 
                      style={styles.applyBtn}
                      onPress={() => applyPesticide(pest, selectedDisease.name)}
                    >
                      <Text style={styles.applyBtnText}>本日の日誌に散布を記録する</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
// 元のコードで参照されていたスタイルに加え、警告バナーおよび病害モーダル用のスタイルを追記しています。
const COLORS = {
  bg: "#EFE9D6", surface: "#FFFDF6", ink: "#2B3320", inkSoft: "#5B6650",
  primary: "#5C7A3E", primaryDark: "#3F5729", accent: "#C6852F", line: "#D9CFAE", danger: "#D35400",
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  wrap: { padding: 16, paddingBottom: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: COLORS.ink, paddingBottom: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.inkSoft, marginTop: 2 },
  weatherMini: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10 },
  weatherIcon: { fontSize: 22 },
  weatherTemp: { fontSize: 14, fontWeight: "700", color: COLORS.ink },
  weatherSub: { fontSize: 11, color: COLORS.inkSoft },

  // アラート用スタイル
  warningContainer: { marginBottom: 16, gap: 8 },
  warningBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FDEBD0", borderWidth: 1, borderColor: COLORS.danger, borderRadius: 6, padding: 12 },
  warningBannerInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  warningIcon: { fontSize: 24 },
  warningTitle: { fontSize: 14, fontWeight: "700", color: COLORS.danger, marginBottom: 2 },
  warningSub: { fontSize: 11, color: "#935116" },
  warningArrow: { fontSize: 20, color: COLORS.danger, fontWeight: "300" },

  // 病害モーダル用スタイル
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  diseaseModal: { width: "100%", maxHeight: "80%", backgroundColor: COLORS.surface, borderRadius: 8, overflow: "hidden", elevation: 5, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FDEBD0", padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.danger },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.danger },
  diseaseScroll: { padding: 16 },
  dSectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.inkSoft, marginBottom: 4, marginTop: 12 },
  dText: { fontSize: 14, color: COLORS.ink, lineHeight: 20 },
  pestCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, padding: 12, marginTop: 12, marginBottom: 4 },
  pestName: { fontSize: 15, fontWeight: "700", color: COLORS.ink, marginBottom: 8 },
  pestInfoRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  pestLabel: { fontSize: 11, color: COLORS.inkSoft },
  pestValue: { fontWeight: "700", color: COLORS.primaryDark },
  pestNote: { fontSize: 12, color: COLORS.ink, backgroundColor: "#F5F1E4", padding: 8, borderRadius: 4, marginBottom: 12 },
  applyBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: 4, alignItems: "center" },
  applyBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // カレンダー用スタイル
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

  // サイドカード（まとめ・履歴）
  sideCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, padding: 12, marginBottom: 16 },
  sideCardTitle: { fontSize: 13, fontWeight: "700", color: COLORS.ink, borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingBottom: 6, marginBottom: 8 },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  statLabel: { fontSize: 13, color: COLORS.inkSoft },
  statValue: { fontSize: 13, fontWeight: "700", color: COLORS.ink },
  historyItem: { flexDirection: "row", gap: 8, marginBottom: 6 },
  historyDate: { fontSize: 12, color: COLORS.inkSoft, width: 45 },
  historyName: { fontSize: 13, color: COLORS.ink, flex: 1 },
  emptyNote: { fontSize: 12, color: COLORS.inkSoft, fontStyle: "italic", textAlign: "center", marginVertical: 8 },
  footer: { fontSize: 10, color: COLORS.inkSoft, textAlign: "center", marginTop: 8, marginBottom: 12 },

  // 日付詳細モーダル
  panel: { backgroundColor: COLORS.bg, padding: 20 },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottomWidth: 2, borderBottomColor: COLORS.ink, paddingBottom: 10 },
  panelDate: { fontSize: 20, fontWeight: "700", color: COLORS.ink },
  closeBtn: { fontSize: 24, color: COLORS.inkSoft },
  legend2: { fontSize: 14, fontWeight: "700", color: COLORS.ink, backgroundColor: COLORS.line, paddingVertical: 4, paddingHorizontal: 8, marginTop: 12, marginBottom: 8 },
  amedasBox: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, padding: 12, borderRadius: 4, marginBottom: 8 },
  amedasRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  amedasLabel: { fontSize: 13, color: COLORS.inkSoft },
  amedasValue: { fontSize: 13, fontWeight: "700", color: COLORS.ink },
  fieldRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  fieldHalf: { flex: 1 },
  label: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 10, fontSize: 14, color: COLORS.ink, marginBottom: 12 },
  textarea: { height: 80, textAlignVertical: "top" },
  panelActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  btnSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.inkSoft, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 4 },
  btnSecondaryText: { color: COLORS.inkSoft, fontSize: 14, fontWeight: "700" },
  btn: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 4 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  saveFlash: { textAlign: "center", color: COLORS.primary, marginTop: 12, fontWeight: "700" },
});