# LLM Balance Widget

**English** | [Русский](#русский)

A small draggable widget for DeepSeek Harness that shows **your own** LLM API balance — DeepSeek or OpenRouter — in the corner of the app.

## Features

- **Bring your own key.** Paste it in the widget settings; it is stored locally and sent only to the provider.
- **DeepSeek** — live balance from `GET /user/balance` (USD or CNY), plus a rough `≈ N tokens` estimate at $0.28 per 1M input tokens.
- **OpenRouter** — remaining credits from `GET /api/v1/credits`.
- **Display currency:** USD by default, RUB or CNY in one click. The balance **and** the whole converter follow it: pick dollars and every row is converted into dollars. The row of the currency you convert into is not shown, so there are no "RUB to RUB" lines.
- **Rates from the local central bank** — RUB uses the Bank of Russia, USD uses the Federal Reserve (H.10), CNY uses the PBOC daily fixing. Where a bank does not quote a currency (the Fed has no tenge, hryvnia or Belarusian ruble), that row falls back to the CBR cross-rate, and the header shows which bank and which date are in use.
- **Full converter** — USD, EUR, CNY, KZT, UAH and BYN plus RUB, with the daily move where the source provides it. Click any result to copy it.
- **English by default**, one click to **Russian** or **中文**. Language and currency are both remembered.
- Auto refresh every 60 seconds, drag anywhere, collapse to one line, position is remembered.
- **Get a key** opens the provider page in your default browser **and raises the browser window** (Windows), instead of leaving a background tab. The browser is resolved from the `https` handler in the registry, so Edge, Chrome, Firefox, Opera, Brave and friends all work; if the default cannot be matched, a single other running browser is raised (never a guess when several are open).
- The key is used by the browser itself; the tiny `/llm-balance/open` route exists only to open that page and never receives the key.

## Install

1. Copy this folder to `<DSH profile>/node_modules/@local/llm-balance-widget`.
2. In `<DSH profile>/package.json` add `"@local/llm-balance-widget": "1.8.4"` to `dependencies` and `"@local/llm-balance-widget"` to `dsh.profile.bundles`.
3. Restart DeepSeek Harness.

The desktop profile lives in `%USERPROFILE%\.dsh\profiles\desktop` on Windows.

## Usage

Click **⚙** in the widget, pick a provider, paste the key and press **Save**.

Keys look like `sk-…` (DeepSeek) or `sk-or-v1-…` (OpenRouter). Anything else — a UUID, a session id, a key from another service — is rejected in the widget before it is saved, because the provider would answer `401` anyway.

- DeepSeek key: <https://platform.deepseek.com/api_keys>
- OpenRouter key: <https://openrouter.ai/keys>

## Privacy

The key is stored in the app window's `localStorage` under `llm-balance.key.<provider>` and is sent only to `api.deepseek.com` or `openrouter.ai`. There is no proxy, no telemetry and no analytics. The only server route (`/llm-balance/open`) opens the provider page and never receives the key.

## Limitations

- OpenRouter is protected by Cloudflare and may answer `403` on some networks; the widget then shows `unavailable`.
- The token estimate is DeepSeek-only and assumes $0.28 per 1M input tokens (cache miss). Real cost depends on the input/output mix.
- The RUB rate comes from `cbr-xml-daily.ru` (CBR publishes once a day) and is re-checked hourly; the date next to the balance is the CBR date. A cached payload that is missing converter currencies is discarded instead of reused.
- The Fed publishes H.10 **weekly**, so its rates are usually a few days old; PBOC publishes the fixing daily at 09:15 Beijing time. Native-bank data older than 7 days is ignored and the CBR cross-rate is used instead.

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
- **Валюта отображения:** по умолчанию доллары, одним кликом — рубли или юани. За ней следует **и баланс, и весь конвертер**: выбрал доллары — всё пересчитывается в доллары. Строка той валюты, в которую считаем, не показывается, так что «рубли в рубли» не бывает.
- **Курсы от местного ЦБ** — для рублей это Банк России, для долларов — ФРС (H.10), для юаней — фиксинг НБК. Где ЦБ не котирует валюту (у ФРС нет тенге, гривны и белорусского рубля), строка считается кросс-курсом ЦБ РФ, а в шапке видно, какой банк и какая дата использованы.
- **Полный конвертер** — USD, EUR, CNY, KZT, UAH и BYN плюс RUB, с изменением за день там, где источник его даёт. Клик по результату копирует его.
- **По умолчанию английский**, одним кликом — **русский** или **中文**. Язык и валюта запоминаются.
- Автообновление раз в 60 секунд, перетаскивание, сворачивание в одну строку, позиция запоминается.
- **«Получить ключ»** открывает страницу провайдера в браузере по умолчанию **и поднимает окно браузера** (Windows), а не оставляет вкладку на фоне. Браузер берётся из обработчика `https` в реестре — Edge, Chrome, Firefox, Opera, Brave и другие работают одинаково; если default не нашёлся, поднимается единственный запущенный браузер (при нескольких — никаких догадок).
- Ключ использует сам браузер; маленький роут `/llm-balance/open` нужен только для открытия страницы и ключ не получает.

### Установка

1. Скопируй папку в `<профиль DSH>/node_modules/@local/llm-balance-widget`.
2. В `<профиль DSH>/package.json` добавь `"@local/llm-balance-widget": "1.8.4"` в `dependencies` и `"@local/llm-balance-widget"` в `dsh.profile.bundles`.
3. Перезапусти DeepSeek Harness.

Профиль на Windows лежит в `%USERPROFILE%\.dsh\profiles\desktop`.

### Как пользоваться

Нажми **⚙** в виджете, выбери провайдера, вставь ключ и нажми **Save**.

Ключи выглядят как `sk-…` (DeepSeek) или `sk-or-v1-…` (OpenRouter). Всё остальное — UUID, id сессии, ключ другого сервиса — виджет отклоняет ещё до сохранения, потому что провайдер всё равно ответил бы `401`.

- Ключ DeepSeek: <https://platform.deepseek.com/api_keys>
- Ключ OpenRouter: <https://openrouter.ai/keys>

### Приватность

Ключ хранится в `localStorage` окна под ключом `llm-balance.key.<провайдер>` и отправляется только на `api.deepseek.com` или `openrouter.ai`. Прокси, телеметрии и аналитики нет.

### Ограничения

- OpenRouter защищён Cloudflare и на некоторых сетях отвечает `403`; виджет тогда показывает «недоступен».
- Оценка токенов — только для DeepSeek и по цене $0.28 за 1М входных токенов (cache miss). Реальная стоимость зависит от соотношения входных и выходных токенов.
- Курс рубля берётся с `cbr-xml-daily.ru` (ЦБ публикует раз в день) и перепроверяется раз в час; дата рядом с балансом — это дата курса ЦБ. Кэш, в котором не хватает валют конвертера, отбрасывается, а не используется.
- ФРС публикует H.10 **раз в неделю**, поэтому её курсы обычно отстают на несколько дней; НБК даёт фиксинг ежедневно в 09:15 по Пекину. Данные «родного» ЦБ старше 7 дней игнорируются — вместо них берётся кросс-курс ЦБ РФ.

### Тесты

```powershell
node test/providers.test.cjs
```

Тест загружает `client.js` в песочницу и проверяет парсеры ответов на примерах.
