# LLM Balance Widget

**English** | [Русский](#русский) | [中文](#中文)

A small draggable widget for DeepSeek Harness that shows **your own** LLM API balance — DeepSeek or OpenRouter — and converts currencies in the corner of the app.

## Features

- **Bring your own key.** Stored locally in the app window, sent only to the provider.
- **DeepSeek** — balance from `GET /user/balance` (USD or CNY wallets), plus a `≈ N tokens` estimate.
- **OpenRouter** — remaining credits from `GET /api/v1/credits`.
- **Converter** — any amount in the selected currency, shown in all the others; click a value to copy it.
- **Rates from local central banks** — RUB uses the Bank of Russia, USD the Federal Reserve (H.10), CNY the PBOC fixing; where a bank does not quote a currency, the CBR cross-rate is used.
- **Display currency:** USD by default, RUB or CNY in one click — the balance and the converter both follow it.
- **Languages:** English by default, plus Russian and 中文. Language and currency are remembered.
- Auto refresh every 60 seconds, plus a click on the amount; drag anywhere, collapse to one line, position is remembered.

## Install

1. Copy this folder to `<DSH profile>/node_modules/@local/llm-balance-widget`.
2. In `<DSH profile>/package.json` add `"@local/llm-balance-widget": "1.8.9"` to `dependencies` and `"@local/llm-balance-widget"` to `dsh.profile.bundles`.
3. Restart DeepSeek Harness.

The desktop profile lives in `%USERPROFILE%\.dsh\profiles\desktop` on Windows.

## Getting an API key

1. Open <https://platform.deepseek.com> (or <https://openrouter.ai/keys> for OpenRouter).
2. Sign in with the account you use for the API.
3. Open **API keys** → **Create new API key** and give it any name.
4. **Copy the key immediately** — it is shown only once and starts with `sk-`.
5. In the widget press **⚙**, paste the key and press **Save**.

If the key list says **Managed by Harness**, that key is kept by the app and cannot be copied. Create your own key instead — it opens the same account.

## The balance belongs to the account, not to the key

Money is kept on your account; an API key is only a password to it. That is why:

- a newly created key shows the **same** balance as the old one — nothing is lost or duplicated;
- deleting a key does not take the money away;
- topping up once is visible to every key of the account;
- if two keys show different balances, they belong to **different accounts** — check which login you used.

## Reading the widget

```text
$ USD   [100]      = 8 053,07 ₽
         1 $ = 80,53 ₽
Convert [10000] RUB
  $ 124,18 · € 110,99 · ¥ 828,66 · …
Balance ₽220,90  ≈ 9.8 M tokens      ⚙  ▁▃▅▇↗
```

- the row reads as an equation: amount in the foreign currency = result in the selected one;
- the small line under it is the unit rate and the daily move;
- the tokens estimate assumes **$0.28 per 1M input tokens** (cache miss), so it is an upper bound — output tokens cost more.

## Privacy

The key lives in the app window's `localStorage` under `llm-balance.key.<provider>` and is sent only to `api.deepseek.com` or `openrouter.ai`. There is no proxy, no telemetry and no analytics. The only server routes are `/llm-balance/open` (opens the provider page) and `/llm-balance/bank` (fetches Fed and PBOC rates, which do not allow browser requests); neither receives the key.

## Limitations

- OpenRouter is protected by Cloudflare and may answer `403` on some networks; the widget then shows `unavailable`.
- The Fed publishes H.10 weekly, the PBOC fixing daily at 09:15 Beijing time; native-bank data older than 7 days is ignored in favour of the CBR cross-rate.
- The RUB rate is re-checked hourly; the CBR publishes once a day.

## Tests

```powershell
node test/providers.test.cjs
node test/banks.test.mjs
```

---

## Русский

Небольшой перетаскиваемый виджет для DeepSeek Harness: показывает **ваш собственный** баланс API (DeepSeek или OpenRouter) и конвертирует валюты в углу приложения.

### Возможности

- **Свой ключ.** Хранится локально в окне приложения, уходит только провайдеру.
- **DeepSeek** — баланс из `GET /user/balance` (кошельки USD и CNY) и оценка `≈ N токенов`.
- **OpenRouter** — остаток кредитов из `GET /api/v1/credits`.
- **Конвертер** — любая сумма в выбранной валюте показывается во всех остальных; клик по значению копирует его.
- **Курсы от местных ЦБ** — рубли от Банка России, доллары от ФРС (H.10), юани от НБК (фиксинг); где ЦБ валюту не котирует, берётся кросс-курс ЦБ РФ.
- **Валюта отображения:** по умолчанию доллары, одним кликом — рубли или юани; за ней следуют и баланс, и конвертер.
- **Языки:** английский по умолчанию, плюс русский и 中文. Язык и валюта запоминаются.
- Автообновление раз в 60 секунд и по клику на сумму; перетаскивание, сворачивание, запоминание позиции.

### Установка

1. Скопируй папку в `<профиль DSH>/node_modules/@local/llm-balance-widget`.
2. В `<профиль DSH>/package.json` добавь `"@local/llm-balance-widget": "1.8.9"` в `dependencies` и `"@local/llm-balance-widget"` в `dsh.profile.bundles`.
3. Перезапусти DeepSeek Harness.

Профиль на Windows: `%USERPROFILE%\.dsh\profiles\desktop`.

### Как создать ключ

1. Открой <https://platform.deepseek.com> (для OpenRouter — <https://openrouter.ai/keys>).
2. Войди в тот аккаунт, которым пользуешься для API.
3. Раздел **API keys** → **Create new API key**, любое имя.
4. **Скопируй ключ сразу** — он показывается один раз и начинается с `sk-`.
5. В виджете нажми **⚙**, вставь ключ и нажми **Сохранить**.

Если в списке ключей написано **Managed by Harness** — этот ключ хранится в приложении и скопировать его нельзя. Создай свой: он открывает тот же аккаунт.

### Баланс привязан к счёту, а не к ключу

Деньги лежат на аккаунте, а API-ключ — это только пропуск к нему. Поэтому:

- новый ключ показывает **тот же** баланс, что и старый: ничего не теряется и не дублируется;
- удаление ключа не забирает деньги;
- одно пополнение видно всем ключам аккаунта;
- если два ключа показывают разный баланс — они из **разных аккаунтов**, проверь, под каким логином создан ключ.

### Как читать виджет

- строка читается как уравнение: сумма в валюте = результат в выбранной валюте;
- мелкая строка под ней — курс за единицу и изменение за день;
- оценка токенов считается по **$0.28 за 1М входных токенов** (cache miss), то есть это верхняя граница: выходные токены дороже.

### Приватность

Ключ хранится в `localStorage` окна под `llm-balance.key.<провайдер>` и отправляется только на `api.deepseek.com` или `openrouter.ai`. Прокси и телеметрии нет. Серверных роутов два: `/llm-balance/open` (открыть страницу ключей) и `/llm-balance/bank` (курсы ФРС и НБК, у них нет CORS); ключ в них не передаётся.

### Ограничения

- OpenRouter защищён Cloudflare и на некоторых сетях отвечает `403` — виджет показывает «недоступен».
- ФРС публикует H.10 раз в неделю, НБК — ежедневно в 09:15 по Пекину; данные старше 7 дней игнорируются в пользу кросс-курса ЦБ РФ.
- Курс рубля перепроверяется раз в час; ЦБ публикует раз в день.

### Тесты

```powershell
node test/providers.test.cjs
node test/banks.test.mjs
```

---

## 中文

一个小巧的可拖动窗口小部件，用于 DeepSeek Harness：在应用角落显示**你自己的** API 余额（DeepSeek 或 OpenRouter），并换算货币。

### 功能

- **使用自己的密钥。** 只保存在应用窗口中，只发送给服务商。
- **DeepSeek** — 通过 `GET /user/balance` 显示余额（USD 与 CNY 钱包），并估算 `≈ N 个 token`。
- **OpenRouter** — 通过 `GET /api/v1/credits` 显示剩余额度。
- **换算器** — 输入所选货币的金额，立即显示其余所有货币；点击数值即可复制。
- **使用各国央行汇率** — 卢布用俄罗斯央行，美元用美联储（H.10），人民币用中国央行中间价；央行不报价的货币使用俄罗斯央行的交叉汇率。
- **显示货币：** 默认美元，一键切换卢布或人民币；余额和换算器都会跟着切换。
- **语言：** 默认英文，另有俄文和中文。语言与货币都会被记住。
- 每 60 秒自动刷新，点击金额也会刷新；可拖动、可折叠，位置会被记住。

### 安装

1. 把本文件夹复制到 `<DSH 配置目录>/node_modules/@local/llm-balance-widget`。
2. 在 `<DSH 配置目录>/package.json` 的 `dependencies` 中加入 `"@local/llm-balance-widget": "1.8.9"`，并在 `dsh.profile.bundles` 中加入 `"@local/llm-balance-widget"`。
3. 重启 DeepSeek Harness。

Windows 上的配置目录：`%USERPROFILE%\.dsh\profiles\desktop`。

### 如何创建 API 密钥

1. 打开 <https://platform.deepseek.com>（OpenRouter 为 <https://openrouter.ai/keys>）。
2. 用你调用 API 的账号登录。
3. 进入 **API keys** → **Create new API key**，名称随意。
4. **立即复制密钥** —— 它只显示一次，并以 `sk-` 开头。
5. 在小部件中点击 **⚙**，粘贴密钥，点击 **保存 / Save**。

如果密钥列表里写着 **Managed by Harness**，说明该密钥由应用保管，无法复制。请自己新建一个密钥，它使用的是同一个账号。

### 余额属于账户，而不属于密钥

钱存在账户里，API 密钥只是访问它的通行证。因此：

- 新建的密钥显示与旧密钥**相同**的余额，不会丢失也不会重复；
- 删除密钥不会带走余额；
- 充值一次，账户下的所有密钥都能看到；
- 如果两个密钥显示的余额不同，说明它们属于**不同账户**，请确认登录的是哪个账号。

### 如何阅读小部件

- 每一行是一个等式：外币金额 = 所选货币的结果；
- 下面一行小字是单位汇率和当日涨跌；
- token 估算是按 **每百万输入 token $0.28** 计算的（cache miss），因此是上限：输出 token 更贵。

### 隐私

密钥保存在应用窗口的 `localStorage`（`llm-balance.key.<提供方>`），只会发送到 `api.deepseek.com` 或 `openrouter.ai`。没有代理、没有遥测。服务端只有两个接口：`/llm-balance/open`（打开密钥页面）和 `/llm-balance/bank`（获取美联储和中国央行汇率，它们不允许浏览器直接请求）；密钥不会传给它们。

### 限制

- OpenRouter 受 Cloudflare 保护，部分网络会返回 `403`，此时小部件显示「不可用」。
- 美联储 H.10 每周发布一次，中国央行中间价每天北京时间 09:15 发布；超过 7 天的数据会被忽略，改用俄罗斯央行的交叉汇率。
- 卢布汇率每小时重新检查，俄罗斯央行每天发布一次。

### 测试

```powershell
node test/providers.test.cjs
node test/banks.test.mjs
```
