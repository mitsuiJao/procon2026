import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { DayDetailModal } from "@/components/nashi-navi/day-detail-modal";
import { HomeScreenContent } from "@/components/nashi-navi/home-screen-content";
import { styles } from "@/components/nashi-navi/styles";
import type { DayEntry, FormState, HistoryItem, MonthData, TodayWeather, WeatherByDate } from "@/components/nashi-navi/types";
import { dateKeyOf, emptyForm, monthKeyOf, pad, WEEKDAYS, wIcon } from "@/components/nashi-navi/utils";

const LAT = 35.4265;
const LON = 133.3306;

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

  const fetchWeather = useCallback(async () => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        "&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,weathercode" +
        "&current=temperature_2m,relative_humidity_2m,weathercode" +
        "&timezone=Asia%2FTokyo&past_days=92&forecast_days=14";
      const r = await fetch(url);
      const data = await r.json();
      const map: WeatherByDate = {};

      if (data.daily) {
        data.daily.time.forEach((d: string, i: number) => {
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
    } catch {
      setTodayWeather(null);
    }
  }, []);

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
    fetchWeather();
    loadHistory();
  }, [loadMonth, fetchWeather, loadHistory]);

  const changeMonth = (delta: number) => {
    const next = new Date(current);
    next.setMonth(next.getMonth() + delta);
    setCurrent(next);
  };

  const openDay = (day: number) => {
    const entry = monthData[String(day)] || ({} as Partial<DayEntry>);
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
    const newMonthData: MonthData = {
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

  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  let statSpray = 0;
  let statMeasure = 0;
  let statMemo = 0;
  Object.values(monthData).forEach((entry: DayEntry) => {
    if (entry.pesticide && entry.pesticide.name) statSpray++;
    if (entry.tempActual || entry.humidityActual) statMeasure++;
    if (entry.memo) statMemo++;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <HomeScreenContent
        y={y}
        m={m}
        todayStr={todayStr}
        todayWeather={todayWeather}
        monthData={monthData}
        weatherByDate={weatherByDate}
        historyItems={historyItems}
        statSpray={statSpray}
        statMeasure={statMeasure}
        statMemo={statMemo}
        weekdays={WEEKDAYS}
        cells={cells}
        wIcon={wIcon}
        dateKeyOf={dateKeyOf}
        changeMonth={changeMonth}
        openDay={openDay}
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
