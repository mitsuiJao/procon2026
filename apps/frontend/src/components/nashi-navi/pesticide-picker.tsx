import React, { useMemo, useState } from "react";
import { FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { COLORS, styles } from "@/components/nashi-navi/styles";
import { searchPesticides } from "@/components/nashi-navi/utils";
import type { Pesticide, SprayUsage } from "@/components/nashi-navi/types";

type PesticidePickerProps = {
  pesticides: Pesticide[];
  usage: SprayUsage | null;
  onPick: (pesticide: Pesticide) => void;
  /** 「その他」を選んだとき（自由入力） */
  onPickOther: () => void;
  onBack: () => void;
};

/** 農薬の選択。名前で絞り込み、一覧にないときは「その他」で自由入力にする */
export function PesticidePicker({ pesticides, usage, onPick, onPickOther, onBack }: PesticidePickerProps) {
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => [...pesticides].sort((a, b) => a.name.localeCompare(b.name, "ja")), [pesticides]);
  const items = searchPesticides(sorted, query);

  return (
    <View style={styles.pickerWrap}>
      <View style={styles.panelHead}>
        <Text style={styles.panelDate}>薬剤を選ぶ</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onBack} accessibilityLabel="戻る">
          <Feather name="x" size={22} color={COLORS.inkSoft} />
        </TouchableOpacity>
      </View>
      <TextInput style={styles.search} placeholder="薬剤名で探す" value={query} onChangeText={setQuery} />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <TouchableOpacity style={styles.pickerRow} onPress={onPickOther}>
            <Text style={styles.pestName}>その他（一覧にない薬剤）</Text>
            <Text style={styles.sprayMeta}>薬剤名を手で入力します</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<Text style={styles.emptyNote}>「{query}」を含む薬剤はありません</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.pickerRow} onPress={() => onPick(item)}>
            <Text style={styles.pestName}>{item.name}</Text>
            <View style={styles.pickerMeta}>
              <Text style={styles.pestLabel}>
                FRAC <Text style={styles.pestValue}>{item.fracCodes.join(" / ") || "不明"}</Text>
              </Text>
              <Text style={styles.pestLabel}>
                今年 <Text style={styles.pestValue}>{usage ? `${usage.byPesticide[item.id] ?? 0}回` : "—"}</Text>
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
