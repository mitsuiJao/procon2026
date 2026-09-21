// ESP32 - BG96 AT コマンド送受信テスト (UART直結)

HardwareSerial SerialModem(1); // UART1

void setup() {
  Serial.begin(115200);
  SerialModem.begin(115200, SERIAL_8N1, 25, 26);
  Serial.println("Ready. Type AT commands and press Enter.");
}

void loop() {
  // PC → BG96
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    SerialModem.println(cmd);
  }

  // BG96 → PC
  if (SerialModem.available()) {
    String res = SerialModem.readStringUntil('\n');
    Serial.println(res);
  }
}



/*
# ---------- 1. 動作確認 ----------
AT                  # 応答確認。OKが返ればUARTは正常
ATI                 # メーカー・型番・ファームのバージョン
AT+CPIN?            # SIMの状態。+CPIN: READY なら認識OK
AT+CFUN?            # 無線機能の状態。+CFUN: 1 ならON(違えば AT+CFUN=1)
AT+CBC              # 電源電圧。低いと再起動の原因になる

# ---------- 2. 設定(初回のみ、再起動後も保持) ----------
AT+QCFG="iotopmode",0,1        # eMTC(Cat-M1)のみ使う。0=eMTC 1=NB-IoT 2=両方。末尾の1は即時反映
AT+QCFG="nwscanmode",3,1       # LTEのみスキャン。0=自動 1=GSM 2=WCDMA 3=LTE
AT+QCFG="nwscanseq",02,1       # スキャン順。02=eMTC優先
AT+CGDCONT=1,"IP","soracom.io"                     # APNの登録(コンテキスト1)
AT+QICSGP=1,1,"soracom.io","sora","sora",1         # APN・ID・パスワード・PAP認証の設定(データ通信用)
AT+CFUN=1,1                    # モジュール再起動(設定を反映)。再起動後は自動で立ち上がる

# ---------- 3. 網への登録確認(再起動後、数十秒〜数分待つ) ----------
AT+CSQ              # 電波強度。99,99 以外なら電波あり
AT+CEREG?           # LTEの登録状況。+CEREG: 0,1(ホーム) か 0,5(ローミング)なら登録済み
AT+COPS?            # 接続中の事業者名。圏外だと空

# ---------- 4. データ通信の確認 ----------
AT+QIACT=1          # データ通信を有効化(PDPコンテキスト1)
AT+QIACT?           # IPアドレスが出れば成功
AT+QPING=1,"8.8.8.8"   # 疎通確認(pingを送る)
AT+QIDEACT=1        # データ通信を切断
*/