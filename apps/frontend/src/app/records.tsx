import React, { useCallback, useState } from "react";
import { SafeAreaView } from "react-native";

import { useFocusEffect } from "expo-router";

import {
  fetchCalendar,
  fetchDiary,
  fetchDiseases,
  fetchObservations,
  fetchRisk,
  fetchSprays,
  fetchStages,
} from "@/components/grape-protect/api";
import { RecordsContent, type PrevSeason, type SeasonRecords } from "@/components/grape-protect/records-content";
import { styles } from "@/components/grape-protect/styles";
import type { DiseaseInfo, StageData } from "@/components/grape-protect/types";
import { dateKeyOf, seasonRange, seasonStartOf, seasonYearOf, toDiseaseInfo } from "@/components/grape-protect/utils";

/** 記録タブ。シーズン全体の記録を、前のシーズンと比べて見る。API は既存の範囲指定のものだけを使う */
export default function RecordsScreen() {
  const now = new Date();
  const today = dateKeyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const maxYear = seasonYearOf(today);
  const [year, setYear] = useState(maxYear);
  const [season, setSeason] = useState<SeasonRecords | null>(null);
  const [failed, setFailed] = useState(false);
  const [prev, setPrev] = useState<PrevSeason | null>(null);
  const [stages, setStages] = useState<StageData>({ names: {}, transitions: {} });
  const [diseases, setDiseases] = useState<DiseaseInfo[]>([]);

  // ホームで記録が変わるので、タブに来るたびとシーズンを切り替えるたびに取り直す
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchDiseases()
        .then((d) => alive && setDiseases(d.map(toDiseaseInfo)))
        .catch(() => alive && setDiseases([]));
      fetchStages()
        .then((st) => alive && setStages(st))
        .catch(() => alive && setStages({ names: {}, transitions: {} }));

      // year は今季以前なので、期間は必ずある
      const range = seasonRange(year, today)!;
      setFailed(false);
      // 判定と天気は表の濃さにしか使わないので、取れなくても記録は出す
      Promise.all([
        fetchSprays(range.start, range.end),
        fetchObservations(range.start, range.end),
        fetchDiary(range.start, range.end),
        fetchRisk(range.start, range.end).catch(() => null),
        fetchCalendar(range.start, range.end).catch(() => null),
      ])
        .then(([sprays, observations, diary, risk, weather]) => {
          if (alive) setSeason({ year, ...range, sprays, observations, diary, risk, weather });
        })
        .catch(() => alive && setFailed(true));

      // 前のシーズンは、今季を見ているときは前年の今日と同じ日まで（途中のシーズンと比べるため）
      const prevStart = seasonStartOf(year - 1);
      const prevEnd = `${year - 1}${range.end.slice(4)}`;
      Promise.all([fetchSprays(prevStart, prevEnd), fetchObservations(prevStart, prevEnd)])
        .then(([sprays, observations]) => alive && setPrev({ year: year - 1, sprays, observations }))
        .catch(() => alive && setPrev(null));
      return () => {
        alive = false;
      };
    }, [year, today]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <RecordsContent
        year={year}
        maxYear={maxYear}
        onChangeYear={(y) => setYear(Math.min(y, maxYear))}
        // 切り替えた直後は、前のシーズンの分を出さない
        season={season?.year === year ? season : null}
        failed={failed}
        prev={prev?.year === year - 1 ? prev : null}
        prevLabel={year === maxYear ? "前年の同じ時期" : "前年"}
        stages={stages}
        diseases={diseases}
      />
    </SafeAreaView>
  );
}
