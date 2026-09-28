import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchCalendar, fetchCurrent, fetchSensors } from "@/components/nashi-navi/api";
import { DayDetailModal } from "@/components/nashi-navi/day-detail-modal";
import { DiseaseRiskModal } from "@/components/nashi-navi/disease-risk-modal";
import { HomeScreenContent } from "@/components/nashi-navi/home-screen-content";
import { SensorStatusModal, type SensorsState } from "@/components/nashi-navi/sensor-status-modal";
import { styles } from "@/components/nashi-navi/styles";
import type {
  DayEntry,
  DiseaseRisk,
  FormState,
  HistoryItem,
  MonthData,
  PesticideMasterItem,
  SensorStatus,
  TodayWeather,
  WeatherByDate,
} from "@/components/nashi-navi/types";
import {
  dateKeyOf,
  DISEASES,
  emptyForm,
  monthKeyOf,
  pad,
  PESTICIDES,
  WEEKDAYS,
  wIcon,
} from "@/components/nashi-navi/utils";

export default function App() {
  const [current, setCurrent] = useState(new Date());
  const [monthData, setMonthData] = useState<MonthData>({});
  const [weatherByDate, setWeatherByDate] = useState<WeatherByDate>({});
  const [todayWeather, setTodayWeather] = useState<TodayWeather | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saveFlash, setSaveFlash] = useState("");

  const [activeRisks, setActiveRisks] = useState<DiseaseRisk[]>([]);
  const [diseaseModalVisible, setDiseaseModalVisible] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<DiseaseRisk | null>(null);

  const [sensorModalVisible, setSensorModalVisible] = useState(false);
  const [sensors, setSensors] = useState<SensorStatus[]>([]);
  const [sensorsState, setSensorsState] = useState<SensorsState>("loading");

  const y = current.getFullYear();
  const m = current.getMonth();
  const key = monthKeyOf(y, m);

  const loadMonth = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(key);
      setMonthData(raw ? (JSON.parse(raw) as MonthData) : {});
    } catch {
      setMonthData({});
    }
  }, [key]);

  const loadCurrent = useCallback(async () => {
    try {
      const currentW = await fetchCurrent();
      setTodayWeather(currentW);

      const { temp, humidity, code } = currentW;
      if (temp == null || humidity == null || code == null) {
        setActiveRisks([]);
        return;
      }
      const currentMonth = new Date().getMonth() + 1;
      const risks = DISEASES.filter(
        (disease) =>
          disease.season.includes(currentMonth) &&
          disease.checkRisk(temp, humidity, code),
      );
      setActiveRisks(risks);
    } catch {
      setTodayWeather(null);
      setActiveRisks([]);
    }
  }, []);

  const loadCalendar = useCallback(async () => {
    try {
      const lastDay = new Date(y, m + 1, 0).getDate();
      setWeatherByDate(await fetchCalendar(dateKeyOf(y, m, 1), dateKeyOf(y, m, lastDay)));
    } catch {
      setWeatherByDate({});
    }
  }, [y, m]);

  const loadHistory = useCallback(async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const monthKeys = allKeys.filter((itemKey) => itemKey.startsWith("month:"));
      const records = await AsyncStorage.getMany(monthKeys);
      const items: HistoryItem[] = [];

      Object.entries(records).forEach(([storageKey, raw]) => {
        if (!raw) return;
        const data = JSON.parse(raw) as MonthData;
        const ym = storageKey.replace("month:", "");

        Object.entries(data).forEach(([d, entry]) => {
          if (entry.pesticide && entry.pesticide.name) {
            items.push({
              date: `${ym}-${pad(parseInt(d, 10))}`,
              name: entry.pesticide.name,
              dilution: entry.pesticide.dilution,
            });
          }
        });
      });

      items.sort((a, b) => b.date.localeCompare(a.date));
      setHistoryItems(items.slice(0, 8));
    } catch {
      setHistoryItems([]);
    }
  }, []);

  useEffect(() => {
    loadMonth();
    loadCalendar();
    loadHistory();
  }, [loadMonth, loadCalendar, loadHistory]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const openSensors = async () => {
    setSensorsState("loading");
    setSensorModalVisible(true);
    loadCurrent();
    try {
      setSensors(await fetchSensors());
      setSensorsState("ok");
    } catch {
      setSensorsState("error");
    }
  };

  const changeMonth = (delta: number) => {
    const next = new Date(current);
    next.setMonth(next.getMonth() + delta);
    setCurrent(next);
  };

  const openDay = (day: number) => {
    const entry = monthData[String(day)] || ({} as Partial<DayEntry>);
    setForm({
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
    const newMonthData: MonthData = {
      ...monthData,
      [String(selectedDay)]: {
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
    } catch {
      setSaveFlash("保存に失敗しました");
    }
  };

  const deleteEntry = async () => {
    const newMonthData: MonthData = { ...monthData };
    delete newMonthData[String(selectedDay)];
    setMonthData(newMonthData);

    try {
      await AsyncStorage.setItem(key, JSON.stringify(newMonthData));
      setSaveFlash("削除しました");
      loadHistory();
    } catch {
      setSaveFlash("削除に失敗しました");
    }
  };

  const applyPesticide = (pestObj: PesticideMasterItem, diseaseName: string) => {
    const now = new Date();
    setCurrent(now);
    setSelectedDay(now.getDate());

    setForm({
      ...emptyForm,
      pestName: pestObj.name,
      pestDilution: pestObj.dilution,
      pestTarget: diseaseName,
      pestNote: pestObj.note,
    });

    setDiseaseModalVisible(false);
    setModalVisible(true);
  };

  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const now = new Date();
  const todayStr = dateKeyOf(now.getFullYear(), now.getMonth(), now.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  let statSpray = 0;
  let statMemo = 0;
  Object.values(monthData).forEach((entry: DayEntry) => {
    if (entry.pesticide && entry.pesticide.name) statSpray++;
    if (entry.memo) statMemo++;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <HomeScreenContent
        y={y}
        m={m}
        todayStr={todayStr}
        todayWeather={todayWeather}
        activeRisks={activeRisks}
        monthData={monthData}
        weatherByDate={weatherByDate}
        historyItems={historyItems}
        statSpray={statSpray}
        statMemo={statMemo}
        weekdays={WEEKDAYS}
        cells={cells}
        wIcon={wIcon}
        dateKeyOf={dateKeyOf}
        changeMonth={changeMonth}
        openDay={openDay}
        onPressRisk={(risk) => {
          setSelectedDisease(risk);
          setDiseaseModalVisible(true);
        }}
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
        pesticides={PESTICIDES}
        onClose={() => setDiseaseModalVisible(false)}
        onApply={applyPesticide}
      />
      <DayDetailModal
        visible={modalVisible}
        y={y}
        m={m}
        selectedDay={selectedDay}
        weatherByDate={weatherByDate}
        form={form}
        saveFlash={saveFlash}
        wIcon={wIcon}
        dateKeyOf={dateKeyOf}
        onClose={() => setModalVisible(false)}
        onDelete={deleteEntry}
        onSave={saveEntry}
        onFormChange={setForm}
      />
    </SafeAreaView>
  );
}
