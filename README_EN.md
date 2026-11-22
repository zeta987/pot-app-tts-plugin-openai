# Pot-App AI TTS Plugin

[繁體中文](README.md) | English

A [Pot](https://pot-app.com/) Text-to-Speech (TTS) plugin (`plugin.com.pot-app.ai_tts`) integrating the latest non-deprecated **OpenAI** and **Google Gemini** speech synthesis APIs in a single plugin. It automatically routes between OpenAI Realtime WebSocket, OpenAI Chat Completions Audio HTTP, and Google Gemini Interactions HTTP based on the selected model, with verbatim anti-preamble guardrails, cross-provider voice fallback, and API key redaction in error messages.

> [!IMPORTANT]
> **Pot Desktop Fork Version Requirement**
> - **Settings Voice Preview & One-Click Batch Pre-fetch All Voices** (built-in Taiwanese Traditional Chinese default sample text, model-aware voice gallery, in-memory cache, and one-click batch pre-fetch across all voices) requires **[`zeta987/pot-desktop` version `3.0.10` or later (`>= 3.0.10`)](https://github.com/zeta987/pot-desktop/releases/tag/3.0.10)**.
> - **Core TTS playback** in Pot's Translate window also works on standard Pot Desktop, while the in-settings voice preview gallery and one-click batch pre-fetch require `zeta987/pot-desktop >= 3.0.10`.

## Installation

1. Download `plugin.com.pot-app.ai_tts.potext` from [GitHub Releases](https://github.com/zeta987/pot-app-tts-plugin-openai/releases).
2. In Pot Desktop, go to **Settings → Service → TTS → Add External Service → Install Plugin** (the button may appear as **Add Extension** depending on locale) and select the downloaded `plugin.com.pot-app.ai_tts.potext` file.
3. Add an `AI TTS` service instance, enter your API key, and pick a model.

## Supported Models (November 2026 — Non-Deprecated Only)

| Provider | Model | Role | Protocol & Implementation | Voices & Languages | Speed Control |
| --- | --- | --- | --- | --- | --- |
| **OpenAI** | `gpt-realtime-2.1-mini` | Recommended default | Realtime WebSocket (`POST /v1/realtime/client_secrets` ephemeral token + `reasoning.effort = "none"` low-latency mode + bilingual 2-shot anti-preamble verbatim lock; streams 24 kHz PCM16 wrapped as WAV) | 10 voices (`marin`, `cedar`, `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`) | Native `0.25x–1.5x` |
| **OpenAI** | `gpt-realtime-2.1` | Flagship Realtime | Same Realtime WebSocket protocol, ephemeral token flow, `reasoning.effort = "none"`, and verbatim lock | Same 10 voices | Native `0.25x–1.5x` |
| **OpenAI** | `gpt-audio-1.5` | Stateless HTTP | HTTP `POST /v1/chat/completions` (`modalities: ["text", "audio"]`, direct WAV response, `store: false`, 2-shot anti-preamble verbatim lock); ideal when proxies do not support WebSockets | All 13 OpenAI voices (includes `fable`, `nova`, `onyx`) | Natural pacing style hint (`0.25x–1.5x`) |
| **Google Gemini** | `gemini-3.8-flash-lite-tts` | Recommended / Fast | Interactions API `POST /v1beta/interactions` (native verbatim TTS, `store: false`, returns WAV or auto-wraps headerless `audio/l16` PCM) | 101 languages; 30 prebuilt voices + Voice Design / Voice Replication custom IDs (`voice_...`) | Guided via `speech_metadata.style` |
| **Google Gemini** | `gemini-3.8-flash-tts` | Flagship / Expressive | Interactions API `POST /v1beta/interactions` with rich vocal expressiveness and tone control | 130 languages; 30 prebuilt voices + custom `voice_...` IDs | Guided via `speech_metadata.style` |

> [!NOTE]
> **Deprecated Models Intentionally Excluded**
> This plugin targets current production generations only and intentionally omits retired or scheduled-for-shutdown models:
> - **OpenAI**: `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` (shutting down `2027-01-06`), and legacy `gpt-realtime` / `gpt-audio` (shutting down `2027-01-20`).
> - **Google Gemini**: `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` (`gemini-2.5-*-tts`), and `gemini-3.1-flash-tts-preview` (retired `2026-11-17`).

## Configuration Guide

All 8 configuration fields defined in `info.json`:

| Field Key | UI Label | Description |
| --- | --- | --- |
| `model` | Model (`模型`) | Selects an OpenAI or Gemini model. The plugin automatically picks the matching API protocol and official endpoint. |
| `customModel` | Custom Model (`自訂模型 (選填)`) | Optional. Overrides the `model` dropdown when filled (useful for newly released model IDs). |
| `apiKey` | API Key | Your [OpenAI API Key](https://platform.openai.com/api-keys) or [Google AI Studio API Key](https://aistudio.google.com/app/apikey). HTTP requests send `store: false` (and Realtime responses use `conversation: "none"`), while error messages automatically redact API keys and ephemeral tokens. |
| `requestPath` | Request Path (`請求路徑 (選填)`) | Optional. Leave blank to use official endpoints (`https://api.openai.com` for OpenAI; `https://generativelanguage.googleapis.com` for Gemini), or enter a custom reverse proxy / relay URL. If a third-party Realtime relay does not implement `/v1/realtime/client_secrets` (HTTP 404/405/501), the plugin falls back to direct subprotocol auth. |
| `voice` | Voice (`聲音`) | Defaults to `auto` (`自動預設`: `marin` for OpenAI, `Kore` for Gemini). Switching providers or models with an incompatible voice automatically falls back to the active provider's default instead of failing. |
| `customVoice` | Custom Voice ID (`自訂聲音 ID (選填)`) | Optional. Overrides the `voice` dropdown; accepts Gemini Voice Design / Voice Replication IDs (`voice_...`, `voicekey_...`) or OpenAI Custom Voice IDs. |
| `speed` | Speed (`語速`) | Supports `0.25x`, `0.5x`, `0.75x`, `1.0x` (default), `1.25x`, and `1.5x`. OpenAI Realtime uses the native `speed` parameter; `gpt-audio-1.5` and Gemini map it to natural pacing hints. |
| `instructions` | Style Instructions (`語氣指導 (選填)`) | Optional accent, tone, emotion, or delivery style prompt applied strictly to vocal delivery without triggering conversational replies. |

### Multi-Instance Setup Tip

In Pot's **Settings → Service → TTS**, you can create multiple `AI TTS` instances — for example, one named **`OpenAI TTS`** and another named **`Gemini TTS`** — each with its own API key, model, voice, and style prompt. That lets you switch between providers in the Translate window without re-entering credentials.

### Taiwanese Mandarin Accent `instructions` Tip

When synthesizing Traditional Chinese and steering toward a natural Taiwanese Mandarin accent, you can place a prompt like this in **`instructions`**:

```text
Speak in a natural Taiwanese Mandarin accent with a warm, clear, conversational tone. Avoid heavy retroflex pronunciation or erhua.
```

Or in Traditional Chinese:

```text
請使用自然道地的台灣國語口音朗讀，語氣親切清晰、節奏自然，避免過度捲舌與兒化音。
```

## Voice Preview & Local Testing

### In-Settings Voice Preview & Batch Pre-fetch (`zeta987/pot-desktop >= 3.0.10`)

> [!TIP]
> Requires **[`zeta987/pot-desktop >= 3.0.10`](https://github.com/zeta987/pot-desktop/releases/tag/3.0.10)**.

1. Open the `AI TTS` configuration modal in Pot Settings and enter your `apiKey` (unsaved form values work directly for previews).
2. Keep or edit the default Taiwanese Traditional Chinese preview sentence. The voice gallery automatically adapts to your chosen model (10 OpenAI Realtime voices, 13 OpenAI Audio voices, or 30 Gemini voices).
3. Click **Preview Current** or any individual voice card to audition it, or click **Batch Preview All** (一鍵全測) to pre-synthesize and cache every voice in the active catalog with bounded concurrency (max 2 in-flight requests, automatically skipping already-cached voices, cancelable at any time).
4. Once cached, click any voice card to replay immediately from memory with zero extra API calls, then click the voice name to apply it to your configuration.

### Local Unit Tests & Packaging

Run the built-in Node.js test suite (no external npm dependencies required):

```bash
node --test main.test.cjs
```

On push, [`.github/workflows/build.yml`](.github/workflows/build.yml) runs `node --test main.test.cjs`, zips `info.json`, `ai_tts.svg`, and `main.js` into `plugin.com.pot-app.ai_tts.potext`, uploads the `.potext` artifact, and publishes it to GitHub Releases whenever a version tag (`refs/tags/*`) is pushed.
