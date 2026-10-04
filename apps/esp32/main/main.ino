/*
 * ワイングレープロテクト センサーノード
 *   ESP32 + SHT31(温湿度) + SEN0575(雨量) → BG96(LTE-M) → MQTT
 *
 * 配線
 *   I2Cバス (SHT31 と SEN0575 を共用)
 *     SDA = GPIO21, SCL = GPIO22
 *     SHT31   : アドレス 0x45
 *     SEN0575 : アドレス 0x1D（固定）  ※基板のスイッチを I2C 側にしておくこと
 *   BG96ボード
 *     U1 TX -> GPIO25 (ESP32 RX)
 *     U1 RX <- GPIO26 (ESP32 TX)
 *     PWRKEY <- GPIO16
 *
 * 必要なライブラリ（ライブラリマネージャで入れる）
 *   - Adafruit SHT31 Library
 *   - DFRobot_RainfallSensor（添付のzipを「.ZIP形式のライブラリをインストール」）
 *   - DFRobot_RTU（I2Cでしか使わなくても、ヘッダがincludeしているので必須）
 */

#include <Wire.h>
#include <Adafruit_SHT31.h>
#include "DFRobot_RainfallSensor.h"

// ===== 設定 =====
#define I2C_SDA        22
#define I2C_SCL        21
#define SHT31_ADDR     0x45
#define RAIN_ADDR      0x1D

#define BG96_RX        15
#define BG96_TX        4
#define BG96_PWRKEY    16
#define PWRKEY_ACTIVE  LOW      // 押したときのレベル。起動しなければ LOW に変える

#define APN            "soracom.io"
#define APN_USER       "sora"
#define APN_PASS       "sora"

#define MQTT_HOST      "broker.mqtt.cool"  // ← 友人のブローカーに変更
#define MQTT_PORT      1883
#define MQTT_CLIENT_ID "grape-node-01"
#define MQTT_TOPIC     "grape/node01/data"

#define SEND_INTERVAL_MS  (60UL * 1000UL)     // 送信間隔（テスト用に1分）

// ===== オブジェクト =====
HardwareSerial bg96(2);
Adafruit_SHT31 sht31;
DFRobot_RainfallSensor_I2C rain(&Wire);

bool shtOK  = false;
bool rainOK = false;
unsigned long lastSend = 0;

// ------------------------------------------------------------
// BG96 用 ATコマンド補助
// ------------------------------------------------------------
// コマンドを送り、expect が返るまで待つ。ERROR が来たら即 false。
bool sendAT(const String &cmd, const char *expect, unsigned long timeoutMs = 2000) {
  while (bg96.available()) bg96.read();          // 受信バッファを空にする
  if (cmd.length()) {
    bg96.print(cmd);
    bg96.print("\r\n");
    Serial.print(">> "); Serial.println(cmd);
  }
  String resp;
  unsigned long t0 = millis();
  while (millis() - t0 < timeoutMs) {
    while (bg96.available()) {
      char c = bg96.read();
      resp += c;
    }
    if (resp.indexOf(expect) >= 0) {
      Serial.print("<< "); Serial.println(resp);
      return true;
    }
    if (resp.indexOf("ERROR") >= 0) break;
    delay(10);
  }
  Serial.print("<< (NG) "); Serial.println(resp);
  return false;
}

void bg96PowerOn() {
  if (sendAT("AT", "OK", 1000)) return;          // すでに起動している
  Serial.println("BG96 PWRKEY ON");
  digitalWrite(BG96_PWRKEY, PWRKEY_ACTIVE);
  delay(700);                                    // BG96は500ms以上の押下で起動
  digitalWrite(BG96_PWRKEY, !PWRKEY_ACTIVE);
  for (int i = 0; i < 20; i++) {                 // 起動待ち（最大約20秒）
    if (sendAT("AT", "OK", 1000)) return;
  }
  Serial.println("BG96 が応答しません");
}

// LTE-M 登録を待つ（+CEREG: x,1 か x,5 になるまで）
bool waitNetwork(unsigned long timeoutMs = 180000) {
  unsigned long t0 = millis();
  while (millis() - t0 < timeoutMs) {
    while (bg96.available()) bg96.read();
    bg96.print("AT+CEREG?\r\n");
    String resp;
    unsigned long t1 = millis();
    while (millis() - t1 < 1000) {
      while (bg96.available()) resp += (char)bg96.read();
    }
    if (resp.indexOf(",1") >= 0 || resp.indexOf(",5") >= 0) {
      Serial.println("ネットワーク登録OK");
      return true;
    }
    Serial.print("登録待ち: "); Serial.println(resp);
    delay(2000);
  }
  return false;
}

bool bg96Setup() {
  bg96PowerOn();
  sendAT("ATE0", "OK");                          // エコーOFF
  sendAT("AT+CFUN=1", "OK", 5000);
  sendAT(String("AT+QICSGP=1,1,\"") + APN + "\",\"" + APN_USER + "\",\"" + APN_PASS + "\",3", "OK");
  if (!waitNetwork()) return false;
  // PDP有効化（すでに有効だとERRORになるので結果は無視）
  sendAT("AT+QIACT=1", "OK", 30000);
  return true;
}

bool mqttConnect() {
  sendAT("AT+QMTCLOSE=0", "OK", 3000);           // 前回の接続が残っていれば閉じる
  if (!sendAT(String("AT+QMTOPEN=0,\"") + MQTT_HOST + "\"," + MQTT_PORT,
              "+QMTOPEN: 0,0", 30000)) return false;
  if (!sendAT(String("AT+QMTCONN=0,\"") + MQTT_CLIENT_ID + "\"",
              "+QMTCONN: 0,0,0", 30000)) return false;
  return true;
}

bool mqttPublish(const String &payload) {
  // AT+QMTPUB=<id>,<msgID>,<qos>,<retain>,"<topic>" → '>' → 本文 → Ctrl+Z
  if (!sendAT(String("AT+QMTPUB=0,0,0,0,\"") + MQTT_TOPIC + "\"", ">", 5000)) return false;
  bg96.print(payload);
  bg96.write(0x1A);
  return sendAT("", "+QMTPUB: 0,0,0", 15000);
}

// ------------------------------------------------------------
// センサー
// ------------------------------------------------------------
bool i2cPresent(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

// 数値 or null を JSON 用文字列にする
String num(float v, int digits) {
  if (isnan(v)) return "null";
  return String(v, digits);
}

// 前回読んだ転倒回数（-1 = まだ読んでいない）
long prevRainRaw = -1;
#define MM_PER_TIP 0.2794f   // 1転倒あたりの雨量 [mm]

// 送信するJSONを作る。例: {"temp":25.3,"humidity":82.1,"rainfall":0.28}
String buildPayload() {
  float temp = NAN, hum = NAN, rainfall = NAN;

  // --- 温湿度 ---
  if (shtOK) {
    temp = sht31.readTemperature();
    hum  = sht31.readHumidity();
  }

  // --- 雨量：前回からの差分 ---
  if (rainOK && i2cPresent(RAIN_ADDR)) {
    long raw = (long)rain.getRawData();          // 起動からの転倒回数
    if (prevRainRaw < 0) {
      rainfall = 0;                              // 初回は差分なし
    } else if (raw >= prevRainRaw) {
      rainfall = (raw - prevRainRaw) * MM_PER_TIP;
    } else {
      rainfall = raw * MM_PER_TIP;               // センサーが再起動して0に戻った
    }
    prevRainRaw = raw;
  }

  String p = "{";
  p += "\"temp\":"     + num(temp, 1)     + ",";
  p += "\"humidity\":" + num(hum, 1)      + ",";
  p += "\"rainfall\":" + num(rainfall, 2);
  p += "}";

  Serial.println(p);                             // シリアルモニタにも同じJSONを表示
  return p;
}

// ------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(BG96_PWRKEY, OUTPUT);
  digitalWrite(BG96_PWRKEY, !PWRKEY_ACTIVE);
  bg96.begin(115200, SERIAL_8N1, BG96_RX, BG96_TX);

  // I2C は先にピン指定で開始（雨量ライブラリの begin() 内の Wire.begin() は無害）
  Wire.begin(I2C_SDA, I2C_SCL);

  shtOK = sht31.begin(SHT31_ADDR);
  Serial.println(shtOK ? "SHT31 OK" : "SHT31 が見つかりません");

  rainOK = rain.begin();
  if (rainOK) {
    Serial.print("SEN0575 OK  FW: ");
    Serial.println(rain.getFirmwareVersion());
    // 1転倒あたりの雨量。初期値0.2794mmで変える必要がなければ呼ばない
    // rain.setRainAccumulatedValue(0.2794);
  } else {
    Serial.println("SEN0575 が見つかりません（I2C/UART切替スイッチを確認）");
  }

  buildPayload();                                // 通信準備の前に一度表示（雨量の基準値もここで決まる）

  if (bg96Setup()) {
    mqttConnect();
  }
  lastSend = millis() - SEND_INTERVAL_MS;        // 起動直後に1回送る
}

void loop() {
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();

    String payload = buildPayload();
    if (!mqttPublish(payload)) {
      Serial.println("送信失敗 → 再接続して再送");
      if (!sendAT("AT", "OK", 1000)) bg96Setup();
      if (mqttConnect()) mqttPublish(payload);
    }
  }
  delay(10);
}
