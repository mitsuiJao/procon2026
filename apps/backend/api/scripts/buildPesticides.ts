/**
 * 農薬登録情報の CSV から data/vocab/pesticides.yaml を作る。
 * 使い方: npm run build:pesticides
 *
 * CSV は1行が「農薬 × 作物 × 病害虫 × 使い方」。登録番号でまとめ、農薬の下に適用（applications）を並べる。
 * FRAC コードは有効成分からたどるので、CSV の FRAC コード列は照合にだけ使う（Excel で日付に化けた値を含むため）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";

const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "../../data");
const CSV_FILE = "pesticides_updated-utf8.csv";
const SOURCE = "農林水産省 農薬登録情報提供システム";
const RETRIEVED_AT = "2026-09";

/** ダブルクォートに対応した最小限の CSV パーサ */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const blankToNull = (s: string) => (s.trim() === "" || s.trim() === "-" || s.trim() === "－" ? null : s.trim());

/** 「収穫N日前まで」→ N、「収穫前日まで」→ 1。それ以外（生育期で書かれた時期など）は null */
function parsePreHarvestDays(timing: string): number | null {
  const m = timing.match(/収穫(\d+)日前/);
  if (m) return Number(m[1]);
  return timing.includes("収穫前日") ? 1 : null;
}

/** 「3回以内」「4回以内(開花後は1回)」「1回」→ 先頭の数。"-" は null */
function parseMaxUses(uses: string): number | null {
  const m = uses.match(/^(\d+)回/);
  return m ? Number(m[1]) : null;
}

const toIsoDate = (s: string) => {
  const [y, m, d] = s.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

const DILUTION_UNIT_TIMES = "32"; // 希釈倍数使用量(単位) のコード。32 = 倍

const HEADER = `# 農薬（商品）マスター。散布記録のプルダウンと、使用回数・FRAC ローテーションの集計に使う。
# 散布記録（spray_records.pesticide_id）がこの id を参照する。
#
# ※ このファイルは api/scripts/buildPesticides.ts の生成物。手で直さず、CSV を差し替えてスクリプトを流し直す。
#
# source / retrievedAt   元データの出典と取得時期。
# pesticides[]
#   id                 登録番号（文字列、不変）。同名で登録番号が違う品目があるので名前は id にしない。
#   nameJa             農薬の名称。画面にそのまま出る。
#   kind               農薬の種類。
#   use                用途（殺菌剤・殺虫殺菌剤など）。
#   registeredOn       登録年月日。
#   activeIngredients  有効成分の id。activeIngredients.yaml にあるものは FRAC コードをたどれる。
#                      無いもの（石灰硫黄合剤・微生物剤など）は FRAC 不明として扱う。
#   totalUseLimits     有効成分ごとの総使用回数（原文）。
#   fracNote           FRAC 分類の補足（任意）。
#   applications[]     適用。CSV の1行に対応する。
#     crop / target / method        作物名称 / 病害虫雑草 / 使用方法（原文）。
#     diseaseId                     diseases.yaml の nameJa と target が一致するときの id。無ければ null。
#     dilution / dilutionMin / Max  希釈倍数使用量の原文と、単位が「倍」のときの数値。
#     timing / preHarvestDays       使用時期の原文と、「収穫N日前まで」から取り出した N（前日 = 1）。
#     sprayVolume                   散布液量（原文）。
#     uses / maxUses                本剤の使用回数の原文と、先頭の数。

`;

function main() {
  const text = readFileSync(path.join(DATA_DIR, CSV_FILE), "utf8").replace(/^﻿/, "");
  const [header, ...body] = parseCsv(text).filter((r) => r.some((f) => f !== ""));
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`${CSV_FILE}: 列 ${name} がありません`);
    return i;
  };
  const C = {
    regNo: col("登録番号"), kind: col("農薬の種類"), name: col("農薬の名称"), use: col("用途"),
    registeredOn: col("登録年月日"), crop: col("作物名称"), target: col("病害虫雑草"), method: col("使用方法"),
    dilution: col("希釈倍数使用量"), dilutionMin: col("希釈倍数使用量(最小)"), dilutionMax: col("希釈倍数使用量(最大)"),
    dilutionUnit: col("希釈倍数使用量(単位)"), timing: col("使用時期"), sprayVolume: col("散布液量"),
    uses: col("本剤の使用回数"), ingredients: col("FRAC有効成分"), fracCodes: col("FRACコード"),
    fracNote: col("FRAC備考"), note1: col("備考1"), note2: col("備考2"),
  };

  const diseaseIdByName = new Map(
    (parse(readFileSync(path.join(DATA_DIR, "vocab/diseases.yaml"), "utf8")) as { id: string; nameJa: string }[]).map(
      (d) => [d.nameJa, d.id],
    ),
  );
  const fracByIngredient = new Map(
    (parse(readFileSync(path.join(DATA_DIR, "vocab/activeIngredients.yaml"), "utf8")) as { id: string; fracCode: string }[]).map(
      (a) => [a.id, String(a.fracCode)],
    ),
  );

  const byId = new Map<string, any>();
  const unknownIngredients = new Set<string>();
  const warnings = new Set<string>();

  for (const r of body) {
    const id = r[C.regNo].trim();
    const ingredients = r[C.ingredients].split("/").map((s) => s.trim()).filter(Boolean);

    let p = byId.get(id);
    if (!p) {
      p = {
        id,
        nameJa: r[C.name].trim(),
        kind: r[C.kind].trim(),
        use: r[C.use].trim(),
        registeredOn: toIsoDate(r[C.registeredOn].trim()),
        activeIngredients: ingredients,
        totalUseLimits: [] as string[],
        ...(blankToNull(r[C.fracNote]) ? { fracNote: r[C.fracNote].trim() } : {}),
        applications: [] as any[],
      };
      byId.set(id, p);
    } else if (p.nameJa !== r[C.name].trim() || p.activeIngredients.join("/") !== ingredients.join("/")) {
      throw new Error(`登録番号 ${id} の名称か有効成分が行ごとに違います`);
    }
    for (const note of [r[C.note1], r[C.note2]].map((s) => s.trim())) {
      if (note && !p.totalUseLimits.includes(note)) p.totalUseLimits.push(note);
    }

    // CSV の FRAC コード列と、有効成分からたどった値を照合する。日付に化けた値（例 10月1日）は照合しない
    const csvCodes = r[C.fracCodes].split("/").map((s) => s.trim());
    if (!/月.*日/.test(r[C.fracCodes])) {
      ingredients.forEach((a, i) => {
        const code = fracByIngredient.get(a);
        if (code === undefined) unknownIngredients.add(a);
        else if (csvCodes[i] !== code) warnings.add(`${p.nameJa}: ${a} は ${code} だが CSV は ${csvCodes[i] ?? "(なし)"}`);
      });
    } else {
      ingredients.filter((a) => !fracByIngredient.has(a)).forEach((a) => unknownIngredients.add(a));
    }

    const target = blankToNull(r[C.target]);
    const timing = blankToNull(r[C.timing]);
    const uses = r[C.uses].trim();
    const timesUnit = r[C.dilutionUnit].trim() === DILUTION_UNIT_TIMES;
    p.applications.push({
      crop: r[C.crop].trim(),
      target,
      diseaseId: (target && diseaseIdByName.get(target)) ?? null,
      method: r[C.method].trim(),
      dilution: blankToNull(r[C.dilution]),
      dilutionMin: timesUnit && r[C.dilutionMin] ? Number(r[C.dilutionMin]) : null,
      dilutionMax: timesUnit && r[C.dilutionMax] ? Number(r[C.dilutionMax]) : null,
      timing,
      preHarvestDays: timing ? parsePreHarvestDays(timing) : null,
      sprayVolume: blankToNull(r[C.sprayVolume]),
      uses: uses === "" ? null : uses,
      maxUses: parseMaxUses(uses),
    });
  }

  const pesticides = [...byId.values()];
  const doc = { source: SOURCE, retrievedAt: RETRIEVED_AT, generatedFrom: CSV_FILE, pesticides };
  writeFileSync(path.join(DATA_DIR, "vocab/pesticides.yaml"), HEADER + stringify(doc, { lineWidth: 0 }));

  const apps = pesticides.flatMap((p) => p.applications);
  console.log(`品目 ${pesticides.length} / 適用 ${apps.length} / diseaseId あり ${apps.filter((a) => a.diseaseId).length}`);
  console.log(`FRAC 不明の有効成分: ${[...unknownIngredients].join(", ") || "なし"}`);
  for (const w of warnings) console.warn(`警告: ${w}`);
}

main();
