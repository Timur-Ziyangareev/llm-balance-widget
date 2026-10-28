# LLM Balance Widget

**English** | [Русский](#русский)

A small draggable widget for DeepSeek Harness that shows **your own** LLM API balance — DeepSeek or OpenRouter — in the corner of the app.

## Features

- **Bring your own key.** Paste it in the widget settings; it is stored locally and sent only to the provider.
- **DeepSeek** — live balance from `GET /user/balance` (USD or CNY), plus a rough `≈ N tokens` estimate at $0.28 per 1M input tokens.
- **OpenRouter** — remaining credits from `GET /api/v1/credits`.
- **USD by default**, one click to **RUB** (converted at the CBR daily rate).
- **English by default**, one click to **Russian**. Language and currency are both remembered.
- Auto refresh every 60 seconds, drag anywhere, collapse to one line, position is remembered.
- No backend: the browser talks to the provider directly, so the key never touches any server of this project.

## Install

1. Copy this folder to `<DSH profile>/node_modules/@local/llm-balance-widget`.
2. In `<DSH profile>/package.json` add `"@local/llm-balance-widget": "1.0.0"` to `dependencies` and `"@local/llm-balance-widget"` to `dsh.profile.bundles`.
3. Restart DeepSeek Harness.

The desktop profile lives in `%USERPROFILE%\.dsh\profiles\desktop` on Windows.

## Usage

Click **⚙** in the widget, pick a provider, paste the key and press **Save**.

- DeepSeek key: <https://platform.deepseek.com/api_keys>
- OpenRouter key: <https://openrouter.ai/keys>

## Privacy

The key is stored in the app window's `localStorage` under `llm-balance.key.<provider>` and is sent only to `api.deepseek.com` or `openrouter.ai`. There is no proxy, no telemetry and no analytics.

## Limitations

- OpenRouter is protected by Cloudflare and may answer `403` on some networks; the widget then shows `unavailable`.
- The token estimate is DeepSeek-only and assumes $0.28 per 1M input tokens (cache miss). Real cost depends on the input/output mix.
- The RUB rate comes from `cbr-xml-daily.ru` and is refreshed every 6 hours.

## Tests

```powershell
node test/providers.test.cjs
```

The test loads `client.js` in a sandbox and checks the response parsers against sample payloads.

---

## Русский

Небольшой перетаскиваемый виджет для DeepSeek Harness, который показывает **ваш собственный** баланс API — DeepSeek или OpenRouter — в углу приложения.

### Возможности

- **Свой ключ.** Вставляется в настройках виджета, хранится локально и уходит только провайдеру.
- **DeepSeek** — живой баланс из `GET /user/balance` (USD или CNY) и грубая оценка «≈ N токенов» при $0.28 за 1М входных токенов.
- **OpenRouter** — остаток кредитов из `GET /api/v1/credits`.
- **По умолчанию доллары**, одним кликом — **рубли** (по курсу ЦБ на текущий день).
- **По умолчанию английский**, одним кликом — **русский**. Язык и валюта запоминаются.
- Автообновление раз в 60 секунд, перетаскивание, сворачивание в одну строку, позиция запоминается.
- Серверной части нет: браузер обращается к провайдеру напрямую, ключ не проходит через чужие серверы.

### Установка

1. Скопируй папку в `<профиль DSH>/node_modules/@local/llm-balance-widget`.
2. В `<профиль DSH>/package.json` добавь `"@local/llm-balance-widget": "1.0.0"` в `dependencies` и `"@local/llm-balance-widget"` в `dsh.profile.bundles`.
3. Перезапусти DeepSeek Harness.

Профиль на Windows лежит в `%USERPROFILE%\.dsh\profiles\desktop`.

### Как пользоваться

Нажми **⚙** в виджете, выбери провайдера, вставь ключ и нажми **Save**.

- Ключ DeepSeek: <https://platform.deepseek.com/api_keys>
- Ключ OpenRouter: <https://openrouter.ai/keys>

### Приватность

Ключ хранится в `localStorage` окна под ключом `llm-balance.key.<провайдер>` и отправляется только на `api.deepseek.com` или `openrouter.ai`. Прокси, телеметрии и аналитики нет.

### Ограничения

- OpenRouter защищён Cloudflare и на некоторых сетях отвечает `403`; виджет тогда показывает «недоступен».
- Оценка токенов — только для DeepSeek и по цене $0.28 за 1М входных токенов (cache miss). Реальная стоимость зависит от соотношения входных и выходных токенов.
- Курс рубля берётся с `cbr-xml-daily.ru` и обновляется раз в 6 часов.

### Тесты

```powershell
node test/providers.test.cjs
```

Тест загружает `client.js` в песочницу и проверяет парсеры ответов на примерах.
