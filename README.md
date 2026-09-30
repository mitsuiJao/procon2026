## procon2026
香川行きます

## dir

```
./
├── AGENT.md
├── API.md
├── apps/
│   ├── backend/			# バックエンド, mqtt, db
│   │   ├── api/			# hono api
│   │   │   ├── Dockerfile
│   │   │   ├── src/
│   │   │   │   ├── db/			# db操作
│   │   │   │   ├── evalute/		# 病害評価
│   │   │   │   ├── index.ts		# apiエントリ
│   │   │   │   ├── routes/		# 各種ルーティング
│   │   │   │   │   └──── index.ts
│   │   │   │   └── utils/		# APIユーティリティ
│   │   │   ├── test/			# APIテストケース
│   │   │   └── tsconfig.json
│   │   ├── data/			# 病害・農薬データ
│   │   │   ├── pesticides_updated-utf8.csv
│   │   │   ├── rules/			# 病害発生ルール
│   │   │   └── vocab/			# 情報とIDマスタ等
│   │   ├── docker-compose.yml
│   │   ├── migrations/			# SQLマイグレーション、MQTTコンテナからの起動
│   │   ├── mqtt/			# MQTT
│   │   │   ├── Dockerfile
│   │   │   ├── src/
│   │   │   │   ├── bro.ts		# ブローカー
│   │   │   │   ├── db.ts		# DB書き込み
│   │   │   │   └── sub.ts		# サブスクライバー
│   │   │   └── tsconfig.json
│   │   └── seeds/
│   │       └── risk-scenario.sql	# ダミーデータ用シード
│   ├── esp32/				# ESP32スケッチ
│   │   ├── catm1/			# CatM1通信、BG96動作確認
│   │   ├── main/			# 本番用
│   │   │   ├── DFRobot_RainfallSensor.cpp
│   │   │   ├── DFRobot_RainfallSensor.h
│   │   │   └── main.ino		# エントリ
│   │   ├── sensor/			# 各種センサ確認
│   │   └── test/			# 動作確認
│   └── frontend/			# フロントエンド, react native, expo
│       ├── app.json
│       ├── assets/
│       │   ├── expo.icon/
│       │   └── images/
│       │       ├── adaptive-icon.png
│       │       ├── icon.png
│       │       ├── splash-icon.png
│       │       └── tabIcons/
│       ├── eslint.config.js		# lint
│       ├── README.md
│       ├── scripts/
│       │   └── reset-project.js
│       ├── src/
│       │   ├── app/
│       │   │   ├── index.tsx		# エントリ
│       │   │   ├── _layout.tsx
│       │   │   └── pesticides.tsx
│       │   ├── components/
│       │   │   ├── animated-icon.module.css
│       │   │   ├── animated-icon.tsx
│       │   │   ├── animated-icon.web.tsx
│       │   │   ├── app-tabs.tsx
│       │   │   ├── app-tabs.web.tsx
│       │   │   └── nashi-navi/
│       │   │       ├── api.ts
│       │   │       ├── day-detail-modal.tsx
│       │   │       ├── disease-risk-modal.tsx
│       │   │       ├── home-screen-content.tsx
│       │   │       ├── pesticide-picker.tsx
│       │   │       ├── sensor-status-modal.tsx
│       │   │       ├── styles.ts
│       │   │       ├── types.ts
│       │   │       └── utils.ts
│       │   ├── constants/
│       │   │   └── theme.ts
│       │   └── global.css
│       ├── tsconfig.json
│       └── .vscode/
├── data/
├── doc/ 				# 各種ドキュメント
└── README.md
```
