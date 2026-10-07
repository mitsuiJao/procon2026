import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, SafeAreaView, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useFocusEffect } from "expo-router";

import { fetchDiseases, fetchPesticides, fetchUsage, setPesticideHidden } from "@/components/grape-protect/api";
import { COLORS, styles } from "@/components/grape-protect/styles";
import type { Pesticide, PesticideMaster, SprayUsage } from "@/components/grape-protect/types";
import { fmtApplication, pesticidesForDisease, searchPesticides } from "@/components/grape-protect/utils";

type Visibility = "all" | "shown" | "hidden";

const VISIBILITY_LABEL: Record<Visibility, string> = { all: "すべて", shown: "表示中", hidden: "非表示" };

type ChipProps = { label: string; on: boolean; onPress: () => void };

function Chip({ label, on, onPress }: ChipProps) {
  return (
    <TouchableOpacity style={on ? styles.chipOn : styles.chip} onPress={onPress}>
      <Text style={on ? styles.chipTextOn : styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

type PesticideRowProps = {
  item: Pesticide;
  hidden: boolean;
  open: boolean;
  /** 今年の使用回数。取れなければ null */
  count: number | null;
  onToggle: (p: Pesticide, shown: boolean) => void;
  onOpen: (id: string) => void;
};

// 切り替えた行だけ描き直すようにメモ化する
const PesticideRow = memo(function PesticideRow({ item, hidden, open, count, onToggle, onOpen }: PesticideRowProps) {
  return (
    <View style={styles.pestItem}>
      <View style={styles.refRow}>
        <TouchableOpacity style={styles.refMain} onPress={() => onOpen(item.id)}>
          <Text style={hidden ? styles.pestNameMuted : styles.pestName}>{item.name}</Text>
          <View style={styles.pestInfoRow}>
            <Text style={styles.pestLabel}>{item.kind}</Text>
            <Text style={styles.pestLabel}>
              FRAC <Text style={styles.pestValue}>{item.fracCodes.join(" / ") || "不明"}</Text>
            </Text>
            <Text style={styles.pestLabel}>
              今年 <Text style={styles.pestValue}>{count == null ? "—" : `${count}回`}</Text>
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.refSwitch}>
          <Switch
            value={!hidden}
            onValueChange={(shown) => onToggle(item, shown)}
            trackColor={{ true: COLORS.leaf, false: COLORS.line }}
            accessibilityLabel={`${item.name}を薬剤の選択に表示`}
          />
          <Text style={styles.refSwitchLabel}>{hidden ? "非表示" : "表示"}</Text>
        </View>
      </View>
      {open && (
        <View style={styles.regList}>
          {item.applications.map((a, i) => (
            <Text key={i} style={styles.regLine}>
              {a.crop}　{fmtApplication(a)}
            </Text>
          ))}
          {item.totalUseLimits.map((t) => (
            <Text key={t} style={styles.pestNote}>{t}</Text>
          ))}
          {item.fracNote && <Text style={styles.pestNote}>{item.fracNote}</Text>}
        </View>
      )}
    </View>
  );
});

/** 農薬の参照。登録内容を調べ、散布記録の「薬剤を選ぶ」に出すかどうかを切り替える */
export default function PesticidesScreen() {
  const [master, setMaster] = useState<PesticideMaster | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [usage, setUsage] = useState<SprayUsage | null>(null);
  const [diseases, setDiseases] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [diseaseId, setDiseaseId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 表示設定は master と分けて持つ。切り替えのたびに並べ替えや検索をやり直さないため
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  // 薬剤ごとの、最後に押された値・サーバーで確定している値・送信中か
  const desired = useRef(new Map<string, boolean>());
  const confirmed = useRef(new Map<string, boolean>());
  const sending = useRef(new Set<string>());

  // 散布の記録や切り替えがホームで変わることがあるので、タブに来るたびに取り直す
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchPesticides()
        .then((p) => {
          if (!alive) return;
          setMaster(p);
          setLoadFailed(false);
          // 送信中の薬剤は、押された値のまま残す
          const next: Record<string, boolean> = {};
          for (const x of p.pesticides) {
            if (sending.current.has(x.id)) {
              next[x.id] = desired.current.get(x.id) ?? x.hidden;
            } else {
              next[x.id] = x.hidden;
              confirmed.current.set(x.id, x.hidden);
              desired.current.set(x.id, x.hidden);
            }
          }
          setHiddenIds(next);
        })
        .catch(() => alive && setLoadFailed(true));
      fetchUsage(new Date().getFullYear())
        .then((u) => alive && setUsage(u))
        .catch(() => alive && setUsage(null));
      fetchDiseases()
        .then((d) => alive && setDiseases([...d].sort((a, b) => b.priority - a.priority)))
        .catch(() => alive && setDiseases([]));
      return () => {
        alive = false;
      };
    }, []),
  );

  const sorted = useMemo(
    () => (master ? [...master.pesticides].sort((a, b) => a.name.localeCompare(b.name, "ja")) : []),
    [master],
  );
  const byDisease = useMemo(() => (diseaseId ? pesticidesForDisease(sorted, diseaseId) : sorted), [sorted, diseaseId]);
  // 「すべて」のときは hiddenIds に依存させず、切り替えで絞り込みをやり直さない
  const filterHidden = visibility === "all" ? null : hiddenIds;
  const byVisibility = useMemo(
    () => (filterHidden ? byDisease.filter((p) => !!filterHidden[p.id] === (visibility === "hidden")) : byDisease),
    [byDisease, visibility, filterHidden],
  );
  const items = useMemo(() => searchPesticides(byVisibility, query), [byVisibility, query]);

  // 同じ薬剤は1本ずつ送り、送っている間に押し直されたら最後の値を送り直す
  const flush = useCallback(async (p: Pesticide) => {
    if (sending.current.has(p.id)) return;
    sending.current.add(p.id);
    try {
      while (desired.current.get(p.id) !== confirmed.current.get(p.id)) {
        const hidden = desired.current.get(p.id)!;
        await setPesticideHidden(p.id, hidden);
        confirmed.current.set(p.id, hidden);
      }
    } catch {
      const hidden = confirmed.current.get(p.id) ?? p.hidden;
      desired.current.set(p.id, hidden);
      setHiddenIds((prev) => ({ ...prev, [p.id]: hidden }));
      setError(`「${p.name}」の設定を保存できませんでした。通信状況を確認してください`);
    } finally {
      sending.current.delete(p.id);
    }
  }, []);

  // 画面にはすぐ反映し、保存は待たない
  const setHidden = useCallback(
    (ps: Pesticide[], hidden: boolean) => {
      if (ps.length === 0) return;
      setError(null);
      for (const p of ps) desired.current.set(p.id, hidden);
      setHiddenIds((prev) => {
        const next = { ...prev };
        for (const p of ps) next[p.id] = hidden;
        return next;
      });
      for (const p of ps) void flush(p);
    },
    [flush],
  );

  const toggle = useCallback((p: Pesticide, shown: boolean) => setHidden([p], !shown), [setHidden]);

  // 一覧に出ている薬剤をまとめて切り替える。全部表示のときだけオン
  const allShown = items.length > 0 && items.every((p) => !hiddenIds[p.id]);
  const toggleAll = (shown: boolean) => setHidden(items.filter((p) => !hiddenIds[p.id] !== shown), !shown);

  const openRow = useCallback((id: string) => setOpenId((cur) => (cur === id ? null : id)), []);

  const renderItem = useCallback(
    ({ item }: { item: Pesticide }) => (
      <PesticideRow
        item={item}
        hidden={!!hiddenIds[item.id]}
        open={openId === item.id}
        count={usage ? (usage.byPesticide[item.id] ?? 0) : null}
        onToggle={toggle}
        onOpen={openRow}
      />
    ),
    [hiddenIds, openId, usage, toggle, openRow],
  );

  // 検索欄と絞り込みは一覧の上に固定する
  const header = (
    <View style={styles.refHead}>
      <Text style={styles.title}>農薬</Text>
      <TextInput
        style={styles.search}
        placeholder="薬剤名・種類・FRAC・病害虫名で探す"
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
      />
      {diseases.length > 0 && (
        <View style={styles.chipRow}>
          <Chip label="すべての病害" on={diseaseId == null} onPress={() => setDiseaseId(null)} />
          {diseases.map((d) => (
            <Chip key={d.id} label={d.name} on={diseaseId === d.id} onPress={() => setDiseaseId(d.id)} />
          ))}
        </View>
      )}
      <View style={styles.chipRow}>
        {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
          <Chip key={v} label={VISIBILITY_LABEL[v]} on={visibility === v} onPress={() => setVisibility(v)} />
        ))}
      </View>
      {error && <Text style={styles.errorFlash}>{error}</Text>}
      {master && (
        <View style={styles.refBulkRow}>
          <Text style={styles.refCount}>{items.length}件</Text>
          <View style={styles.refBulk}>
            <Text style={styles.refBulkLabel}>{allShown ? "すべて表示" : "一部非表示"}</Text>
            <Switch
              value={allShown}
              onValueChange={toggleAll}
              disabled={items.length === 0}
              trackColor={{ true: COLORS.leaf, false: COLORS.line }}
              accessibilityLabel="一覧の薬剤をまとめて表示・非表示にする"
            />
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.refList}
        ListEmptyComponent={
          <Text style={styles.emptyNote}>
            {loadFailed
              ? "薬剤の一覧を取得できませんでした。通信状況を確認してください。"
              : master
                ? "条件に合う薬剤はありません"
                : "読み込み中…"}
          </Text>
        }
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}
