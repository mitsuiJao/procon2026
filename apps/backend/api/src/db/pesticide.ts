import { pool } from "./client";

/**
 * 散布記録のプルダウンに出さない農薬の id
 * @returns 登録番号の集合
 */
export async function getHiddenPesticideIds(): Promise<Set<string>> {
  const { rows } = await pool.query<{ pesticide_id: string }>("SELECT pesticide_id FROM hidden_pesticides");
  return new Set(rows.map((r) => r.pesticide_id));
}

/**
 * 農薬をプルダウンに出す・出さないを切り替える
 * @param pesticideId 登録番号
 * @param hidden true なら出さない
 */
export async function setPesticideHidden(pesticideId: string, hidden: boolean) {
  if (hidden) {
    await pool.query("INSERT INTO hidden_pesticides (pesticide_id) VALUES ($1) ON CONFLICT DO NOTHING", [pesticideId]);
  } else {
    await pool.query("DELETE FROM hidden_pesticides WHERE pesticide_id = $1", [pesticideId]);
  }
}
