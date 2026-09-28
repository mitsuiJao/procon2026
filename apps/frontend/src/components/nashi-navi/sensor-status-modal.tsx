import React from "react";
import { Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { styles } from "@/components/nashi-navi/styles";
import type { SensorReading, SensorStatus } from "@/components/nashi-navi/types";

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
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>

          {state === "loading" ? (
            <Text style={styles.emptyNote}>取得中…</Text>
          ) : state === "error" ? (
            <Text style={styles.emptyNote}>取得に失敗しました</Text>
          ) : sensors.length === 0 ? (
            <Text style={styles.emptyNote}>センサーデータがありません</Text>
          ) : (
            sensors.map((s) => (
              <View key={s.device} style={styles.sensorCard}>
                <View style={styles.sensorHead}>
                  <Text style={styles.sensorName}>{s.device}</Text>
                  {s.stale && <Text style={styles.staleBadge}>未受信</Text>}
                </View>
                <View style={styles.amedasBox}>
                  <View style={styles.amedasRow}><Text style={styles.amedasLabel}>気温</Text><Text style={styles.amedasValue}>{fmtReading(s.temp, "℃")}</Text></View>
                  <View style={styles.amedasRow}><Text style={styles.amedasLabel}>湿度</Text><Text style={styles.amedasValue}>{fmtReading(s.humidity, "%")}</Text></View>
                  <View style={styles.amedasRow}><Text style={styles.amedasLabel}>24時間雨量</Text><Text style={styles.amedasValue}>{s.rainfall24h != null ? `${s.rainfall24h}mm` : "—"}</Text></View>
                  <View style={styles.amedasRow}><Text style={styles.amedasLabel}>最終受信</Text><Text style={styles.amedasValue}>{fmtTime(s.updatedAt)}</Text></View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
