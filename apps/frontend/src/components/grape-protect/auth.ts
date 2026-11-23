import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "api_token";

// 保存先: ネイティブは SecureStore、web は localStorage（SecureStore は web 非対応）
async function read(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

async function write(token: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (token === null) globalThis.localStorage?.removeItem(KEY);
      else globalThis.localStorage?.setItem(KEY, token);
      return;
    }
    if (token === null) await SecureStore.deleteItemAsync(KEY);
    else await SecureStore.setItemAsync(KEY, token);
  } catch {
    // 保存できなくてもメモリ上のトークンでこのセッションは動く
  }
}

let current: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** 起動時に保存済みトークンを読み込む */
export async function loadToken(): Promise<string | null> {
  if (!loaded) {
    current = await read();
    loaded = true;
  }
  return current;
}

export function getToken(): string | null {
  return current;
}

export async function setToken(token: string): Promise<void> {
  current = token.trim();
  loaded = true;
  await write(current);
  emit();
}

/** ログアウト、または 401 を受けたとき */
export async function clearToken(): Promise<void> {
  current = null;
  loaded = true;
  await write(null);
  emit();
}

export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
