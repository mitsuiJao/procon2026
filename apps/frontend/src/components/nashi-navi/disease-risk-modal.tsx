import React, { useMemo, useState } from "react";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { COLORS, styles } from "@/components/nashi-navi/styles";
import { pesticidesForDisease, searchPesticides } from "@/components/nashi-navi/utils";
import type { DiseaseRisk, Pesticide, PesticideApplication, PesticideMaster, SprayUsage } from "@/components/nashi-navi/types";

type DiseaseRiskModalProps = {
  visible: boolean;
  selectedDisease: DiseaseRisk | null;
  master: PesticideMaster | null;
  usage: SprayUsage | null;
  onClose: () => void;
  onApply: (pesticide: Pesticide, application: PesticideApplication, diseaseName: string) => void;
};

const fmtShortDate = (date: string) => date.slice(5).replace("-", "/");

export function DiseaseRiskModal({ visible, selectedDisease, master, usage, onClose, onApply }: DiseaseRiskModalProps) {
  const [query, setQuery] = useState("");
  const registered = useMemo(
    () => (master && selectedDisease ? pesticidesForDisease(master.pesticides, selectedDisease.id) : []),
    [master, selectedDisease],
  );
  const items = searchPesticides(registered, query);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <View style={styles.diseaseModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedDisease?.name}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="閉じる">
              <Feather name="x" size={22} color={COLORS.inkSoft} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.diseaseScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.legend2}>発生しやすい条件</Text>
            <Text style={styles.dText}>{selectedDisease?.triggerText}</Text>

            <Text style={styles.legend2}>主な症状</Text>
            <Text style={styles.dText}>{selectedDisease?.symptom}</Text>

            <Text style={styles.legend2}>登録のある薬剤（{registered.length}件）</Text>
            {master ? (
              <Text style={styles.sourceNote}>
                {master.source}（{master.retrievedAt} 時点）より。推奨ではなく、この病害に登録のある薬剤の一覧です。
              </Text>
            ) : (
              <Text style={styles.emptyNote}>薬剤の一覧を取得できませんでした。通信状況を確認してください。</Text>
            )}
            {registered.length > 0 && (
              <TextInput style={styles.search} placeholder="薬剤名で探す" value={query} onChangeText={setQuery} />
            )}

            {selectedDisease &&
              items.map((p) => (
                <View key={p.id} style={styles.pestItem}>
                  <Text style={styles.pestName}>{p.name}</Text>
                  {p.applications
                    .filter((a) => a.diseaseId === selectedDisease.id)
                    .map((a, i) => (
                      <View key={i} style={styles.pestInfoRow}>
                        {a.dilution ? <Text style={styles.pestLabel}>希釈 <Text style={styles.pestValue}>{a.dilution}</Text></Text> : null}
                        {a.timing ? <Text style={styles.pestLabel}>時期 <Text style={styles.pestValue}>{a.timing}</Text></Text> : null}
                        {a.uses && a.uses !== "-" ? <Text style={styles.pestLabel}>本剤の使用回数 <Text style={styles.pestValue}>{a.uses}</Text></Text> : null}
                      </View>
                    ))}
                  <View style={styles.pestInfoRow}>
                    <Text style={styles.pestLabel}>
                      今年この薬剤 <Text style={styles.pestValue}>{usage ? `${usage.byPesticide[p.id] ?? 0}回` : "—"}</Text>
                    </Text>
                    {p.fracCodes.length === 0 ? (
                      <Text style={styles.pestLabel}>FRAC <Text style={styles.pestValue}>不明</Text></Text>
                    ) : (
                      p.fracCodes.map((code) => {
                        const f = usage?.byFrac[code];
                        return (
                          <Text key={code} style={styles.pestLabel}>
                            FRAC {code} <Text style={styles.pestValue}>{!usage ? "—" : f ? `今年${f.count}回（最終 ${fmtShortDate(f.lastSprayedOn)}）` : "今年0回"}</Text>
                          </Text>
                        );
                      })
                    )}
                  </View>
                  {p.totalUseLimits.map((t) => (
                    <Text key={t} style={styles.pestNote}>{t}</Text>
                  ))}
                  <TouchableOpacity
                    style={styles.applyLink}
                    onPress={() => {
                      const app = p.applications.find((a) => a.diseaseId === selectedDisease.id)!;
                      setQuery("");
                      onApply(p, app, selectedDisease.name);
                    }}
                  >
                    <Text style={styles.applyLinkText}>今日の散布として記録</Text>
                  </TouchableOpacity>
                </View>
              ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
