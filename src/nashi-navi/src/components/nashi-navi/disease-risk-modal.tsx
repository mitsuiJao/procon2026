import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { COLORS, styles } from "@/components/nashi-navi/styles";
import type { DiseaseRisk, PesticidesById, PesticideMasterItem } from "@/components/nashi-navi/types";

type DiseaseRiskModalProps = {
  visible: boolean;
  selectedDisease: DiseaseRisk | null;
  pesticides: PesticidesById;
  onClose: () => void;
  onApply: (pesticide: PesticideMasterItem, diseaseName: string) => void;
};

export function DiseaseRiskModal({
  visible,
  selectedDisease,
  pesticides,
  onClose,
  onApply,
}: DiseaseRiskModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.diseaseModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⚠️ {selectedDisease?.name} 警告</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.diseaseScroll}>
            <Text style={styles.dSectionTitle}>発生条件</Text>
            <Text style={styles.dText}>{selectedDisease?.triggerText}</Text>

            <Text style={styles.dSectionTitle}>主な症状</Text>
            <Text style={styles.dText}>{selectedDisease?.symptom}</Text>

            <Text style={[styles.dSectionTitle, { marginTop: 20, color: COLORS.primaryDark }]}>推奨される対応農薬</Text>
            {selectedDisease?.pesticides.map((pId) => {
              const pesticide = pesticides[pId];
              if (!pesticide) return null;

              return (
                <View key={pId} style={styles.pestCard}>
                  <Text style={styles.pestName}>{pesticide.name}</Text>
                  <View style={styles.pestInfoRow}>
                    <Text style={styles.pestLabel}>FRAC: <Text style={styles.pestValue}>{pesticide.frac}</Text></Text>
                    <Text style={styles.pestLabel}>希釈: <Text style={styles.pestValue}>{pesticide.dilution}</Text></Text>
                    <Text style={styles.pestLabel}>上限: <Text style={styles.pestValue}>{pesticide.max}</Text></Text>
                  </View>
                  <Text style={styles.pestNote}>{pesticide.note}</Text>
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => onApply(pesticide, selectedDisease.name)}
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
  );
}
