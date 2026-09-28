import React from "react";
import { Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { COLORS, styles } from "@/components/nashi-navi/styles";
import type { wIcon as WIcon } from "@/components/nashi-navi/utils";
import type { FormState, WeatherByDate } from "@/components/nashi-navi/types";

type DayDetailModalProps = {
  visible: boolean;
  y: number;
  m: number;
  selectedDay: number | null;
  weatherByDate: WeatherByDate;
  form: FormState;
  saveFlash: string;
  wIcon: typeof WIcon;
  dateKeyOf: (year: number, month: number, day: number) => string;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
  onFormChange: (next: FormState) => void;
};

export function DayDetailModal({
  visible,
  y,
  m,
  selectedDay,
  weatherByDate,
  form,
  saveFlash,
  wIcon,
  dateKeyOf,
  onClose,
  onDelete,
  onSave,
  onFormChange,
}: DayDetailModalProps) {
  const selectedWeather = selectedDay ? weatherByDate[dateKeyOf(y, m, selectedDay)] : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelDate}>
              {y}年{m + 1}月{selectedDay}日
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="閉じる">
              <Feather name="x" size={22} color={COLORS.inkSoft} />
            </TouchableOpacity>
          </View>

          <Text style={styles.legend2}>気象</Text>
          {selectedWeather ? (
            <View>
              <View style={styles.tableRow}><Text style={styles.tableLabel}>天気</Text><Text style={styles.tableValue}>{wIcon(selectedWeather.code)?.label ?? "—"}</Text></View>
              <View style={styles.tableRow}><Text style={styles.tableLabel}>最高気温</Text><Text style={styles.tableValue}>{selectedWeather.tmax != null ? `${selectedWeather.tmax}℃` : "—"}</Text></View>
              <View style={styles.tableRow}><Text style={styles.tableLabel}>最低気温</Text><Text style={styles.tableValue}>{selectedWeather.tmin != null ? `${selectedWeather.tmin}℃` : "—"}</Text></View>
              <View style={styles.tableRow}><Text style={styles.tableLabel}>平均湿度</Text><Text style={styles.tableValue}>{selectedWeather.humidity != null ? `${selectedWeather.humidity}%` : "—"}</Text></View>
            </View>
          ) : (
            <Text style={styles.emptyNote}>この日の気象データはありません</Text>
          )}

          <Text style={styles.legend2}>散布</Text>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>薬剤名</Text>
              <TextInput style={styles.input} placeholder="例: ジマンダイセン水和剤" value={form.pestName} onChangeText={(pestName) => onFormChange({ ...form, pestName })} />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>希釈倍率</Text>
              <TextInput style={styles.input} placeholder="例: 600倍" value={form.pestDilution} onChangeText={(pestDilution) => onFormChange({ ...form, pestDilution })} />
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>散布量</Text>
              <TextInput style={styles.input} placeholder="例: 300L/10a" value={form.pestAmount} onChangeText={(pestAmount) => onFormChange({ ...form, pestAmount })} />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>対象病害虫</Text>
              <TextInput style={styles.input} placeholder="例: 黒斑病" value={form.pestTarget} onChangeText={(pestTarget) => onFormChange({ ...form, pestTarget })} />
            </View>
          </View>
          <Text style={styles.label}>備考</Text>
          <TextInput style={styles.input} placeholder="収穫前日数・天候など" value={form.pestNote} onChangeText={(pestNote) => onFormChange({ ...form, pestNote })} />

          <Text style={styles.legend2}>日誌メモ</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            multiline
            placeholder="作業内容、生育状況、気づいたことなど"
            value={form.memo}
            onChangeText={(memo) => onFormChange({ ...form, memo })}
          />

          <View style={styles.panelActions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={onDelete}>
              <Text style={styles.btnSecondaryText}>記録を削除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={onSave}>
              <Text style={styles.btnText}>保存</Text>
            </TouchableOpacity>
          </View>
          {saveFlash ? <Text style={styles.saveFlash}>{saveFlash}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
