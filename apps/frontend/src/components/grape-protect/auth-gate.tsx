import React, { useEffect, useState, useSyncExternalStore } from "react";
import { SafeAreaView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { COLORS, styles } from "@/components/grape-protect/styles";
import { getToken, loadToken, setToken, subscribeToken } from "@/components/grape-protect/auth";

/** トークンが無い間はトークン入力画面を出し、あるときだけ children を描画する */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeToken, getToken, getToken);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    loadToken().finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (token) return <>{children}</>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.title}>アクセストークン</Text>
        <Text style={styles.subtitle}>サーバー管理者から受け取ったトークンを入力してください。</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="トークン"
          placeholderTextColor={COLORS.inkSoft}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={{ marginTop: 16, padding: 12, borderRadius: 4, backgroundColor: COLORS.paper, color: COLORS.ink }}
        />
        <TouchableOpacity
          disabled={!input.trim()}
          onPress={() => setToken(input)}
          style={{ marginTop: 16, padding: 12, borderRadius: 4, alignItems: "center", backgroundColor: COLORS.leaf, opacity: input.trim() ? 1 : 0.5 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>保存</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
