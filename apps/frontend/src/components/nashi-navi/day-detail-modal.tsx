import React, { useState } from "react";
import { Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { PesticidePicker } from "@/components/nashi-navi/pesticide-picker";
import { COLORS, styles } from "@/components/nashi-navi/styles";
import { alertsOf, emptySprayForm, fmtApplication, LEVEL_LABEL, LOOKBACK_KIND_LABEL, type wIcon as WIcon } from "@/components/nashi-navi/utils";
import type { DayData, DayRisk, DiseaseInfo, LookbackItem, Pesticide, SprayForm, SprayRecord, SprayUsage, WeatherEntry } from "@/components/nashi-navi/types";

export type Flash = { text: string; error: boolean } | null;

type DayDetailModalProps = {
  visible: boolean;
  /** YYYY-MM-DD */
  date: string | null;
  weather: WeatherEntry | null;
  risk: DayRisk | null;
  /** false なら病害リスクの欄を出さない（1週間より先の日） */
  showRisk: boolean;
  diseases: DiseaseInfo[];
  /** その日の生育ステージ（判定の結果から。1週間より先の日も入る） */
  stage: Pick<DayRisk, "stage" | "stageSource"> | null;
  /** 生育ステージの名前。{ value: 名前 } */
  stageNames: Record<number, string>;
  /** その日がステージの記録の切り替わり日か */
  isStageTransition: boolean;
  /** true ならステージを変えられる（今日と過去の日） */
  stageEditable: boolean;
  /** true なら病害の発生を記録できる（今日と過去の日） */
  observable: boolean;
  /** 今日より後の日（予報を含む判定） */
  forecast: boolean;
  day: DayData;
  /** 去年の同じ時期の記録。空なら欄を出さない */
  lookback: LookbackItem[];
  /** その期間の見出し（例: 2025年 9/24〜10/8） */
  lookbackLabel: string;
  pesticides: Pesticide[];
  usage: SprayUsage | null;
  /** 開いている散布のフォーム。null なら閉じている */
  sprayForm: SprayForm | null;
  memo: string;
  flash: Flash;
  wIcon: typeof WIcon;
  onClose: () => void;
  /** 病害の行を押したとき（日付の画面を閉じて病害の画面を開く） */
  onPressDisease: (disease: DiseaseInfo) => void;
  onSprayFormChange: (next: SprayForm | null) => void;
  onSaveSpray: () => void;
  onDeleteSpray: (id: number) => void;
  onMemoChange: (memo: string) => void;
  onSaveMemo: () => void;
  onSaveStage: (stage: number) => void;
  onClearStage: () => void;
  /** 病害の発生を記録する。記録済みなら取り消す */
  onToggleObservation: (disease: DiseaseInfo) => void;
};

const fmtTitle = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

const toForm = (s: SprayRecord): SprayForm => ({
  id: s.id,
  pesticideId: s.pesticideId,
  freeText: s.pesticideId == null,
  pesticide: s.pesticide,
  dilution: s.dilution,
  amount: s.amount,
  target: s.target,
  note: s.note,
});

export function DayDetailModal({
  visible,
  date,
  weather,
  risk,
  showRisk,
  diseases,
  stage,
  stageNames,
  isStageTransition,
  stageEditable,
  observable,
  forecast,
  day,
  lookback,
  lookbackLabel,
  pesticides,
  usage,
  sprayForm,
  memo,
  flash,
  wIcon,
  onClose,
  onPressDisease,
  onSprayFormChange,
  onSaveSpray,
  onDeleteSpray,
  onMemoChange,
  onSaveMemo,
  onSaveStage,
  onClearStage,
  onToggleObservation,
}: DayDetailModalProps) {
  const [picking, setPicking] = useState(false);
  const [stagePicking, setStagePicking] = useState(false);
  // 「去年の今ごろ」を開いている日付。別の日を開くと閉じた状態に戻る
  const [lookbackOpenFor, setLookbackOpenFor] = useState<string | null>(null);
  const lookbackOpen = date != null && lookbackOpenFor === date;

  const openForm = (next: SprayForm | null) => {
    setPicking(false);
    onSprayFormChange(next);
  };

  const close = () => {
    setPicking(false);
    setStagePicking(false);
    setLookbackOpenFor(null);
    onClose();
  };

  const alerts = alertsOf(risk ?? undefined, diseases);
  const stageName = stage?.stage != null ? stageNames[stage.stage] ?? `生育状態 ${stage.stage}` : null;
  const stageOptions = Object.entries(stageNames)
    .map(([value, name]) => ({ value: Number(value), name }))
    .sort((a, b) => a.value - b.value);

  const observationOptions = [...diseases].sort((a, b) => b.priority - a.priority);

  const selected = sprayForm?.pesticideId ? pesticides.find((p) => p.id === sprayForm.pesticideId) : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.safe}>
        {picking && sprayForm ? (
          <PesticidePicker
            pesticides={pesticides}
            usage={usage}
            onBack={() => setPicking(false)}
            onPick={(p) => {
              setPicking(false);
              onSprayFormChange({ ...sprayForm, pesticideId: p.id, freeText: false, pesticide: p.name });
            }}
            onPickOther={() => {
              setPicking(false);
              onSprayFormChange({ ...sprayForm, pesticideId: null, freeText: true, pesticide: "" });
            }}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.panel} keyboardShouldPersistTaps="handled">
            <View style={styles.panelHead}>
              <Text style={styles.panelDate}>{date ? fmtTitle(date) : ""}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="閉じる">
                <Feather name="x" size={22} color={COLORS.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={styles.legend2}>気象</Text>
            {weather ? (
              <View>
                <View style={styles.tableRow}><Text style={styles.tableLabel}>天気</Text><Text style={styles.tableValue}>{wIcon(weather.code)?.label ?? "—"}</Text></View>
                <View style={styles.tableRow}><Text style={styles.tableLabel}>最高気温</Text><Text style={styles.tableValue}>{weather.tmax != null ? `${weather.tmax}℃` : "—"}</Text></View>
                <View style={styles.tableRow}><Text style={styles.tableLabel}>最低気温</Text><Text style={styles.tableValue}>{weather.tmin != null ? `${weather.tmin}℃` : "—"}</Text></View>
                <View style={styles.tableRow}><Text style={styles.tableLabel}>平均湿度</Text><Text style={styles.tableValue}>{weather.humidity != null ? `${weather.humidity}%` : "—"}</Text></View>
              </View>
            ) : (
              <Text style={styles.emptyNote}>この日の気象データはありません</Text>
            )}

            <Text style={styles.legend2}>生育状態</Text>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>状態</Text>
              <Text style={styles.tableValue}>
                {stageName ? `${stageName}` : "—"}
              </Text>
            </View>
            {stageEditable &&
              (stagePicking ? (
                <View>
                  <Text style={styles.forecastNote}>この日から、選んだ生育状態になったと記録します</Text>
                  <View style={styles.chipRow}>
                    {stageOptions.map((o) => (
                      <TouchableOpacity
                        key={o.value}
                        style={o.value === stage?.stage ? styles.chipOn : styles.chip}
                        onPress={() => {
                          setStagePicking(false);
                          onSaveStage(o.value);
                        }}
                      >
                        <Text style={o.value === stage?.stage ? styles.chipTextOn : styles.chipText}>{o.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.memoActions}>
                    <TouchableOpacity style={styles.rowAction} onPress={() => setStagePicking(false)}>
                      <Text style={styles.rowActionText}>キャンセル</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.addBtn} onPress={() => setStagePicking(true)} disabled={stageOptions.length === 0}>
                    <Text style={styles.addBtnText}>生育状態を変更</Text>
                  </TouchableOpacity>
                  {isStageTransition && (
                    <TouchableOpacity style={styles.stageClear} onPress={onClearStage}>
                      <Text style={styles.rowActionDanger}>この日の記録を取り消す</Text>
                    </TouchableOpacity>
                  )}
                </>
              ))}

            {showRisk && (
              <>
                <Text style={styles.legend2}>病害リスク</Text>
                {risk ? (
                  <View>
                    {alerts.length === 0 ? (
                      <Text style={styles.emptyNote}>条件に該当する病害はありません</Text>
                    ) : (
                      alerts.map(({ disease, level }) => (
                        <TouchableOpacity
                          key={disease.id}
                          style={styles.riskRow}
                          onPress={() => {
                            setPicking(false);
                            setStagePicking(false);
                            onPressDisease(disease);
                          }}
                          accessibilityLabel={`${disease.name}の詳しい情報`}
                        >
                          <Text style={styles.riskName}>{disease.name}</Text>
                          <Text style={level === "conditions_met" ? styles.riskValue : styles.riskValueNear}>{LEVEL_LABEL[level]}</Text>
                          <Feather name="chevron-right" size={18} color={COLORS.inkSoft} />
                        </TouchableOpacity>
                      ))
                    )}
                    {forecast ? <Text style={styles.forecastNote}>予報をもとにした判定です</Text> : null}
                  </View>
                ) : (
                  <Text style={styles.emptyNote}>この日の判定はありません</Text>
                )}
              </>
            )}

            {observable && observationOptions.length > 0 && (
              <>
                <Text style={styles.legend2}>病害の発生</Text>
                <Text style={styles.forecastNote}>見つけた病害を押して記録します。もう一度押すと取り消します</Text>
                <View style={styles.chipRow}>
                  {observationOptions.map((d) => {
                    const on = day.observed.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={on ? styles.chipOn : styles.chip}
                        onPress={() => onToggleObservation(d)}
                        accessibilityLabel={on ? `${d.name}の発生記録を取り消す` : `${d.name}の発生を記録する`}
                      >
                        <Text style={on ? styles.chipTextOn : styles.chipText}>{d.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.legend2}>散布</Text>
            {day.sprays.length === 0 && !sprayForm && <Text style={styles.emptyNote}>この日の散布記録はありません</Text>}
            {day.sprays.map((s) => (
              <View key={s.id} style={styles.sprayRow}>
                <View style={styles.sprayMain}>
                  <Text style={styles.sprayName}>{s.pesticide}</Text>
                  {s.target ? <Text style={styles.sprayMeta}>{s.target}</Text> : null}
                  {s.note ? <Text style={styles.sprayMeta}>{s.note}</Text> : null}
                </View>
                <TouchableOpacity style={styles.rowAction} onPress={() => openForm(toForm(s))}>
                  <Text style={styles.rowActionText}>編集</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rowAction} onPress={() => onDeleteSpray(s.id)}>
                  <Text style={styles.rowActionDanger}>削除</Text>
                </TouchableOpacity>
              </View>
            ))}

            {sprayForm ? (
              <View style={styles.formBox}>
                <Text style={[styles.label, { marginTop: 0 }]}>薬剤</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setPicking(true)} accessibilityLabel="薬剤を選ぶ">
                  <Text style={sprayForm.pesticideId ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                    {sprayForm.pesticideId ? sprayForm.pesticide : sprayForm.freeText ? "その他（手入力）" : "薬剤を選ぶ"}
                  </Text>
                  <Feather name="chevron-right" size={18} color={COLORS.inkSoft} />
                </TouchableOpacity>
                {sprayForm.freeText && (
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    placeholder="薬剤名"
                    value={sprayForm.pesticide}
                    onChangeText={(pesticide) => onSprayFormChange({ ...sprayForm, pesticide })}
                  />
                )}
                {selected && (
                  <View style={styles.regList}>
                    <Text style={styles.regLine}>FRAC {selected.fracCodes.join(" / ") || "不明"}</Text>
                    {selected.applications.map((a, i) => (
                      <Text key={i} style={styles.regLine}>{fmtApplication(a)}</Text>
                    ))}
                  </View>
                )}

                <Text style={styles.label}>対象病害虫</Text>
                <TextInput style={styles.input} placeholder="例: べと病" value={sprayForm.target} onChangeText={(target) => onSprayFormChange({ ...sprayForm, target })} />
                <Text style={styles.label}>備考</Text>
                <TextInput style={styles.input} placeholder="天候・作業の様子など" value={sprayForm.note} onChangeText={(note) => onSprayFormChange({ ...sprayForm, note })} />

                <View style={styles.panelActions}>
                  <TouchableOpacity style={styles.btnSecondary} onPress={() => openForm(null)}>
                    <Text style={[styles.btnSecondaryText, { color: COLORS.inkSoft }]}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btn} onPress={onSaveSpray}>
                    <Text style={styles.btnText}>{sprayForm.id == null ? "散布を記録" : "変更を保存"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => openForm(emptySprayForm)}>
                <Text style={styles.addBtnText}>散布を追加</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.legend2}>日誌メモ</Text>
            <TextInput
              style={[styles.input, styles.textarea, { marginTop: 10 }]}
              multiline
              placeholder="作業内容、生育状況、気づいたことなど"
              value={memo}
              onChangeText={onMemoChange}
            />
            <View style={styles.memoActions}>
              <TouchableOpacity style={styles.btnInline} onPress={onSaveMemo}>
                <Text style={styles.btnText}>メモを保存</Text>
              </TouchableOpacity>
            </View>

            {flash ? <Text style={flash.error ? styles.errorFlash : styles.saveFlash}>{flash.text}</Text> : null}

            {lookback.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.accordionHead}
                  onPress={() => setLookbackOpenFor(lookbackOpen ? null : date)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: lookbackOpen }}
                  accessibilityLabel={`去年の今ごろの記録 ${lookback.length}件`}
                >
                  <Text style={styles.accordionTitle}>去年の今ごろ（{lookback.length}件）</Text>
                  <Feather name={lookbackOpen ? "chevron-up" : "chevron-down"} size={20} color={COLORS.inkSoft} />
                </TouchableOpacity>
                {lookbackOpen && (
                  <View>
                    <Text style={styles.forecastNote}>{lookbackLabel} の記録</Text>
                    {lookback.map((it, i) => (
                      <View key={i} style={styles.lookbackRow}>
                        <Text style={styles.lookbackDate}>{`${Number(it.date.slice(5, 7))}/${Number(it.date.slice(8))}`}</Text>
                        <Text style={styles.lookbackKind}>{LOOKBACK_KIND_LABEL[it.kind]}</Text>
                        <Text style={styles.lookbackText}>{it.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
