/**
 * ワイングレープロテクト センサーノード
 * ESP32 + Quectel BG96 (AE-LTECATM1-BG96-BO) による MQTT パブリッシュ
 *
 * 仕様
 *   - 通信は BG96 の AT コマンドのみで実装（外部MQTTライブラリ不使用）
 *   - SSL/TLS は使用しない（平文 1883 番ポート）
 *   - SHT31 で温湿度を測定し、JSON にしてブローカーへ publish
 *
 * 送信形式
 *   トピック : sensor/<CLIENT_ID>/data
 *   ペイロード: {"temp":25.30,"humidity":82.10}
 *
 * 配線
 *   BG96 U1.TXD  <-> ESP32 GPIO25 (RX)
 *   BG96 U1.RXD  <-> ESP32 GPIO26 (TX)
 *   BG96 VIO     <-> ESP32 3.3V      ※ボードのJ1ジャンパは取り外すこと
 *   BG96 GND     <-> ESP32 GND
 *   SHT31 SDA    <-> ESP32 GPIO21
 *   SHT31 SCL    <-> ESP32 GPIO22
 *   SHT31 VIN    <-> ESP32 3.3V / GND <-> GND
 *   BG96ボードの電源はボード自身のUSB端子から供給（VINは未接続）
 *
 * 必要ライブラリ
 *   Adafruit SHT31 Library（依存ライブラリも合わせてインストール）
 *
 * 前提
 *   BG96 は PWRKEY で起動済みで、LTE-M 網に登録されていること
 *   （AT+CEREG? が 0,1 または 0,5 を返す状態）
 *   SIM: SORACOM plan-KM1 / APN: soracom.io (user: sora, pass: sora)
 */

#include <Wire.h>
#include "Adafruit_SHT31.h"

// ============================== 設定 ==============================
static const char*  BROKER_HOST = "broker.mqtt.cool";  // ブローカーのホスト名 or IP
static const int    BROKER_PORT = 1883;                // SSL不要なので 1883
static const char*  CLIENT_ID   = "grape-node-001";    // ノードごとに一意にする

// 認証が有効なブローカーの場合のみ設定
static const char*  MQTT_USER   = "";
static const char*  MQTT_PASS   = "";

static const unsigned long PUBLISH_INTERVAL_MS = 60000;  // 送信間隔（1分）

// ピン配置
static const int PIN_MODEM_RX = 25;  // ESP32が受信（BG96のTXDへ）
static const int PIN_MODEM_TX = 26;  // ESP32が送信（BG96のRXDへ）
static const int PIN_I2C_SDA  = 21;
static const int PIN_I2C_SCL  = 22;

static const uint8_t SHT31_ADDR = 0x45;  // 0x44 の個体もある
// =======================================================================

HardwareSerial SerialModem(1);
Adafruit_SHT31 sht31 = Adafruit_SHT31();

static char TOPIC_BUF[48];  // "sensor/<CLIENT_ID>/data"（setup() で組み立てる）

/**
 * ATコマンドを送信し、期待する応答が返るまで待つ。
 * @return 期待応答を受信できたら true、ERROR かタイムアウトなら false
 */
bool sendAT(const char* cmd, const char* expect, unsigned long timeoutMs) {
  // 送信前に受信バッファを空にしておく（前回の応答の残りを誤検出しないため）
  while (SerialModem.available()) SerialModem.read();

  SerialModem.println(cmd);
  Serial.printf(">> %s\n", cmd);

  unsigned long start = millis();
  String buf;
  while (millis() - start < timeoutMs) {
    while (SerialModem.available()) {
      char c = SerialModem.read();
      buf += c;
      Serial.write(c);
    }
    if (buf.indexOf(expect) >= 0) return true;
    if (buf.indexOf("ERROR") >= 0) return false;
    delay(10);
  }
  return false;
}

/** LTE網に登録済みかを確認する */
bool isNetworkRegistered() {
  // +CEREG: 0,1 (在圏) または 0,5 (ローミング) なら登録済み
  while (SerialModem.available()) SerialModem.read();
  SerialModem.println("AT+CEREG?");
  Serial.println(">> AT+CEREG?");

  unsigned long start = millis();
  String buf;
  while (millis() - start < 5000) {
    while (SerialModem.available()) {
      char c = SerialModem.read();
      buf += c;
      Serial.write(c);
    }
    if (buf.indexOf(",1") >= 0 || buf.indexOf(",5") >= 0) return true;
    if (buf.indexOf("OK") >= 0) return false;
    delay(10);
  }
  return false;
}

/**
 * ブローカーへの接続
 * すでに接続済みの場合、各コマンドは ERROR を返すが処理は続行する。
 */
bool mqttConnect() {
  char cmd[160];

  snprintf(cmd, sizeof(cmd), "AT+QMTOPEN=0,\"%s\",%d", BROKER_HOST, BROKER_PORT);
  if (!sendAT(cmd, "+QMTOPEN: 0,0", 30000)) {
    Serial.println("[INFO] QMTOPEN did not succeed (may already be connected; continuing)");
  }
  delay(1000);

  if (strlen(MQTT_USER) > 0) {
    snprintf(cmd, sizeof(cmd), "AT+QMTCONN=0,\"%s\",\"%s\",\"%s\"",
             CLIENT_ID, MQTT_USER, MQTT_PASS);
  } else {
    snprintf(cmd, sizeof(cmd), "AT+QMTCONN=0,\"%s\"", CLIENT_ID);
  }
  if (!sendAT(cmd, "+QMTCONN: 0,0,0", 15000)) {
    Serial.println("[INFO] QMTCONN did not succeed (may already be connected; continuing)");
    return false;
  }
  return true;
}

/** ブローカーから切断する（再接続前の後始末に使用） */
void mqttDisconnect() {
  sendAT("AT+QMTDISC=0", "+QMTDISC: 0,0", 10000);
  sendAT("AT+QMTCLOSE=0", "+QMTCLOSE: 0,0", 10000);
}

/**
 * 測定値を JSON にして publish する。
 * QoS1・retain=1 で送信し、ブローカーからの受領確認を待つ。
 */
bool publishReading(float tempC, float humidityPct) {
  char payload[128];
  snprintf(payload, sizeof(payload),
           "{\"temp\":%.2f,\"humidity\":%.2f}",
           tempC, humidityPct);

  char cmd[128];
  // 引数: <client_idx>,<msg_id>,<qos>,<retain>,"<topic>"
  snprintf(cmd, sizeof(cmd), "AT+QMTPUB=0,1,1,0,\"%s\"", TOPIC_BUF);

  while (SerialModem.available()) SerialModem.read();
  SerialModem.println(cmd);
  Serial.printf(">> %s\n", cmd);

  // BG96 が '>' を返したらペイロード入力待ち
  unsigned long start = millis();
  bool promptReceived = false;
  while (millis() - start < 5000) {
    while (SerialModem.available()) {
      char c = SerialModem.read();
      Serial.write(c);
      if (c == '>') { promptReceived = true; break; }
    }
    if (promptReceived) break;
    delay(10);
  }
  if (!promptReceived) {
    Serial.println("[ERROR] Did not receive the '>' input prompt");
    return false;
  }

  // ペイロード送信。終端は Ctrl+Z (0x1A)
  SerialModem.print(payload);
  SerialModem.write(26);
  Serial.printf(">> %s [Ctrl+Z]\n", payload);

  start = millis();
  String buf;
  while (millis() - start < 15000) {
    while (SerialModem.available()) {
      char c = SerialModem.read();
      buf += c;
      Serial.write(c);
    }
    if (buf.indexOf("+QMTPUB: 0,1,0") >= 0) return true;  // publish succeeded
    if (buf.indexOf("ERROR") >= 0) return false;
    delay(10);
  }
  return false;
}

void setup() {
  snprintf(TOPIC_BUF, sizeof(TOPIC_BUF), "sensor/%s/data", CLIENT_ID);

  Serial.begin(115200);
  SerialModem.begin(115200, SERIAL_8N1, PIN_MODEM_RX, PIN_MODEM_TX);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  Serial.println("\n=== Wine Grape Protect Sensor Node Starting ===");

  if (!sht31.begin(SHT31_ADDR)) {
    Serial.println("[FATAL] SHT31 not found. Check wiring and I2C address");
    while (true) delay(1000);
  }
  Serial.println("[OK] SHT31 initialized");

  delay(2000);

  if (!sendAT("AT", "OK", 3000)) {
    Serial.println("[FATAL] BG96 not responding. Check PWRKEY boot and UART wiring");
    while (true) delay(1000);
  }
  Serial.println("[OK] BG96 responded");

  if (!isNetworkRegistered()) {
    Serial.println("[WARN] Not registered on the LTE network. Check signal conditions");
  } else {
    Serial.println("[OK] Registered on the LTE network");
  }

  mqttConnect();
}

void loop() {
  float tempC = sht31.readTemperature();
  float humidityPct = sht31.readHumidity();

  if (isnan(tempC) || isnan(humidityPct)) {
    Serial.println("[WARN] Failed to read from SHT31");
  } else {
    Serial.printf("[MEASURE] Temperature %.2f C / Humidity %.2f %%\n", tempC, humidityPct);

    if (publishReading(tempC, humidityPct)) {
      Serial.println("[OK] Publish succeeded");
    } else {
      Serial.println("[WARN] Publish failed -> attempting to reconnect");
      mqttDisconnect();
      delay(2000);
      mqttConnect();
    }
  }

  delay(PUBLISH_INTERVAL_MS);
}