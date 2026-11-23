import React from "react";
import { Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { COLORS, styles } from "@/components/grape-protect/styles";
import type { SensorReading, SensorStatus } from "@/components/grape-protect/types";

export type SensorsState = "loading" | "error" | "ok";

type SensorStatusModalProps = {
  visible: boolean;
  sensors: SensorStatus[];
  state: SensorsState;
  onClose: () => void;
};

const fmtTime = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
const fmtReading = (r: SensorReading | null, unit: string) => (r ? `${r.value}${unit}` : "—");

export function SensorStatusModal({ visible, sensors, state, onClose }: SensorStatusModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelDate}>センサーの状態</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="閉じる">
              <Feather name="x" size={22} color={COLORS.inkSoft} />
            </TouchableOpacity>
          </View>

          {state === "loading" ? (
            <Text style={styles.emptyNote}>取得中</Text>
          ) : state === "error" ? (
            <Text style={styles.emptyNote}>取得できませんでした。通信状況を確認して、開き直してください。</Text>
          ) : sensors.length === 0 ? (
            <Text style={styles.emptyNote}>まだセンサーから受信していません</Text>
          ) : (
            sensors.map((s) => (
              <View key={s.device}>
                <View style={styles.sensorHead}>
                  <Text style={styles.monthLabel}>{s.device}</Text>
                  {s.stale && <Text style={styles.stale}>未受信</Text>}
                </View>
                <View style={styles.tableRow}><Text style={styles.tableLabel}>気温</Text><Text style={styles.tableValue}>{fmtReading(s.temp, "℃")}</Text></View>
                <View style={styles.tableRow}><Text style={styles.tableLabel}>湿度</Text><Text style={styles.tableValue}>{fmtReading(s.humidity, "%")}</Text></View>
                <View style={styles.tableRow}><Text style={styles.tableLabel}>24時間雨量</Text><Text style={styles.tableValue}>{s.rainfall24h != null ? `${s.rainfall24h}mm` : "—"}</Text></View>
                <View style={styles.tableRow}><Text style={styles.tableLabel}>最終受信</Text><Text style={styles.tableValue}>{fmtTime(s.updatedAt)}</Text></View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
