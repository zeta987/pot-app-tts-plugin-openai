# Pot-App AI TTS 語音合成外掛

繁體中文 | [English](README_EN.md)

整合 **OpenAI** 與 **Google Gemini** 最新世代非棄用 API 的 [Pot](https://pot-app.com/) 語音合成（TTS）外掛（外掛 ID：`plugin.com.pot-app.ai_tts`）。單一外掛即可依所選模型自動切換 OpenAI Realtime WebSocket、OpenAI Chat Audio HTTP 與 Google Gemini Interactions HTTP 協定，內建逐字朗讀防前言鎖定、多聲音挑選與錯誤訊息金鑰遮罩保護。

> [!IMPORTANT]
> **Pot Desktop 分支版本需求**
> - **設定頁語音預覽與一鍵全測快取**（內建台灣正體中文預設試聽句、依模型自動切換聲音卡片庫、記憶體快取與一鍵全測預載所有聲音）需要 **[`zeta987/pot-desktop` `3.0.10` 或更新版本（`>= 3.0.10`）](https://github.com/zeta987/pot-desktop/releases/tag/3.0.10)**。
> - Pot 翻譯視窗中的**核心 TTS 朗讀播放功能**同樣可在標準版 Pot Desktop 上正常運作，但標準版不包含設定頁內建的聲音預覽面板與一鍵全測快取功能。

## 安裝方式

1. 前往 [GitHub Releases](https://github.com/zeta987/pot-app-tts-plugin-openai/releases) 下載最新版的 `plugin.com.pot-app.ai_tts.potext`。
2. 開啟 Pot Desktop，前往 **設定 → 服務設定 → 語音合成 → 新增擴充套件 → 安裝外掛程式**，選擇剛剛下載的 `plugin.com.pot-app.ai_tts.potext`。
3. 安裝完成後新增 `AI TTS` 服務實例，填入 API Key 並選擇模型即可使用。

## 支援模型（2026 年 11 月現行非棄用版本）

| 供應商 | 模型 ID | 定位 | 傳輸協定與技術細節 | 聲音與語言支援 | 語速控制 |
| --- | --- | --- | --- | --- | --- |
| **OpenAI** | `gpt-realtime-2.1-mini` | 推薦預設 | Realtime WebSocket（`POST /v1/realtime/client_secrets` 短期憑證 + `reasoning.effort = "none"` 低延遲模式 + 中英雙語 2-shot 防前言逐字朗讀鎖定，輸出 24 kHz PCM16 並封裝為 WAV） | 10 種聲音（`marin`、`cedar`、`alloy`、`ash`、`ballad`、`coral`、`echo`、`sage`、`shimmer`、`verse`） | 原生 `0.25x–1.5x` |
| **OpenAI** | `gpt-realtime-2.1` | 旗艦 Realtime | 與 `gpt-realtime-2.1-mini` 相同之 Realtime WebSocket 協定、短期憑證與逐字朗讀鎖定 | 同上 10 種聲音 | 原生 `0.25x–1.5x` |
| **OpenAI** | `gpt-audio-1.5` | 無狀態 HTTP | HTTP `POST /v1/chat/completions`（`modalities: ["text", "audio"]`、直接輸出 WAV、`store: false` 與 2-shot 防前言逐字朗讀鎖定），適合不支援 WebSocket 的反代環境 | 全部 13 種 OpenAI 聲音（含 `fable`、`nova`、`onyx`） | 轉為自然語速指導（`0.25x–1.5x`） |
| **Google Gemini** | `gemini-3.8-flash-lite-tts` | 推薦／快速 | Interactions API `POST /v1beta/interactions`（原生逐字朗讀、`store: false`，回傳 WAV 或自動封裝 `audio/l16` PCM） | 101 種語言；30 種內建聲音 + Voice Design／Voice Replication 自訂 ID（`voice_...`） | 透過 `speech_metadata.style` 指導 |
| **Google Gemini** | `gemini-3.8-flash-tts` | 旗艦／高表現力 | Interactions API `POST /v1beta/interactions`，提供更細緻的語氣、情緒與發音表現力 | 130 種語言；30 種內建聲音 + 自訂 `voice_...` ID | 透過 `speech_metadata.style` 指導 |

> [!NOTE]
> **刻意排除之已棄用／停用模型**
> 本外掛僅維護現行世代模型，不內建以下舊版模型：
> - **OpenAI**：`tts-1`、`tts-1-hd`、`gpt-4o-mini-tts`（將於 `2027-01-06` 停用），以及舊版 `gpt-realtime`、`gpt-audio`（將於 `2027-01-20` 停用）。
> - **Google Gemini**：`gemini-2.5-flash-preview-tts`、`gemini-2.5-pro-preview-tts`（`gemini-2.5-*-tts`）與 `gemini-3.1-flash-tts-preview`（已於 `2026-11-17` 退役）。

## 設定說明

以下為 `AI TTS` 設定視窗中的 8 個欄位：

| 欄位鍵值 | 顯示名稱 | 說明 |
| --- | --- | --- |
| `model` | 模型 | 選擇 OpenAI 或 Gemini 模型，外掛會自動切換對應的 API 協定與官方端點。 |
| `customModel` | 自訂模型 (選填) | 若有填寫會優先於下拉選單（適合指定未來新發布的模型 ID）。 |
| `apiKey` | API Key | 填入 [OpenAI API Keys](https://platform.openai.com/api-keys) 或 [Google AI Studio](https://aistudio.google.com/app/apikey) 金鑰。HTTP 請求均設定 `store: false`（Realtime 採用 `conversation: "none"`），錯誤訊息亦會自動遮罩 API Key 與短期憑證。 |
| `requestPath` | 請求路徑 (選填) | 留空即自動使用官方端點（OpenAI：`https://api.openai.com`；Gemini：`https://generativelanguage.googleapis.com`）。可填寫自訂反代或中繼網址；若第三方 Realtime 代理未實作 `/v1/realtime/client_secrets`（回傳 404／405／501），外掛會自動回退為直連憑證子協定。 |
| `voice` | 聲音 | 預設為 `自動預設`（OpenAI 使用 `marin`，Gemini 使用 `Kore`）。切換供應商或模型時若原選聲音不相容，外掛會自動回退至該供應商預設值，不會報錯。 |
| `customVoice` | 自訂聲音 ID (選填) | 優先於下拉選單，可直接填入 Gemini Voice Design／Voice Replication 產生的 `voice_...`、`voicekey_...` 或 OpenAI Custom Voice ID。 |
| `speed` | 語速 | 支援 `0.25x`、`0.5x`、`0.75x`、`1.0x`（預設）、`1.25x`、`1.5x`。OpenAI Realtime 採用原生 `speed` 參數；`gpt-audio-1.5` 與 Gemini 則轉譯為自然語速指導。 |
| `instructions` | 語氣指導 (選填) | 自訂口音、情緒、風格或播報口吻（僅影響朗讀表現，不會讓模型回話）。 |

### 多實例配置建議

可以在 Pot 的 **服務設定 → 語音合成** 中建立多個 `AI TTS` 實例，例如分別命名為 **`OpenAI TTS`** 與 **`Gemini TTS`**，各自填入對應的 API Key、模型與慣用聲音，即可在翻譯視窗隨時切換不同供應商，無需反覆修改設定。

### 台灣國語口音 `instructions` 範例

朗讀繁體中文時，若希望口音更貼近台灣日常語感，可在 **`語氣指導 (選填)`** 填入類似以下提示：

```text
請使用自然道地的台灣國語口音朗讀，語氣親切清晰、節奏自然，避免過度捲舌與兒化音。
```

若使用英文提示（OpenAI 與 Gemini 皆支援），也可填寫：

```text
Speak in a natural Taiwanese Mandarin accent with a warm, clear, conversational tone. Avoid heavy retroflex pronunciation or erhua.
```

## 設定頁聲音預覽與一鍵全測快取

> [!TIP]
> 此工作流程需搭配 **[`zeta987/pot-desktop >= 3.0.10`](https://github.com/zeta987/pot-desktop/releases/tag/3.0.10)** 使用。

1. 在 Pot 服務設定中開啟 `AI TTS` 的設定視窗並填入 `API Key`（無需先儲存即可直接試聽）。
2. 下方的 **語音預覽試聽** 面板預設載入台灣正體中文試聽例句（可自行修改，也能一鍵還原），並會依目前所選模型自動切換對應的聲音列表（OpenAI Realtime 10 種／OpenAI Audio 13 種／Gemini 30 種）。
3. 點擊 **試聽目前設定** 或個別聲音卡片旁的播放鈕即可立即試聽；也可以點擊 **一鍵全測**，以受控並行（同時最多 2 筆請求）為目前聲音清單中的所有聲音批次預先合成並寫入記憶體快取（已快取的聲音會自動略過，過程中可隨時點擊停止）。
4. 預載完成後，點選任一標記為已快取的聲音即可零延遲、零額外 API 呼叫反覆比較聽感，挑到喜歡的聲音後點擊卡片名稱即可直接套用至設定欄位。

## 本機測試與打包

執行內建單元測試（使用 Node.js 內建 `node:test`，無需額外安裝套件）：

```bash
node --test main.test.cjs
```

推送至 GitHub 時，[`.github/workflows/build.yml`](.github/workflows/build.yml) 會自動執行 `node --test main.test.cjs`，將 `info.json`、`ai_tts.svg` 與 `main.js` 打包為 `plugin.com.pot-app.ai_tts.potext` 上傳為建置成品，並在推送版本標籤（`refs/tags/*`）時自動發布至 GitHub Releases。
