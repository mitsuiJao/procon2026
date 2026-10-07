import React from "react";
import { Text, TouchableOpacity } from "react-native";

import { styles } from "@/components/grape-protect/styles";

type ChipProps = { label: string; on: boolean; onPress: () => void };

/** 絞り込みの選択肢。選ばれているものは塗りつぶす */
export function Chip({ label, on, onPress }: ChipProps) {
  return (
    <TouchableOpacity style={on ? styles.chipOn : styles.chip} onPress={onPress}>
      <Text style={on ? styles.chipTextOn : styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}
