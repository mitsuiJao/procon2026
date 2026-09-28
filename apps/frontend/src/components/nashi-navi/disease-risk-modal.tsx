import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

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
            <Text style={styles.modalTitle}>{selectedDisease?.name}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="閉じる">
              <Feather name="x" size={22} color={COLORS.inkSoft} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.diseaseScroll}>
            <Text style={styles.legend2}>発生しやすい条件</Text>
            <Text style={styles.dText}>{selectedDisease?.triggerText}</Text>

            <Text style={styles.legend2}>主な症状</Text>
            <Text style={styles.dText}>{selectedDisease?.symptom}</Text>

            <Text style={styles.legend2}>使える薬剤</Text>
            {selectedDisease?.pesticides.map((pId) => {
              const pesticide = pesticides[pId];
              if (!pesticide) return null;

              return (
                <View key={pId} style={styles.pestItem}>
                  <Text style={styles.pestName}>{pesticide.name}</Text>
                  <View style={styles.pestInfoRow}>
                    <Text style={styles.pestLabel}>希釈 <Text style={styles.pestValue}>{pesticide.dilution}</Text></Text>
                    <Text style={styles.pestLabel}>使用回数 <Text style={styles.pestValue}>{pesticide.max}</Text></Text>
                    <Text style={styles.pestLabel}>FRAC <Text style={styles.pestValue}>{pesticide.frac}</Text></Text>
                  </View>
                  <Text style={styles.pestNote}>{pesticide.note}</Text>
                  <TouchableOpacity
                    style={styles.applyLink}
                    onPress={() => onApply(pesticide, selectedDisease.name)}
                  >
                    <Text style={styles.applyLinkText}>今日の散布として記録</Text>
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
