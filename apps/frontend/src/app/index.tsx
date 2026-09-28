import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native";

import { useFocusEffect } from "expo-router";

import {
  createSpray,
  deleteSpray,
  fetchCalendar,
  fetchCurrent,
  fetchDiary,
  fetchDiseases,
  fetchPesticides,
  fetchRecentSprays,
  fetchRisk,
  fetchSensors,
  fetchSprays,
  fetchStageNames,
  fetchUsage,
  saveDiary,
  updateSpray,
} from "@/components/nashi-navi/api";
import { DayDetailModal, type Flash } from "@/components/nashi-navi/day-detail-modal";
import { DiseaseRiskModal } from "@/components/nashi-navi/disease-risk-modal";
import { HomeScreenContent } from "@/components/nashi-navi/home-screen-content";
import { SensorStatusModal, type SensorsState } from "@/components/nashi-navi/sensor-status-modal";
import { styles } from "@/components/nashi-navi/styles";
import type {
  DayData,
  DiseaseInfo,
  Pesticide,
  PesticideMaster,
  RiskByDate,
  SensorStatus,
  SprayForm,
  SprayRecord,
  SprayUsage,
  TodayWeather,
  WeatherByDate,
} from "@/components/nashi-navi/types";
import { dateKeyOf, emptySprayForm, RISK_DAYS_AHEAD, toDiseaseInfo, WEEKDAYS, wIcon } from "@/components/nashi-navi/utils";

const EMPTY_DAY: DayData = { memo: "", sprays: [] };
const SAVE_FAILED = "保存できませんでした。通信状況を確認してください";

/** 日誌と散布記録を日付ごとにまとめる */
function groupByDate(diary: Record<string, string>, sprays: SprayRecord[]): Record<string, DayData> {
  const days: Record<string, DayData> = {};
  for (const [date, memo] of Object.entries(diary)) days[date] = { memo, sprays: [] };
  for (const s of sprays) (days[s.sprayedOn] ??= { memo: "", sprays: [] }).sprays.push(s);
  return days;
}

export default function App() {
  const [current, setCurrent] = useState(new Date());
  const [monthData, setMonthData] = useState<Record<string, DayData>>({});
  const [weatherByDate, setWeatherByDate] = useState<WeatherByDate>({});
  const [todayWeather, setTodayWeather] = useState<TodayWeather | null>(null);
  const [historyItems, setHistoryItems] = useState<SprayRecord[]>([]);
  const [master, setMaster] = useState<PesticideMaster | null>(null);
  const [usage, setUsage] = useState<SprayUsage | null>(null);
  // 病害リスク（判定はバックエンド）。取れなければ空で、警告も印も出さない
  const [monthRisk, setMonthRisk] = useState<RiskByDate>({});
  const [diseases, setDiseases] = useState<DiseaseInfo[]>([]);
  const [stageNames, setStageNames] = useState<Record<number, string>>({});
  // 保存・削除のたびに増やして、記録を取り直す
  const [version, setVersion] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sprayForm, setSprayForm] = useState<SprayForm | null>(null);
  // null なら未編集で、取得したメモをそのまま出す
  const [memoDraft, setMemoDraft] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const [diseaseModalVisible, setDiseaseModalVisible] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<DiseaseInfo | null>(null);

  const [sensorModalVisible, setSensorModalVisible] = useState(false);
  const [sensors, setSensors] = useState<SensorStatus[]>([]);
  const [sensorsState, setSensorsState] = useState<SensorsState>("loading");

  const y = current.getFullYear();
  const m = current.getMonth();

  const now = new Date();
  const todayStr = dateKeyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + RISK_DAYS_AHEAD);
  const riskUntil = dateKeyOf(until.getFullYear(), until.getMonth(), until.getDate());
  // 1週間より先の判定は出さない
  const visibleRisk: RiskByDate = Object.fromEntries(Object.entries(monthRisk).filter(([date]) => date <= riskUntil));
  const thisYear = now.getFullYear();

  const applyCurrent = (w: TodayWeather | null) => setTodayWeather(w);

  useEffect(() => {
    let alive = true;
    fetchCurrent()
      .then((w) => alive && applyCurrent(w))
      .catch(() => alive && applyCurrent(null));
    fetchDiseases()
      .then((d) => alive && setDiseases(d.map(toDiseaseInfo)))
      .catch(() => alive && setDiseases([]));
    fetchStageNames()
      .then((n) => alive && setStageNames(n))
      .catch(() => alive && setStageNames({}));
    return () => {
      alive = false;
    };
  }, []);

  // 農薬タブで「薬剤を選ぶ」に出すかを切り替えるので、戻ってくるたびに取り直す
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchPesticides()
        .then((p) => alive && setMaster(p))
        .catch(() => alive && setMaster(null));
      return () => {
        alive = false;
      };
    }, []),
  );

  useEffect(() => {
    let alive = true;
    const start = dateKeyOf(y, m, 1);
    const end = dateKeyOf(y, m, new Date(y, m + 1, 0).getDate());
    fetchRisk(start, end)
      .then((r) => alive && setMonthRisk(r))
      .catch(() => alive && setMonthRisk({}));
    return () => {
      alive = false;
    };
  }, [y, m]);

  useEffect(() => {
    let alive = true;
    const start = dateKeyOf(y, m, 1);
    const end = dateKeyOf(y, m, new Date(y, m + 1, 0).getDate());
    Promise.all([fetchDiary(start, end), fetchSprays(start, end)])
      .then(([diary, sprays]) => alive && setMonthData(groupByDate(diary, sprays)))
      .catch(() => alive && setMonthData({}));
    fetchCalendar(start, end)
      .then((w) => alive && setWeatherByDate(w))
      .catch(() => alive && setWeatherByDate({}));
    return () => {
      alive = false;
    };
  }, [y, m, version]);

  useEffect(() => {
    let alive = true;
    fetchRecentSprays(8)
      .then((r) => alive && setHistoryItems(r))
      .catch(() => alive && setHistoryItems([]));
    fetchUsage(thisYear)
      .then((u) => alive && setUsage(u))
      .catch(() => alive && setUsage(null));
    return () => {
      alive = false;
    };
  }, [thisYear, version]);

  const openSensors = async () => {
    setSensorsState("loading");
    setSensorModalVisible(true);
    fetchCurrent().then(applyCurrent).catch(() => applyCurrent(null));
    try {
      setSensors(await fetchSensors());
      setSensorsState("ok");
    } catch {
      setSensorsState("error");
    }
  };

  const changeMonth = (delta: number) => {
    const next = new Date(current);
    next.setDate(1);
    next.setMonth(next.getMonth() + delta);
    setCurrent(next);
  };

  const openDate = (date: string, form: SprayForm | null) => {
    setSelectedDate(date);
    setSprayForm(form);
    setMemoDraft(null);
    setFlash(null);
    setModalVisible(true);
  };

  const day = (selectedDate && monthData[selectedDate]) || EMPTY_DAY;
  const memo = memoDraft ?? day.memo;

  const saveSpray = async () => {
    if (!sprayForm || !selectedDate) return;
    const name = sprayForm.pesticide.trim();
    if (!sprayForm.pesticideId && !name) {
      setFlash({ text: "薬剤を選ぶか、薬剤名を入力してください", error: true });
      return;
    }
    const input = {
      sprayedOn: selectedDate,
      pesticideId: sprayForm.pesticideId,
      pesticide: name,
      dilution: sprayForm.dilution.trim(),
      amount: sprayForm.amount.trim(),
      target: sprayForm.target.trim(),
      note: sprayForm.note.trim(),
    };
    try {
      if (sprayForm.id == null) await createSpray(input);
      else await updateSpray(sprayForm.id, input);
      setFlash({ text: sprayForm.id == null ? "散布を記録しました" : "変更を保存しました", error: false });
      setSprayForm(null);
      setVersion((v) => v + 1);
    } catch {
      setFlash({ text: SAVE_FAILED, error: true });
    }
  };

  const removeSpray = async (id: number) => {
    try {
      await deleteSpray(id);
      if (sprayForm?.id === id) setSprayForm(null);
      setFlash({ text: "散布記録を削除しました", error: false });
      setVersion((v) => v + 1);
    } catch {
      setFlash({ text: "削除できませんでした。通信状況を確認してください", error: true });
    }
  };

  const saveMemo = async () => {
    if (!selectedDate) return;
    try {
      await saveDiary(selectedDate, memo);
      setFlash({ text: memo.trim() ? "メモを保存しました" : "メモを消しました", error: false });
      // 取り直すまでの間に古いメモが見えないよう、先に手元へ反映する
      setMonthData((prev) => ({ ...prev, [selectedDate]: { ...(prev[selectedDate] ?? EMPTY_DAY), memo: memo.trim() ? memo : "" } }));
      setMemoDraft(null);
      setVersion((v) => v + 1);
    } catch {
      setFlash({ text: SAVE_FAILED, error: true });
    }
  };

  const applyPesticide = (pesticide: Pesticide, diseaseName: string) => {
    setCurrent(new Date());
    setDiseaseModalVisible(false);
    openDate(todayStr, {
      ...emptySprayForm,
      pesticideId: pesticide.id,
      pesticide: pesticide.name,
      target: diseaseName,
    });
  };

  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <SafeAreaView style={styles.safe}>
      <HomeScreenContent
        y={y}
        m={m}
        todayStr={todayStr}
        todayWeather={todayWeather}
        monthRisk={visibleRisk}
        monthData={monthData}
        weatherByDate={weatherByDate}
        historyItems={historyItems}
        weekdays={WEEKDAYS}
        cells={cells}
        wIcon={wIcon}
        dateKeyOf={dateKeyOf}
        changeMonth={changeMonth}
        openDay={(d) => openDate(dateKeyOf(y, m, d), null)}
        onPressWeather={openSensors}
      />
      <SensorStatusModal
        visible={sensorModalVisible}
        sensors={sensors}
        state={sensorsState}
        onClose={() => setSensorModalVisible(false)}
      />
      <DiseaseRiskModal
        visible={diseaseModalVisible}
        selectedDisease={selectedDisease}
        master={master}
        usage={usage}
        onClose={() => setDiseaseModalVisible(false)}
        onApply={applyPesticide}
      />
      <DayDetailModal
        visible={modalVisible}
        date={selectedDate}
        weather={(selectedDate && weatherByDate[selectedDate]) || null}
        risk={(selectedDate && visibleRisk[selectedDate]) || null}
        showRisk={!selectedDate || selectedDate <= riskUntil}
        diseases={diseases}
        stageNames={stageNames}
        forecast={!!selectedDate && selectedDate > todayStr}
        day={day}
        pesticides={master?.pesticides ?? []}
        usage={usage}
        sprayForm={sprayForm}
        memo={memo}
        flash={flash}
        wIcon={wIcon}
        onClose={() => setModalVisible(false)}
        onPressDisease={(disease) => {
          // モーダルは重ねず、日付の画面を閉じてから開く
          setModalVisible(false);
          setSelectedDisease(disease);
          setDiseaseModalVisible(true);
        }}
        onSprayFormChange={setSprayForm}
        onSaveSpray={saveSpray}
        onDeleteSpray={removeSpray}
        onMemoChange={setMemoDraft}
        onSaveMemo={saveMemo}
      />
    </SafeAreaView>
  );
}
