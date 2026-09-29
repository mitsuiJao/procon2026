// ESP32 + BG96 (UART) : AT コマンドのみで MQTT 接続 → Publish → 切断
// Arduino-ESP32 (core 2.x / 3.x) 想定
// 配線: ESP32 GPIO17(TX2) -> BG96 RXD, ESP32 GPIO16(RX2) <- BG96 TXD, GND 共通
// ※ BG96 本体の UART は 1.8V。ブレイクアウト基板にレベル変換が無い場合は必ず挟むこと

#include <Arduino.h>

// ---------- 設定 ----------
static const int   PIN_RX   = 25;          // ESP32 RX <- BG96 TXD
static const int   PIN_TX   = 26;          // ESP32 TX -> BG96 RXD
static const int   PIN_PWRKEY = -1;        // PWRKEY を制御するなら GPIO 番号 (-1 で無効)
static const long  BAUD     = 115200;

static const char* APN      = "soracom.io";
static const char* APN_USER = "sora";
static const char* APN_PASS = "sora";

static const char* BROKER   = "broker.mqtt.cool";
static const int   PORT     = 1883;
static const char* CLIENT_ID = "esp32-bg96-2480";
static const char* MQTT_USER = "";
static const char* MQTT_PASS = "";
static const char* TOPIC    = "test/topic";

static const int   CID = 0;                // MQTT クライアント識別子 (0-5)
// --------------------------

HardwareSerial& modem = Serial2;
static String rxbuf;

// 受信データを rxbuf に取り込む
static void pump() {
  while (modem.available()) {
    char c = modem.read();
    rxbuf += c;
    Serial.write(c);  // デバッグ用ミラー
  }
}

// pats のどれかが rxbuf に出るまで待つ。見つかったパターンの index を返す (-1: timeout)
static int waitFor(std::initializer_list<const char*> pats, uint32_t timeoutMs) {
  uint32_t t0 = millis();
  while (millis() - t0 < timeoutMs) {
    pump();
    int i = 0;
    for (auto p : pats) {
      if (rxbuf.indexOf(p) >= 0) return i;
      ++i;
    }
    delay(5);
  }
  return -1;
}

// AT コマンド送信 → OK なら true
static bool sendCmd(const String& cmd, uint32_t timeoutMs = 2000, String* resp = nullptr) {
  rxbuf = "";
  Serial.printf("\n>> %s\n", cmd.c_str());
  modem.print(cmd);
  modem.print("\r");
  int r = waitFor({"OK\r\n", "ERROR"}, timeoutMs);
  if (resp) *resp = rxbuf;
  return r == 0;
}

// URC 行 ("+QMTOPEN: 0,0" など) を待って数値列を out に入れる。成功で true
static bool waitURC(const char* prefix, uint32_t timeoutMs, int* out, int maxN) {
  if (waitFor({prefix}, timeoutMs) < 0) return false;
  int p = rxbuf.indexOf(prefix);
  uint32_t t0 = millis();
  while (rxbuf.indexOf("\r\n", p) < 0 && millis() - t0 < 500) { pump(); delay(5); }
  int e = rxbuf.indexOf("\r\n", p);
  String line = rxbuf.substring(p, e < 0 ? rxbuf.length() : e);
  rxbuf.remove(0, e < 0 ? rxbuf.length() : e + 2);

  int colon = line.indexOf(':');
  if (colon < 0) return false;
  int n = 0;
  const char* s = line.c_str() + colon + 1;
  char* endp;
  while (*s && n < maxN) {
    long x = strtol(s, &endp, 10);
    if (endp == s) { ++s; continue; }
    out[n++] = (int)x;
    s = endp;
  }
  return n > 0;
}

static void powerOnModem() {
  if (PIN_PWRKEY < 0) return;
  pinMode(PIN_PWRKEY, OUTPUT);
  digitalWrite(PIN_PWRKEY, LOW);
  delay(100);
  digitalWrite(PIN_PWRKEY, HIGH);  // 基板により論理が反転する場合あり
  delay(600);                       // PWRKEY を 500ms 以上保持
  digitalWrite(PIN_PWRKEY, LOW);
  delay(5000);                      // 起動待ち
}

static bool modemInit() {
  bool alive = false;
  for (int i = 0; i < 10 && !alive; ++i) alive = sendCmd("AT", 1000);
  if (!alive) return false;

  sendCmd("ATE0");
  if (!sendCmd("AT+CPIN?")) return false;

  // 圏内待ち
  bool reg = false;
  for (int i = 0; i < 60 && !reg; ++i) {
    String r;
    sendCmd("AT+CEREG?", 1000, &r);
    reg = r.indexOf(",1") >= 0 || r.indexOf(",5") >= 0;
    if (!reg) delay(1000);
  }
  if (!reg) return false;

  sendCmd(String("AT+QICSGP=1,1,\"") + APN + "\",\"" + APN_USER + "\",\"" + APN_PASS + "\",1");
  sendCmd("AT+QIACT=1", 150000);  // 既にアクティブなら ERROR。無視
  sendCmd("AT+QIACT?");
  return true;
}

static bool mqttConnect() {
  sendCmd(String("AT+QMTCFG=\"pdpcid\",") + CID + ",1");
  sendCmd(String("AT+QMTCFG=\"keepalive\",") + CID + ",60");

  int v[4];
  // TCP 接続
  if (!sendCmd(String("AT+QMTOPEN=") + CID + ",\"" + BROKER + "\"," + PORT, 5000)) return false;
  if (!waitURC("+QMTOPEN:", 75000, v, 4) || v[1] != 0) return false;

  // MQTT CONNECT
  String c = String("AT+QMTCONN=") + CID + ",\"" + CLIENT_ID + "\"";
  if (strlen(MQTT_USER) > 0) c += String(",\"") + MQTT_USER + "\",\"" + MQTT_PASS + "\"";
  if (!sendCmd(c, 5000)) return false;
  int r[4] = {-1, -1, -1, -1};
  if (!waitURC("+QMTCONN:", 15000, r, 4) || r[1] != 0 || r[2] != 0) return false;
  return true;
}

static bool mqttPublish(const String& topic, const String& payload) {
  rxbuf = "";
  Serial.printf("\n>> AT+QMTPUB (%s)\n", payload.c_str());
  modem.print(String("AT+QMTPUB=") + CID + ",0,0,0,\"" + topic + "\"\r");
  if (waitFor({">"}, 5000) < 0) return false;
  modem.print(payload);
  modem.write(0x1A);  // Ctrl+Z で送信確定

  int v[4] = {-1, -1, -1, -1};
  if (!waitURC("+QMTPUB:", 15000, v, 4)) return false;
  return v[2] == 0;  // <id>,<msgID>,<result>
}

static void mqttDisconnect() {
  int v[4];
  sendCmd(String("AT+QMTDISC=") + CID, 5000);
  waitURC("+QMTDISC:", 10000, v, 4);
}

void setup() {
  Serial.begin(BAUD);
  modem.begin(BAUD, SERIAL_8N1, PIN_RX, PIN_TX);
  delay(500);

  powerOnModem();
  if (!modemInit())  { Serial.println("\nmodem init failed"); return; }
  if (!mqttConnect()) { Serial.println("\nmqtt connect failed"); mqttDisconnect(); return; }
  Serial.println("\nMQTT connected");
}

void loop() {
  static uint32_t last = 0;
  if (millis() - last >= 10000) {  // 10 秒ごとに送信
    last = millis();
    String payload = String("{\"uptime\":") + (millis() / 1000) + "}";
    if (!mqttPublish(TOPIC, payload)) {
      Serial.println("\npublish failed -> reconnect");
      mqttDisconnect();
      if (!mqttConnect()) Serial.println("reconnect failed");
    } else {
      Serial.println("\npublish OK");
    }
  }
  pump();
  rxbuf.remove(0, rxbuf.length() > 512 ? rxbuf.length() - 512 : 0);  // 肥大化防止
  // 切断 URC (+QMTSTAT) を検知した場合は再接続する
  if (rxbuf.indexOf("+QMTSTAT:") >= 0) {
    rxbuf = "";
    Serial.println("\nMQTT session lost -> reconnect");
    mqttDisconnect();
    mqttConnect();
  }
}