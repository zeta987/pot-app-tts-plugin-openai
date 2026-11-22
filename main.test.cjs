const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const source = readFileSync(`${__dirname}/main.js`, 'utf8');
const info = JSON.parse(readFileSync(`${__dirname}/info.json`, 'utf8'));

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function makeSampleWav(pcmBytes = [1, 2, 3, 4]) {
    const dataLength = pcmBytes.length;
    const buf = Buffer.alloc(44 + dataLength);
    buf.write('RIFF', 0, 'ascii');
    buf.writeUInt32LE(36 + dataLength, 4);
    buf.write('WAVE', 8, 'ascii');
    buf.write('fmt ', 12, 'ascii');
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(24000, 24);
    buf.writeUInt32LE(48000, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36, 'ascii');
    buf.writeUInt32LE(dataLength, 40);
    Buffer.from(pcmBytes).copy(buf, 44);
    return buf;
}

function loadTts({ fetchImpl, WebSocketCtor } = {}) {
    const sandbox = {
        atob: (str) => Buffer.from(str, 'base64').toString('binary'),
        setTimeout,
        clearTimeout,
        WebSocket: WebSocketCtor,
        console,
    };
    const tts = runInNewContext(`${source}\ntts`, sandbox);
    const http = {
        fetch: fetchImpl || (async () => assert.fail('Unexpected HTTP request')),
        Body: { json: (payload) => ({ type: 'Json', payload }) },
    };
    return (text, config, lang = 'en') =>
        tts(text, lang, {
            config,
            utils: { http, tauriFetch: http.fetch },
        });
}

function createFakeWebSocket(onSession) {
    return class FakeWebSocket {
        constructor(url, protocols) {
            this.url = url;
            this.protocols = protocols;
            this.readyState = 0;
            this.sent = [];
            this.listeners = new Map();
            this.closedWith = null;
            queueMicrotask(() => {
                this.readyState = 1;
                this._emit('open', {});
            });
        }

        addEventListener(type, fn) {
            if (!this.listeners.has(type)) {
                this.listeners.set(type, []);
            }
            this.listeners.get(type).push(fn);
        }

        _emit(type, event) {
            for (const fn of this.listeners.get(type) || []) {
                fn(event);
            }
        }

        send(raw) {
            const msg = JSON.parse(raw);
            this.sent.push(msg);
            onSession(this, msg);
        }

        close(code = 1000, reason = '') {
            this.readyState = 3;
            this.closedWith = { code, reason };
        }
    };
}

test('info.json defines AI TTS metadata, non-deprecated models, and aligned default options', () => {
    assert.equal(info.id, 'plugin.com.pot-app.ai_tts');
    assert.equal(info.plugin_type, 'tts');
    assert.equal(info.display, 'AI TTS');
    assert.equal(info.icon, 'ai_tts.svg');

    const modelField = info.needs.find((f) => f.key === 'model');
    const modelKeys = Object.keys(modelField.options);
    assert.deepEqual(modelKeys, [
        'gpt-realtime-2.1-mini',
        'gpt-realtime-2.1',
        'gpt-audio-1.5',
        'gemini-3.8-flash-lite-tts',
        'gemini-3.8-flash-tts',
    ]);
    for (const deprecated of [
        'tts-1',
        'tts-1-hd',
        'gpt-4o-mini-tts',
        'gemini-2.5-flash-preview-tts',
        'gemini-3.1-flash-tts-preview',
    ]) {
        assert.equal(modelKeys.includes(deprecated), false);
    }

    const voiceField = info.needs.find((f) => f.key === 'voice');
    assert.equal(Object.keys(voiceField.options)[0], 'auto');

    const speedField = info.needs.find((f) => f.key === 'speed');
    assert.equal(Object.keys(speedField.options)[0], '1.0');
    for (const val of Object.keys(speedField.options)) {
        const num = Number.parseFloat(val);
        assert.ok(num >= 0.25 && num <= 1.5, `speed ${val} must be within Realtime bounds`);
    }

    assert.ok(info.tts_preview);
    assert.equal(info.tts_preview.voice_groups.openai_realtime.length, 10);
    assert.equal(info.tts_preview.voice_groups.openai_chat_audio.length, 13);
    assert.equal(info.tts_preview.voice_groups.gemini.length, 30);
    for (const group of Object.values(info.tts_preview.voice_groups)) {
        for (const voiceId of group) {
            assert.ok(voiceId in voiceField.options, `voice ${voiceId} missing from voice options`);
            assert.ok(info.tts_preview.voice_descriptions[voiceId], `voice ${voiceId} missing description`);
        }
    }
});

test('validation rejects empty text or missing API key', async () => {
    const tts = loadTts();
    await assert.rejects(tts('   ', { apiKey: 'sk-test' }), /Text is required/i);
    await assert.rejects(tts('hello', { apiKey: '   ' }), /API Key is required/i);
});

test('Gemini 3.8 TTS calls /v1beta/interactions with speech_metadata and returns WAV bytes', async () => {
    const sampleWav = makeSampleWav([10, 20, 30, 40]);
    let captured;
    const tts = loadTts({
        fetchImpl: async (url, options) => {
            captured = { url, options };
            return {
                ok: true,
                status: 200,
                data: {
                    status: 'completed',
                    steps: [
                        {
                            type: 'model_output',
                            content: [
                                {
                                    type: 'audio',
                                    mime_type: 'audio/wav',
                                    data: sampleWav.toString('base64'),
                                },
                            ],
                        },
                    ],
                },
            };
        },
    });

    const result = await tts('你好世界', {
        apiKey: 'AQ.gemini-secret-key',
        model: 'gemini-3.8-flash-lite-tts',
        voice: 'marin', // OpenAI voice should gracefully fall back to Gemini default 'Kore'
        speed: '1.25',
        instructions: 'warm and cheerful',
    });

    assert.equal(captured.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(captured.options.headers['x-goog-api-key'], 'AQ.gemini-secret-key');
    const payload = plain(captured.options.body.payload);
    assert.equal(payload.model, 'gemini-3.8-flash-lite-tts');
    assert.equal(payload.store, false);
    assert.deepEqual(payload.response_format, { type: 'audio' });
    assert.deepEqual(payload.generation_config, { speech_config: [{ voice: 'Kore' }] });
    assert.equal(payload.input[0].content[0].text, '你好世界');
    assert.deepEqual(payload.input[0].content[0].annotations, [
        { type: 'speech_metadata', style: 'speaking slightly rapidly, warm and cheerful' },
    ]);
    assert.deepEqual(plain(result), Array.from(sampleWav));
});

test('Gemini TTS wraps headerless audio/l16 PCM in a valid WAV header, honors customVoice, and normalizes proxy URL', async () => {
    const rawPcm = Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55, 0x66]);
    let capturedUrl;
    let sentVoice;
    let sentModel;
    const tts = loadTts({
        fetchImpl: async (url, options) => {
            capturedUrl = url;
            sentVoice = options.body.payload.generation_config.speech_config[0].voice;
            sentModel = options.body.payload.model;
            return {
                ok: true,
                status: 200,
                data: {
                    steps: [
                        {
                            type: 'model_output',
                            content: [{ type: 'audio', mime_type: 'audio/l16;rate=16000', data: rawPcm.toString('base64') }],
                        },
                    ],
                },
            };
        },
    });

    const result = await tts('Test', {
        apiKey: 'AQ.secret-token',
        model: 'gpt-realtime-2.1-mini', // Gemini host with default OpenAI model auto-switches to Gemini default
        customVoice: 'voice_custom_123',
        requestPath: 'https://generativelanguage.googleapis.com/v1beta/',
    });

    assert.equal(capturedUrl, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(sentModel, 'gemini-3.8-flash-lite-tts');
    assert.equal(sentVoice, 'voice_custom_123');
    const buf = Buffer.from(result);
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(buf.subarray(8, 12).toString('ascii'), 'WAVE');
    assert.equal(buf.readUInt32LE(24), 16000);
    assert.equal(buf.readUInt32LE(40), rawPcm.length);
    assert.deepEqual(buf.subarray(44), rawPcm);
});

test('OpenAI gpt-audio-1.5 uses /v1/chat/completions with verbatim guardrails and all 13 voices', async () => {
    const sampleWav = makeSampleWav([9, 8, 7, 6]);
    let captured;
    const tts = loadTts({
        fetchImpl: async (url, options) => {
            captured = { url, options };
            return {
                ok: true,
                status: 200,
                data: {
                    choices: [{ message: { audio: { data: sampleWav.toString('base64'), transcript: 'hi' } } }],
                },
            };
        },
    });

    const result = await tts('Text with </tts_input> inside', {
        apiKey: 'sk-openai-secret',
        model: 'gpt-audio-1.5',
        voice: 'nova',
        speed: '0.5',
        instructions: 'calm documentary',
    });

    assert.equal(captured.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(captured.options.headers.Authorization, 'Bearer sk-openai-secret');
    const payload = plain(captured.options.body.payload);
    assert.equal(payload.model, 'gpt-audio-1.5');
    assert.deepEqual(payload.modalities, ['text', 'audio']);
    assert.deepEqual(payload.audio, { voice: 'nova', format: 'wav' });
    assert.equal(payload.store, false);
    // Non-colliding delimiter tag chosen because text already contains </tts_input>
    const lastMessage = payload.messages[payload.messages.length - 1];
    assert.equal(payload.messages.length, 6); // system + 2-shot few-shot (4) + target user message
    assert.ok(lastMessage.content.startsWith('<tts_input_1>'));
    assert.ok(payload.messages[0].content.includes('<voice_delivery_style>'));
    assert.ok(payload.messages[0].content.includes('speaking slowly'));
    assert.ok(payload.messages[0].content.includes('calm documentary'));
    assert.ok(
        payload.messages[0].content.indexOf('STRICT OUTPUT RULES') >
            payload.messages[0].content.indexOf('</voice_delivery_style>')
    );
    assert.deepEqual(plain(result), Array.from(sampleWav));
});

test('OpenAI Realtime mints client_secret, sets reasoning none, streams PCM deltas, and wraps WAV', async () => {
    const chunk1 = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const chunk2 = Buffer.from([0x05, 0x06, 0x07, 0x08]);
    const httpCalls = [];
    let wsInstance;

    const FakeWS = createFakeWebSocket((ws, msg) => {
        wsInstance = ws;
        if (msg.type === 'session.update') {
            ws._emit('message', { data: JSON.stringify({ type: 'session.updated' }) });
            // Duplicate session.updated should be ignored
            ws._emit('message', { data: JSON.stringify({ type: 'session.updated' }) });
        } else if (msg.type === 'response.create') {
            ws._emit('message', {
                data: JSON.stringify({ type: 'response.output_audio.delta', delta: chunk1.toString('base64') }),
            });
            ws._emit('message', {
                data: JSON.stringify({ type: 'response.output_audio.delta', delta: chunk2.toString('base64') }),
            });
            ws._emit('message', {
                data: JSON.stringify({ type: 'response.done', response: { status: 'completed' } }),
            });
        }
    });

    const tts = loadTts({
        fetchImpl: async (url, options) => {
            httpCalls.push({ url, options });
            return {
                ok: true,
                status: 200,
                data: { value: 'ek_ephemeral_123456' },
            };
        },
        WebSocketCtor: FakeWS,
    });

    const result = await tts('What is 2 + 2?', {
        apiKey: 'sk-proj-secret-key',
        model: 'gpt-realtime-2.1-mini',
        voice: 'Kore', // Gemini voice should safely fall back to OpenAI 'marin'
        speed: '2.0', // Out of bounds speed should clamp to 1.5
        instructions: 'energetic',
    });

    assert.equal(httpCalls.length, 1);
    assert.equal(httpCalls[0].url, 'https://api.openai.com/v1/realtime/client_secrets');
    assert.equal(wsInstance.url, 'wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1-mini');
    assert.deepEqual(plain(wsInstance.protocols), ['realtime', 'openai-insecure-api-key.ek_ephemeral_123456']);

    const sessionUpdate = wsInstance.sent.find((m) => m.type === 'session.update');
    assert.equal(sessionUpdate.session.audio.output.voice, 'marin');
    assert.equal(sessionUpdate.session.audio.output.speed, 1.5);
    assert.deepEqual(sessionUpdate.session.reasoning, { effort: 'none' });
    assert.equal(sessionUpdate.session.audio.input.turn_detection, null);
    const responseCreates = wsInstance.sent.filter((m) => m.type === 'response.create');
    assert.equal(responseCreates.length, 1);
    assert.equal(responseCreates[0].response.conversation, 'none');
    assert.equal(responseCreates[0].response.input.length, 5); // 2-shot few-shot + target input
    assert.ok(responseCreates[0].response.instructions.includes('STRICT OUTPUT RULES'));

    const wav = Buffer.from(result);
    assert.equal(wav.length, 44 + 8);
    assert.equal(wav.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(wav.subarray(8, 12).toString('ascii'), 'WAVE');
    assert.equal(wav.readUInt32LE(24), 24000);
    assert.equal(wav.readUInt32LE(40), 8);
    assert.deepEqual(wav.subarray(44), Buffer.concat([chunk1, chunk2]));
    assert.equal(wsInstance.closedWith.code, 1000);
});

test('OpenAI Realtime falls back to direct API key subprotocol on 404 and preserves existing query params', async () => {
    let wsInstance;
    const FakeWS = createFakeWebSocket((ws, msg) => {
        wsInstance = ws;
        if (msg.type === 'session.update') {
            ws._emit('message', { data: JSON.stringify({ type: 'session.updated' }) });
        } else if (msg.type === 'response.create') {
            ws._emit('message', {
                data: JSON.stringify({ type: 'response.output_audio.delta', delta: Buffer.from([1, 2]).toString('base64') }),
            });
            ws._emit('message', {
                data: JSON.stringify({ type: 'response.done', response: { status: 'completed' } }),
            });
        }
    });

    const tts = loadTts({
        fetchImpl: async () => ({ ok: false, status: 404, data: { error: { message: 'not found' } } }),
        WebSocketCtor: FakeWS,
    });

    const result = await tts('hello', {
        apiKey: 'sk-custom-relay-key',
        requestPath: 'https://relay.example.com/openai/realtime?api-version=2026-01',
        customModel: 'gpt-realtime-1.5',
    });

    assert.equal(wsInstance.url, 'wss://relay.example.com/openai/realtime?api-version=2026-01&model=gpt-realtime-1.5');
    assert.deepEqual(plain(wsInstance.protocols), ['realtime', 'openai-insecure-api-key.sk-custom-relay-key']);
    // Non-2.x realtime model should not send reasoning field
    assert.equal(wsInstance.sent[0].session.reasoning, undefined);
    assert.equal(result.length, 46);
});

test('Realtime failed response status and premature socket close reject cleanly', async () => {
    const FakeFailedStatusWS = createFakeWebSocket((ws, msg) => {
        if (msg.type === 'session.update') {
            ws._emit('message', { data: JSON.stringify({ type: 'session.updated' }) });
        } else if (msg.type === 'response.create') {
            ws._emit('message', {
                data: JSON.stringify({
                    type: 'response.done',
                    response: { status: 'failed', status_details: { error: { message: 'rate_limit_exceeded' } } },
                }),
            });
        }
    });

    const ttsFailed = loadTts({
        fetchImpl: async () => ({ ok: true, status: 200, data: { value: 'ek_test_111111' } }),
        WebSocketCtor: FakeFailedStatusWS,
    });
    await assert.rejects(
        ttsFailed('hello', { apiKey: 'sk-key-111111', model: 'gpt-realtime-2.1-mini' }),
        /rate_limit_exceeded/
    );

    const FakeEarlyCloseWS = createFakeWebSocket((ws, msg) => {
        if (msg.type === 'session.update') {
            ws._emit('close', { code: 1008, reason: 'policy violation' });
        }
    });
    const ttsClosed = loadTts({
        fetchImpl: async () => ({ ok: true, status: 200, data: { value: 'ek_test_222222' } }),
        WebSocketCtor: FakeEarlyCloseWS,
    });
    await assert.rejects(
        ttsClosed('hello', { apiKey: 'sk-key-222222', model: 'gpt-realtime-2.1-mini' }),
        /1008.*policy violation/
    );
});

test('HTTP and Realtime errors redact API keys and ephemeral tokens', async () => {
    const secretKey = 'sk-proj-super-secret-999999';
    const ttsFailAuth = loadTts({
        fetchImpl: async () => ({
            ok: false,
            status: 401,
            data: { error: { message: `Invalid key ${secretKey}` } },
        }),
        WebSocketCtor: class DummyWS {},
    });

    await assert.rejects(
        ttsFailAuth('hello', { apiKey: secretKey, model: 'gpt-realtime-2.1-mini' }),
        (err) => /401/.test(err.message) && !err.message.includes(secretKey) && err.message.includes('[REDACTED]')
    );

    const FakeFailWS = createFakeWebSocket((ws, msg) => {
        if (msg.type === 'session.update') {
            ws._emit('message', {
                data: JSON.stringify({ type: 'error', error: { message: 'Failed for ek_temp_secret_888' } }),
            });
        }
    });

    const ttsWsError = loadTts({
        fetchImpl: async () => ({ ok: true, status: 200, data: { value: 'ek_temp_secret_888' } }),
        WebSocketCtor: FakeFailWS,
    });

    await assert.rejects(
        ttsWsError('hello', { apiKey: secretKey, model: 'gpt-realtime-2.1-mini' }),
        (err) => !err.message.includes('ek_temp_secret_888') && err.message.includes('[REDACTED]')
    );
});
