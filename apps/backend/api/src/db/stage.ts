import { pool } from "./client";

/**
 * 生育ステージの切り替わり記録を全件取得する（昇順）
 * @returns { stage, effectiveFrom }[] effectiveFrom 昇順
 */
export async function getStageTransitions(): Promise<
  { stage: number; effectiveFrom: string }[]
> {
  const { rows } = await pool.query(
    `SELECT stage, to_char(effective_from, 'YYYY-MM-DD') AS "effectiveFrom"
       FROM stage_transitions
      ORDER BY effective_from`,
  );
  return rows;
}

/**
 * 生育ステージの切り替わりを記録する。同じ日の記録があれば上書きする
 * @param stage 生育ステージ（stages.yaml の value, 0〜10）
 * @param effectiveFrom このステージに入った日 (YYYY-MM-DD)
 */
export async function writeStageTransition(stage: number, effectiveFrom: string) {
  await pool.query(
    `INSERT INTO stage_transitions (stage, effective_from)
     VALUES ($1, $2)
     ON CONFLICT (effective_from) DO UPDATE
       SET stage = EXCLUDED.stage`,
    [stage, effectiveFrom],
  );
}
