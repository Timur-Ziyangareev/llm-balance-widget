window.__ModuleLoader__.load({
  id: '@local/llm-balance-widget',
  factory(require) {
    var React;
    try { React = require('react'); } catch (e) { return { inject: ['slots'], apply() {} }; }
    var h = React.createElement;

    var DEEPSEEK_URL = 'https://api.deepseek.com/user/balance';
    var OPENROUTER_URL = 'https://openrouter.ai/api/v1/credits';
    var RATES_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';
    var BANK_URL = '/llm-balance/bank';

    // USD per 1M input tokens, cache miss (DeepSeek V3.2 pricing).
    var DEEPSEEK_PRICE = 0.28;

    var REFRESH_MS = 60000;
    var RETRY_MS = 20000;
    // CBR publishes once a day, so an hour is plenty; a cached payload that is
    // missing converter currencies is ignored regardless of its age.
    var RATES_TTL = 60 * 60 * 1000;

    var K = {
      lang: 'llm-balance.lang',
      currency: 'llm-balance.currency',
      provider: 'llm-balance.provider',
      pos: 'llm-balance.pos',
      collapsed: 'llm-balance.collapsed',
      rates: 'llm-balance.rates.v2',
      ratesAt: 'llm-balance.ratesAt.v2',
      inputs: 'llm-balance.inputs',
      keyPrefix: 'llm-balance.key.'
    };

    var PROVIDERS = [
      { id: 'deepseek', label: 'DeepSeek', hint: 'sk-…', keysUrl: 'https://platform.deepseek.com/api_keys' },
      { id: 'openrouter', label: 'OpenRouter', hint: 'sk-or-…', keysUrl: 'https://openrouter.ai/keys' }
    ];

    var CURRENCIES = [
      { code: 'USD', symbol: '$', label: '$ USD', decimals: 2 },
      { code: 'EUR', symbol: '€', label: '€ EUR', decimals: 2 },
      { code: 'CNY', symbol: '¥', label: '¥ CNY', decimals: 2 },
      { code: 'KZT', symbol: '₸', label: '₸ KZT', decimals: 0 },
      { code: 'UAH', symbol: '₴', label: '₴ UAH', decimals: 2 },
      { code: 'BYN', symbol: 'Br', label: 'Br BYN', decimals: 2 }
    ];
    var DEFAULT_INPUTS = { USD: '100', EUR: '100', CNY: '100', KZT: '1000', UAH: '1000', BYN: '100', RUB: '10000' };

    var TEXT = {
      en: {
        balance: 'Balance',
        settings: 'Settings',
        provider: 'Provider',
        apiKey: 'API key',
        language: 'Language',
        currency: 'Currency',
        save: 'Save',
        clear: 'Clear',
        addKey: 'Add API key',
        noKey: 'no key',
        unauthorized: 'key rejected',
        error: 'unavailable',
        empty: 'no balance data',
        updated: 'updated',
        tokens: 'tokens',
        tokensHint: 'estimate at $' + DEEPSEEK_PRICE + ' / 1M input tokens',
        collapse: 'Collapse',
        expand: 'Expand',
        loading: 'loading…',
        cbr: 'CBR',
        fed: 'Fed',
        pboc: 'PBOC',
        keyPlaceholder: 'paste your key',
        keyFormat: 'That does not look like a key — DeepSeek and OpenRouter keys start with "sk-".',
        copy: 'Click to copy',
        enterRub: 'enter an amount in RUB',
        getKey: 'get a key',
        keySaved: 'key saved',
        refresh: 'refresh',
        native: 'account currency'
      },
      ru: {
        balance: 'Баланс',
        settings: 'Настройки',
        provider: 'Провайдер',
        apiKey: 'API-ключ',
        language: 'Язык',
        currency: 'Валюта',
        save: 'Сохранить',
        clear: 'Очистить',
        addKey: 'Введите API-ключ',
        noKey: 'нет ключа',
        unauthorized: 'ключ отклонён',
        error: 'недоступен',
        empty: 'нет данных о балансе',
        updated: 'обновлено',
        tokens: 'токенов',
        tokensHint: 'оценка при $' + DEEPSEEK_PRICE + ' / 1М входных токенов',
        collapse: 'Свернуть',
        expand: 'Развернуть',
        loading: 'загрузка…',
        cbr: 'ЦБ',
        fed: 'ФРС',
        pboc: 'НБК',
        keyPlaceholder: 'вставьте ключ',
        keyFormat: 'Это не похоже на ключ — ключи DeepSeek и OpenRouter начинаются с «sk-».',
        copy: 'Нажмите, чтобы скопировать',
        enterRub: 'введите сумму в рублях',
        getKey: 'получить ключ',
        keySaved: 'ключ сохранён',
        refresh: 'обновить',
        native: 'валюта счёта'
      },
      zh: {
        balance: '余额',
        settings: '设置',
        provider: '提供商',
        apiKey: 'API 密钥',
        language: '语言',
        currency: '货币',
        save: '保存',
        clear: '清除',
        addKey: '添加 API 密钥',
        noKey: '无密钥',
        unauthorized: '密钥被拒绝',
        error: '不可用',
        empty: '暂无余额数据',
        updated: '更新于',
        tokens: 'tokens',
        tokensHint: '按每百万输入 tokens $' + DEEPSEEK_PRICE + ' 估算',
        collapse: '收起',
        expand: '展开',
        loading: '加载中…',
        cbr: '央行',
        fed: '美联储',
        pboc: '中国央行',
        keyPlaceholder: '粘贴密钥',
        keyFormat: '这不像密钥：DeepSeek 和 OpenRouter 的密钥以 “sk-” 开头。',
        copy: '点击复制',
        enterRub: '输入金额',
        getKey: '获取密钥',
        keySaved: '密钥已保存',
        refresh: '刷新',
        native: '账户货币'
      }
    };

    function t(lang) { return TEXT[lang === 'ru' ? 'ru' : lang === 'zh' ? 'zh' : 'en']; }
    function locale(lang) { return lang === 'ru' ? 'ru-RU' : lang === 'zh' ? 'zh-CN' : 'en-US'; }

    function absUrl(path) {
      try {
        if (window.location && window.location.origin) return new URL(path, window.location.origin).href;
      } catch (e) { /* keep relative */ }
      return path;
    }

    function storageGet(key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function storageSet(key, value) {
      try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    }
    function storageRemove(key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
    function readJson(key) {
      var raw = storageGet(key);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    }
    function readChoice(key, allowed, fallback) {
      var value = storageGet(key);
      return allowed.indexOf(value) >= 0 ? value : fallback;
    }

    function fmtMoney(value, code, lang) {
      if (value == null || !isFinite(value)) return '—';
      try {
        return new Intl.NumberFormat(locale(lang), {
          style: 'currency', currency: code, currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 2, maximumFractionDigits: 2
        }).format(value);
      } catch (e) { return value.toFixed(2) + ' ' + code; }
    }
    function fmtTokens(value, lang) {
      if (value == null || !isFinite(value)) return null;
      if (value <= 0) return '0';
      var big = lang === 'ru' ? 'млн' : 'M';
      var small = lang === 'ru' ? 'тыс' : 'K';
      var sep = lang === 'ru' ? ',' : '.';
      if (value >= 1e6) {
        var m = value / 1e6;
        return (m >= 10 ? m.toFixed(0) : m.toFixed(1)).replace('.', sep) + ' ' + big;
      }
      if (value >= 1e3) return (value / 1e3).toFixed(0) + ' ' + small;
      return value.toFixed(0);
    }
    function fmtClock(ts, lang) {
      if (!ts) return '';
      try {
        return new Date(ts).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });
      } catch (e) { return ''; }
    }
    function fmtDay(iso, lang) {
      var parts = String(iso || '').slice(0, 10).split('-');
      if (parts.length !== 3) return '';
      return lang === 'ru' ? parts[2] + '.' + parts[1] : parts[0] + '-' + parts[1] + '-' + parts[2];
    }
    function fmtNum(value, lang) {
      if (value == null || !isFinite(value)) return '—';
      var abs = Math.abs(value);
      var digits = abs >= 1000 ? 0 : abs >= 10 ? 1 : 2;
      try {
        return new Intl.NumberFormat(locale(lang), {
          minimumFractionDigits: digits, maximumFractionDigits: digits
        }).format(value);
      } catch (e) { return value.toFixed(digits); }
    }
    function fmtRate(value, lang) { return fmtNum(value, lang) + ' ₽'; }
    function fmtAmount(value, decimals, lang) {
      if (value == null || !isFinite(value)) return '—';
      try {
        return new Intl.NumberFormat(locale(lang), {
          minimumFractionDigits: decimals, maximumFractionDigits: decimals
        }).format(value);
      } catch (e) { return value.toFixed(decimals); }
    }
    function toNumber(text) {
      var value = Number(String(text).replace(',', '.').replace(/\s+/g, ''));
      return isFinite(value) ? value : null;
    }
    function copyText(text) {
      try {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(function () {});
          return true;
        }
      } catch (e) { /* fall through */ }
      try {
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
        return true;
      } catch (e) { return false; }
    }
    function copyInteger(value) {
      if (value == null || !isFinite(value)) return false;
      return copyText(String(Math.ceil(value)));
    }

    /** Parse CBR daily rates into RUB per unit plus the daily move. */
    function parseRates(body) {
      var valute = body && body.Valute;
      if (!valute) return null;
      function rubPer(code) {
        var entry = valute[code];
        if (!entry || !entry.Nominal) return null;
        return entry.Value / entry.Nominal;
      }
      function changeOf(code) {
        var entry = valute[code];
        if (!entry || !entry.Nominal || entry.Previous == null) return null;
        var now = entry.Value / entry.Nominal;
        var prev = entry.Previous / entry.Nominal;
        return prev ? (now - prev) / prev : null;
      }
      var usd = rubPer('USD');
      if (usd == null) return null;
      return {
        usd: usd,
        eur: rubPer('EUR'),
        cny: rubPer('CNY'),
        kzt: rubPer('KZT'),
        uah: rubPer('UAH'),
        byn: rubPer('BYN'),
        change: {
          usd: changeOf('USD'),
          eur: changeOf('EUR'),
          cny: changeOf('CNY'),
          kzt: changeOf('KZT'),
          uah: changeOf('UAH'),
          byn: changeOf('BYN')
        },
        date: body.Date || null
      };
    }

    /** DeepSeek: pick the balance entry in USD, falling back to CNY. */
    function parseDeepSeek(body) {
      var infos = body && Array.isArray(body.balance_infos) ? body.balance_infos : [];
      var pick = null;
      for (var i = 0; i < infos.length; i++) {
        if (infos[i] && infos[i].currency === 'USD') { pick = infos[i]; break; }
      }
      if (!pick) {
        for (var j = 0; j < infos.length; j++) {
          if (infos[j] && infos[j].currency === 'CNY') { pick = infos[j]; break; }
        }
      }
      if (!pick) return null;
      return {
        currency: pick.currency,
        amount: Number(pick.total_balance),
        granted: Number(pick.granted_balance),
        toppedUp: Number(pick.topped_up_balance)
      };
    }

    /** OpenRouter: remaining credits = total_credits - total_usage. */
    function parseOpenRouter(body) {
      var data = body && body.data;
      if (!data || data.total_credits == null) return null;
      var total = Number(data.total_credits);
      var used = Number(data.total_usage || 0);
      if (!isFinite(total) || !isFinite(used)) return null;
      return { currency: 'USD', amount: total - used, granted: null, toppedUp: null };
    }

    function toUsd(parsed, rates) {
      if (!parsed || parsed.amount == null || !isFinite(parsed.amount)) return null;
      if (parsed.currency === 'USD') return parsed.amount;
      if (parsed.currency === 'CNY' && rates && rates.cny && rates.usd) {
        return parsed.amount * rates.cny / rates.usd;
      }
      return null;
    }

    /** RUB per one unit of the target currency; RUB is the base. */
    function rubPerTarget(target, rates) {
      if (!rates) return null;
      if (target === 'RUB') return 1;
      var value = rates[target.toLowerCase()];
      return typeof value === 'number' && isFinite(value) ? value : null;
    }

    /** Multiplier that turns an amount in `code` into the target currency. */
    function factorTo(code, target, rates) {
      var perTarget = rubPerTarget(target, rates);
      if (perTarget == null) return null;
      var perCode = code === 'RUB' ? 1 : rubPerTarget(code, rates);
      if (perCode == null) return null;
      return perCode / perTarget;
    }

    /** Convert a USD amount into the display currency. */
    function fromUsd(usd, target, rates) {
      if (usd == null || !isFinite(usd)) return null;
      var perTarget = rubPerTarget(target, rates);
      if (perTarget == null || !rates.usd) return null;
      return usd * rates.usd / perTarget;
    }

    async function requestJson(url, key) {
      var headers = { accept: 'application/json' };
      if (key) headers.authorization = 'Bearer ' + key;
      var res = await fetch(url, { headers: headers, cache: 'no-store' });
      if (res.status === 401 || res.status === 403) return { status: 'unauthorized' };
      if (!res.ok) return { status: 'error', code: res.status };
      return { status: 'ok', body: await res.json() };
    }

    async function fetchBalance(provider, key) {
      if (!key) return { status: 'no-key' };
      try {
        var url = provider === 'openrouter' ? OPENROUTER_URL : DEEPSEEK_URL;
        var res = await requestJson(url, key);
        if (res.status !== 'ok') return res;
        var parsed = provider === 'openrouter' ? parseOpenRouter(res.body) : parseDeepSeek(res.body);
        if (!parsed) return { status: 'empty' };
        return { status: 'ready', data: parsed };
      } catch (e) {
        return { status: 'error', reason: String((e && e.message) || e) };
      }
    }

    async function fetchRates() {
      try {
        var res = await fetch(RATES_URL, { headers: { accept: 'application/json' }, cache: 'no-store' });
        if (!res.ok) return null;
        var parsed = parseRates(await res.json());
        if (!parsed) return null;
        storageSet(K.rates, JSON.stringify(parsed));
        storageSet(K.ratesAt, String(Date.now()));
        return parsed;
      } catch (e) { return null; }
    }

    /** Decorative trend icon: bars with an arrow running along them. */
    function trendIcon(up, label, colorOverride) {
      var color = colorOverride || (up ? '#2e9e5b' : '#d9534f');
      var heights = up ? [3, 6, 9, 12] : [12, 9, 6, 3];
      var parts = [];
      for (var i = 0; i < heights.length; i++) {
        parts.push(h('rect', {
          key: 'b' + i,
          x: i * 4.5, y: 14 - heights[i], width: 3, height: heights[i],
          rx: 0.8, fill: color, opacity: 0.5,
        }));
      }
      parts.push(h('path', {
        key: 'line',
        d: up ? 'M1.6 10.4 L15 2' : 'M1.6 2 L15 10.4',
        fill: 'none', stroke: color, strokeWidth: 1.3, strokeLinecap: 'round',
      }));
      parts.push(h('path', {
        key: 'head',
        d: up ? 'M11.6 2 L15 2 L15 5.4' : 'M11.6 10.4 L15 10.4 L15 7',
        fill: 'none', stroke: color, strokeWidth: 1.3, strokeLinecap: 'round',
      }));
      return h('svg', {
        width: 18, height: 15, viewBox: '0 0 18 15',
        title: label || '', 'aria-label': label || '',
        style: { display: 'block', overflow: 'visible' },
      }, parts);
    }


    /** A cached payload is only usable when every converter currency is present. */
    function hasRates(value) {
      if (!value) return false;
      var codes = ['usd', 'eur', 'cny', 'kzt', 'uah', 'byn'];
      for (var i = 0; i < codes.length; i++) {
        if (typeof value[codes[i]] !== 'number' || !isFinite(value[codes[i]])) return false;
      }
      return true;
    }

    var HOME_MARGIN = 12;
    var SNAP_THRESHOLD = 48;

    var styles = {
      widget: {
        position: 'absolute',
        right: HOME_MARGIN,
        bottom: HOME_MARGIN,
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '10px 14px', borderRadius: 'var(--dsw-radius-xl, 12px)',
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.35))',
        background: 'var(--dsw-alias-bg-module-platform, rgba(30,30,30,0.92))',
        boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
        color: 'var(--dsw-alias-label-primary, #ffffff)',
        fontSize: 12, lineHeight: '17px', maxWidth: 340,
        pointerEvents: 'auto', userSelect: 'none', zIndex: 9999,
        cursor: 'grab',
      },
      iconBtn: {
        border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-tertiary, #aaaaaa)',
        cursor: 'pointer', fontSize: 14, lineHeight: '14px', padding: '0 3px', fontFamily: 'inherit',
      },
      meta: { fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' },
      bigRow: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
      balanceRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 },
      balanceLabel: { fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' },
      smallRow: { display: 'flex', alignItems: 'center', gap: 6 },
      smallAmount: { fontSize: 14, fontWeight: 700 },
      smallTokens: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' },
      gearBtn: {
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.45))',
        background: 'transparent', color: 'var(--dsw-alias-label-primary, inherit)',
        borderRadius: 9, fontSize: 17, lineHeight: '17px', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
        flex: '0 0 auto',
      },
      amount: { fontSize: 21, fontWeight: 700, lineHeight: '26px' },
      tokens: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' },
      secondary: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' },
      muted: { fontSize: 13, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)', cursor: 'pointer' },
      panel: {
        display: 'flex', flexDirection: 'column', gap: 7,
        borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
        marginTop: 4, paddingTop: 8,
      },
      field: { display: 'flex', alignItems: 'center', gap: 8 },
      fieldLabel: { width: 62, flex: '0 0 auto', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' },
      select: {
        flex: '1 1 auto', minWidth: 0, padding: '3px 6px', borderRadius: 6,
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.4))',
        background: 'var(--dsw-alias-bg-base, transparent)',
        color: 'var(--dsw-alias-label-primary, inherit)',
        fontFamily: 'inherit', fontSize: 12, outline: 'none', cursor: 'pointer',
      },
      input: {
        flex: '1 1 auto', minWidth: 0, padding: '3px 7px', borderRadius: 6,
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.4))',
        background: 'var(--dsw-alias-bg-base, transparent)',
        color: 'var(--dsw-alias-label-primary, inherit)',
        fontFamily: 'inherit', fontSize: 12, outline: 'none', cursor: 'text',
      },
      smallBtn: {
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.4))',
        background: 'transparent', color: 'var(--dsw-alias-label-primary, inherit)',
        borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
      },
      smallBtnActive: {
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.4))',
        background: 'var(--dsw-alias-bg-base, rgba(255,255,255,0.12))',
        color: 'var(--dsw-alias-label-primary, inherit)',
        borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
        fontWeight: 600,
      },
      hintRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      link: { fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)', cursor: 'pointer', textDecoration: 'underline' },
      linkBtn: {
        border: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit',
        fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)', cursor: 'pointer', textDecoration: 'underline',
      },
      saved: { fontSize: 10.5, color: '#2e9e5b' },
      error: { fontSize: 10.5, color: '#d9534f' },
      rateTable: {
        display: 'flex', flexDirection: 'column', gap: 1, marginTop: 5, paddingTop: 6,
        borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
      },
      row: { display: 'flex', alignItems: 'center', gap: 6 },
      code: { width: 56, flex: '0 0 auto', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' },
      input: {
        width: 76, boxSizing: 'border-box', padding: '3px 7px', borderRadius: 6,
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.4))',
        background: 'var(--dsw-alias-bg-base, transparent)',
        color: 'var(--dsw-alias-label-primary, inherit)',
        fontFamily: 'inherit', fontSize: 12, textAlign: 'right', outline: 'none', cursor: 'text',
      },
      result: {
        marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
        cursor: 'copy', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
      },
      sub: { fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)', paddingLeft: 62 },
      divider: { borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))', margin: '4px 0 2px' },
      rubList: {
        display: 'flex', flexWrap: 'wrap', gap: '2px 10px',
        fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)', paddingTop: 2,
      },
      rubItem: { whiteSpace: 'nowrap', cursor: 'copy' },
    };

    function BalanceWidget() {
      var langRef = React.useState(function () { return readChoice(K.lang, ['en', 'ru'], 'en'); });
      var lang = langRef[0], setLang = langRef[1];

      var currencyRef = React.useState(function () { return readChoice(K.currency, ['USD', 'RUB', 'CNY'], 'USD'); });
      var currency = currencyRef[0], setCurrency = currencyRef[1];

      var providerRef = React.useState(function () { return readChoice(K.provider, ['deepseek', 'openrouter'], 'deepseek'); });
      var provider = providerRef[0], setProvider = providerRef[1];

      var keyRef = React.useState(function () { return storageGet(K.keyPrefix + readChoice(K.provider, ['deepseek', 'openrouter'], 'deepseek')) || ''; });
      var apiKey = keyRef[0], setApiKey = keyRef[1];

      var draftRef = React.useState('');
      var draftKey = draftRef[0], setDraftKey = draftRef[1];

      var keyErrorRef = React.useState(null);
      var keyError = keyErrorRef[0], setKeyError = keyErrorRef[1];

      var inputsRef = React.useState(function () {
        var saved = readJson(K.inputs);
        var next = {};
        for (var key in DEFAULT_INPUTS) {
          var value = saved ? saved[key] : null;
          next[key] = (typeof value === 'string' || typeof value === 'number') ? String(value) : DEFAULT_INPUTS[key];
        }
        return next;
      });
      var inputs = inputsRef[0], setInputs = inputsRef[1];

      var copiedRef = React.useState(null);
      var copied = copiedRef[0], setCopied = copiedRef[1];

      var balanceRef = React.useState({ status: 'idle' });
      var balance = balanceRef[0], setBalance = balanceRef[1];

      var ratesRef = React.useState(null);
      var rates = ratesRef[0], setRates = ratesRef[1];

      var bankRef = React.useState({ status: 'idle' });
      var bank = bankRef[0], setBank = bankRef[1];

      var settingsRef = React.useState(false);
      var settingsOpen = settingsRef[0], setSettingsOpen = settingsRef[1];

      var collapsedRef = React.useState(false);
      var collapsed = collapsedRef[0], setCollapsed = collapsedRef[1];

      var savedRef = React.useState(false);
      var saved = savedRef[0], setSaved = savedRef[1];

      var widgetRef = React.useRef(null);
      var posRef = React.useRef(null);
      var homeRef = React.useRef(null);
      var dragRef = React.useRef(null);
      var posState = React.useState(null);
      var pos = posState[0], setPos = posState[1];
      var dragState = React.useState(false);
      var dragging = dragState[0], setDragging = dragState[1];
      var homeState = React.useState(null);
      var home = homeState[0], setHome = homeState[1];

      var timerRef = React.useRef(null);

      function applyPosition(next) {
        posRef.current = next;
        setPos(next);
      }

      function measureHome() {
        var el = widgetRef.current;
        var container = el && (el.offsetParent || el.parentElement);
        if (!el || !container) return;
        var nextHome = {
          left: container.clientWidth - el.offsetWidth - HOME_MARGIN,
          top: Math.max(HOME_MARGIN, container.clientHeight - el.offsetHeight - 30),
          width: el.offsetWidth,
          height: el.offsetHeight
        };
        var prevHome = homeRef.current;
        var current = posRef.current;
        var wasHome = !current || !prevHome
          || (Math.abs(current.left - prevHome.left) < 1 && Math.abs(current.top - prevHome.top) < 1);
        homeRef.current = nextHome;
        setHome(nextHome);
        if (wasHome) applyPosition({ left: nextHome.left, top: nextHome.top });
      }

      React.useEffect(function () {
        measureHome();
        var onResize = function () { measureHome(); };
        window.addEventListener('resize', onResize);
        return function () { window.removeEventListener('resize', onResize); };
      }, []);

      React.useEffect(function () { measureHome(); }, [balance.status, settingsOpen, collapsed, currency]);

      React.useEffect(function () {
        var savedPos = readJson(K.pos);
        if (savedPos && isFinite(savedPos.left) && isFinite(savedPos.top)) {
          posRef.current = { left: savedPos.left, top: savedPos.top };
          setPos({ left: savedPos.left, top: savedPos.top });
        }
        if (storageGet(K.collapsed) === '1') setCollapsed(true);
      }, []);

      React.useEffect(function () { storageSet(K.lang, lang); }, [lang]);
      React.useEffect(function () { storageSet(K.currency, currency); }, [currency]);
      React.useEffect(function () { storageSet(K.provider, provider); }, [provider]);
      React.useEffect(function () { storageSet(K.collapsed, collapsed ? '1' : '0'); }, [collapsed]);
      React.useEffect(function () { storageSet(K.inputs, JSON.stringify(inputs)); }, [inputs]);

      React.useEffect(function () {
        // Drop the pre-1.3 cache shape: it only carried USD and CNY.
        storageRemove('llm-balance.rates');
        storageRemove('llm-balance.ratesAt');
        var cached = readJson(K.rates);
        var at = Number(storageGet(K.ratesAt));
        var complete = hasRates(cached);
        var fresh = complete && isFinite(at) && at > 0 && Date.now() - at < RATES_TTL;
        if (complete) setRates(cached);
        if (!fresh) fetchRates().then(function (next) { if (next) setRates(next); });
      }, []);

      React.useEffect(function () {
        var timer = setInterval(function () {
          var at = Number(storageGet(K.ratesAt));
          if (!isFinite(at) || at <= 0 || Date.now() - at > RATES_TTL) {
            fetchRates().then(function (next) { if (next) setRates(next); });
          }
        }, 10 * 60 * 1000);
        return function () { clearInterval(timer); };
      }, []);

      React.useEffect(function () {
        if (currency !== 'USD' && currency !== 'CNY') { setBank({ status: 'idle' }); return; }
        var stopped = false;
        setBank({ status: 'loading' });
        fetch(absUrl(BANK_URL + '?base=' + currency.toLowerCase()), { cache: 'no-store' })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (body) {
            if (stopped) return;
            if (body && body.ok && body.base === currency && body.rates) {
              setBank({ status: 'ready', base: body.base, date: body.date, rates: body.rates, source: body.source });
            } else {
              setBank({ status: 'unavailable' });
            }
          })
          .catch(function () { if (!stopped) setBank({ status: 'unavailable' }); });
        return function () { stopped = true; };
      }, [currency]);

      function refresh(providerArg, keyArg) {
        var useProvider = providerArg || provider;
        var useKey = keyArg != null ? keyArg : apiKey;
        if (!useKey) { setBalance({ status: 'no-key' }); return; }
        setBalance({ status: 'loading' });
        fetchBalance(useProvider, useKey).then(function (result) {
          setBalance(result.status === 'ready'
            ? { status: 'ready', data: result.data, at: Date.now() }
            : result);
        });
      }

      React.useEffect(function () {
        refresh(provider, apiKey);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(function () { refresh(provider, apiKey); }, REFRESH_MS);
        return function () { if (timerRef.current) clearInterval(timerRef.current); };
      }, [provider, apiKey]);

      function switchProvider(next) {
        setProvider(next);
        setApiKey(storageGet(K.keyPrefix + next) || '');
        setDraftKey('');
        setSettingsOpen(true);
      }

      function saveKey() {
        var value = draftKey.trim();
        if (!value) return;
        if (!/^sk-[A-Za-z0-9_-]{8,}$/.test(value)) {
          setKeyError(t(lang).keyFormat);
          return;
        }
        setKeyError(null);
        storageSet(K.keyPrefix + provider, value);
        setApiKey(value);
        setDraftKey('');
        setSaved(true);
        setTimeout(function () { setSaved(false); }, 1500);
        refresh(provider, value);
      }

      function clearKey() {
        storageRemove(K.keyPrefix + provider);
        setApiKey('');
        setDraftKey('');
        setBalance({ status: 'no-key' });
      }

      /** Open the provider page through the host first: it can raise the browser
       *  window, a plain link only opens a background tab. */
      function openKeys(url) {
        var fallback = function () {
          try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { /* ignore */ }
        };
        try {
          fetch(absUrl('/llm-balance/open?url=' + encodeURIComponent(url)), { method: 'POST' })
            .then(function (res) {
              if (!res.ok) fallback();
            }).catch(fallback);
        } catch (e) { fallback(); }
      }

      function setInput(code, value) {
        setInputs(function (prev) {
          var next = {};
          for (var key in prev) next[key] = prev[key];
          next[code] = value;
          return next;
        });
      }
      function flashCopied(key) {
        setCopied(key);
        setTimeout(function () { setCopied(function (current) { return current === key ? null : current; }); }, 1200);
      }

      function onPointerDown(event) {
        if (event.button !== 0) return;
        var target = event.target;
        if (target && target.closest && target.closest('input, button, textarea, select, a')) return;
        var el = widgetRef.current;
        if (!el) return;
        var container = el.offsetParent || el.parentElement;
        if (!container) return;
        event.preventDefault();
        var rect = el.getBoundingClientRect();
        var containerRect = container.getBoundingClientRect();
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          origLeft: rect.left - containerRect.left,
          origTop: rect.top - containerRect.top,
        };
        setDragging(true);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      }
      function onPointerMove(event) {
        var d = dragRef.current;
        var el = widgetRef.current;
        if (!d || !el) return;
        var container = el.offsetParent || el.parentElement;
        if (!container) return;
        var left = d.origLeft + (event.clientX - d.startX);
        var top = d.origTop + (event.clientY - d.startY);
        left = Math.max(0, Math.min(left, container.clientWidth - el.offsetWidth));
        top = Math.max(0, Math.min(top, container.clientHeight - el.offsetHeight));
        applyPosition({ left: left, top: top });
      }
      function onPointerUp() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        setDragging(false);
        dragRef.current = null;
        var current = posRef.current;
        var h0 = homeRef.current;
        if (current && h0) {
          var near = Math.abs(current.left - h0.left) <= SNAP_THRESHOLD
            && Math.abs(current.top - h0.top) <= SNAP_THRESHOLD;
          if (near) {
            applyPosition({ left: h0.left, top: h0.top });
            storageRemove(K.pos);
            return;
          }
        }
        storageSet(K.pos, JSON.stringify(posRef.current));
      }
      React.useEffect(function () {
        return function () {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
        };
      }, []);

      var text = t(lang);
      var providerMeta = PROVIDERS[0];
      for (var p = 0; p < PROVIDERS.length; p++) {
        if (PROVIDERS[p].id === provider) { providerMeta = PROVIDERS[p]; break; }
      }

      var usd = null;
      if (balance.status === 'ready' && balance.data) {
        usd = toUsd(balance.data, rates);
      }
      var shown = fromUsd(usd, currency, rates);
      // Native bank data is used only while it is reasonably fresh; otherwise
      // the converter falls back to the CBR cross-rate.
      var bankFresh = bank.status === 'ready' && bank.base === currency && !!bank.date
        && Math.abs(Date.now() - Date.parse(bank.date)) < 7 * 864e5;
      function bankRate(code) {
        return bankFresh && bank.rates && typeof bank.rates[code] === 'number' ? bank.rates[code] : null;
      }
      var nativeCode = balance.data ? balance.data.currency : null;
      var nativeAmount = balance.data ? balance.data.amount : null;
      var tokens = provider === 'deepseek' && usd != null ? usd / DEEPSEEK_PRICE * 1e6 : null;
      // DeepSeek accounts always show an estimate; "—" means the balance is
      // known but the rate is not available yet.
      var tokensText = balance.status === 'ready' && provider === 'deepseek'
        ? (fmtTokens(tokens, lang) || '—')
        : null;

      var amountText;
      if (balance.status === 'ready') amountText = fmtMoney(shown, currency, lang);
      else if (balance.status === 'unauthorized') amountText = text.unauthorized;
      else if (balance.status === 'error' || balance.status === 'empty') amountText = text.error;
      else if (balance.status === 'loading') amountText = text.loading;
      else amountText = text.addKey;

      var metaText = providerMeta.label;
      if (balance.status === 'ready' && balance.at) metaText += ' · ' + text.updated + ' ' + fmtClock(balance.at, lang);
      if (bankFresh && bank.date) {
        metaText += ' · ' + (bank.source === 'fed' ? text.fed : text.pboc) + ' ' + fmtDay(bank.date, lang);
      } else if (rates && rates.date) {
        metaText += ' · ' + text.cbr + ' ' + fmtDay(rates.date, lang);
      }

      var children = [];

      function gearButton(small) {
        var style = {};
        for (var key in styles.gearBtn) style[key] = styles.gearBtn[key];
        if (small) {
          style.width = 24;
          style.height = 24;
          style.fontSize = 14;
          style.borderRadius = 7;
        }
        return h('button', {
          key: 'gear', type: 'button', style: style,
          title: text.settings, 'aria-label': text.settings,
          onPointerDown: function (e) { e.stopPropagation(); },
          onClick: function (e) { e.stopPropagation(); setSettingsOpen(!settingsOpen); },
        }, '⚙');
      }
      function collapseButton(small) {
        var style = {};
        for (var key in styles.iconBtn) style[key] = styles.iconBtn[key];
        if (!small) {
          style.width = 30;
          style.height = 30;
          style.fontSize = 18;
          style.lineHeight = '18px';
          style.border = '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.45))';
          style.borderRadius = 9;
        }
        style.display = 'flex';
        style.alignItems = 'center';
        style.justifyContent = 'center';
        return h('button', {
          key: 'collapse', type: 'button', style: style,
          title: collapsed ? text.expand : text.collapse,
          'aria-label': collapsed ? text.expand : text.collapse,
          onPointerDown: function (e) { e.stopPropagation(); },
          onClick: function (e) { e.stopPropagation(); setCollapsed(!collapsed); },
        }, collapsed ? trendIcon(true, '', 'currentColor') : '−');
      }

      if (collapsed) {
        children.push(h('div', { key: 'small', style: styles.smallRow }, [
          h('span', { key: 'l', style: styles.balanceLabel }, text.balance),
          h('span', { key: 'a', style: styles.smallAmount },
            balance.status === 'ready' ? fmtMoney(shown, currency, lang) : '—'),
          tokensText != null ? h('span', { key: 'k', style: styles.smallTokens }, '≈' + tokensText) : null,
          h('span', { key: 'sp', style: { flex: '1 1 auto' } }),
          gearButton(true),
          collapseButton(true),
        ]));
      } else {
        children.push(h('div', { key: 'meta', style: styles.meta }, metaText));
      }

      if (!collapsed && rates) {
        var table = [];
        var units = CURRENCIES
          .concat([{ code: 'RUB', symbol: '₽', label: '₽ RUB', decimals: 2 }])
          .filter(function (item) { return item.code !== currency; });
        for (var ci = 0; ci < units.length; ci++) {
          (function (cur) {
            var nativeRate = bankRate(cur.code);
            var multiplier = nativeRate != null ? nativeRate : factorTo(cur.code, currency, rates);
            var amount = toNumber(inputs[cur.code]);
            var value = multiplier != null && amount != null ? amount * multiplier : null;
            var move = (cur.code === 'RUB' || nativeRate != null)
              ? null
              : (rates.change ? rates.change[cur.code.toLowerCase()] : null);
            table.push(h('div', { key: 'row-' + cur.code, style: styles.row }, [
              h('span', { key: 'c', style: styles.code }, cur.label),
              h('input', {
                key: 'in', type: 'text', inputMode: 'decimal',
                value: inputs[cur.code],
                style: styles.input,
                onPointerDown: function (e) { e.stopPropagation(); },
                onChange: function (e) { setInput(cur.code, e.target.value); },
                'aria-label': cur.label,
              }),
              h('span', {
                key: 'r', style: styles.result, title: text.copy,
                onClick: function () { if (copyInteger(value)) flashCopied('r-' + cur.code); },
              }, fmtMoney(value, currency, lang),
                copied === 'r-' + cur.code ? h('span', { key: 'ok', style: styles.saved }, '✓') : null),
            ]));
            table.push(h('div', { key: 'sub-' + cur.code, style: styles.sub }, [
              multiplier != null ? '1 ' + cur.symbol + ' = ' + fmtMoney(multiplier, currency, lang) : '—',
              move != null && Math.abs(move) > 0.0005
                ? h('span', {
                  key: 'chg',
                  style: { marginLeft: 6, color: move > 0 ? '#2e9e5b' : '#d9534f' },
                }, (move > 0 ? '↑ +' : '↓ −') + Math.abs(move * 100).toFixed(2) + '%')
                : null,
            ]));
          })(units[ci]);
        }
        children.push(h('div', { key: 'rates', style: styles.rateTable }, table));
      }

      if (!collapsed) {
        children.push(h('div', {
          key: 'big',
          style: styles.balanceRow,
          onPointerDown: function (e) { e.stopPropagation(); },
        }, [
          h('span', { key: 'l', style: styles.balanceLabel }, text.balance),
          h('span', {
            key: 'a',
            style: styles.amount,
            title: balance.status === 'ready' ? text.refresh : text.addKey,
            onClick: function () { if (balance.status !== 'ready') setSettingsOpen(true); },
          }, amountText),
          tokensText != null ? h('span', { key: 'k', style: styles.tokens, title: text.tokensHint },
            '≈ ' + tokensText + ' ' + text.tokens) : null,
          h('span', { key: 'sp', style: { flex: '1 1 auto' } }),
          gearButton(false),
          collapseButton(false),
        ]));
        if (balance.status === 'ready' && nativeCode && nativeAmount != null && nativeCode !== currency) {
          children.push(h('div', { key: 'native', style: styles.secondary },
            text.native + ': ' + fmtMoney(nativeAmount, nativeCode, lang)));
        }
      }

      if (settingsOpen) {
        var options = PROVIDERS.map(function (item) {
          return h('option', { key: item.id, value: item.id }, item.label);
        });
        children.push(h('div', { key: 'panel', style: styles.panel }, [
          h('div', { key: 'p', style: styles.field }, [
            h('span', { key: 'l', style: styles.fieldLabel }, text.provider),
            h('select', {
              key: 'sel', style: styles.select, value: provider,
              onChange: function (e) { switchProvider(e.target.value); },
            }, options),
          ]),
          h('div', { key: 'k', style: styles.field }, [
            h('span', { key: 'l', style: styles.fieldLabel }, text.apiKey),
            h('input', {
              key: 'in', type: 'password', style: styles.input,
              value: draftKey,
              placeholder: apiKey ? '••••••••' : text.keyPlaceholder,
              onChange: function (e) { setDraftKey(e.target.value); setKeyError(null); },
              onKeyDown: function (e) { if (e.key === 'Enter') saveKey(); },
            }),
            h('button', { key: 's', type: 'button', style: styles.smallBtn, onClick: saveKey }, text.save),
          ]),
          keyError ? h('div', { key: 'kerr', style: styles.error }, keyError) : null,
          h('div', { key: 'kh', style: styles.hintRow }, [
            h('a', {
              key: 'link',
              href: providerMeta.keysUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: styles.link,
              onPointerDown: function (e) { e.stopPropagation(); },
              onClick: function (e) {
                e.preventDefault();
                e.stopPropagation();
                openKeys(providerMeta.keysUrl);
              },
            }, text.getKey),
            saved ? h('span', { key: 'ok', style: styles.saved }, '✓ ' + text.keySaved) : null,
            apiKey ? h('button', {
              key: 'clear', type: 'button', style: styles.linkBtn,
              onPointerDown: function (e) { e.stopPropagation(); },
              onClick: clearKey,
            }, text.clear) : null,
          ]),
          h('div', { key: 'lang', style: styles.field }, [
            h('span', { key: 'l', style: styles.fieldLabel }, text.language),
            h('span', { key: 'b', style: { display: 'flex', gap: 4 } }, [
              h('button', {
                key: 'en', type: 'button', style: lang === 'en' ? styles.smallBtnActive : styles.smallBtn,
                onClick: function () { setLang('en'); },
              }, 'EN'),
              h('button', {
                key: 'ru', type: 'button', style: lang === 'ru' ? styles.smallBtnActive : styles.smallBtn,
                onClick: function () { setLang('ru'); },
              }, 'RU'),
              h('button', {
                key: 'zh', type: 'button', style: lang === 'zh' ? styles.smallBtnActive : styles.smallBtn,
                onClick: function () { setLang('zh'); },
              }, '中文'),
            ]),
          ]),
          h('div', { key: 'cur', style: styles.field }, [
            h('span', { key: 'l', style: styles.fieldLabel }, text.currency),
            h('span', { key: 'b', style: { display: 'flex', gap: 4 } }, [
              h('button', {
                key: 'usd', type: 'button', style: currency === 'USD' ? styles.smallBtnActive : styles.smallBtn,
                onClick: function () { setCurrency('USD'); },
              }, '$ USD'),
              h('button', {
                key: 'rub', type: 'button', style: currency === 'RUB' ? styles.smallBtnActive : styles.smallBtn,
                onClick: function () { setCurrency('RUB'); },
              }, '₽ RUB'),
              h('button', {
                key: 'cny', type: 'button', style: currency === 'CNY' ? styles.smallBtnActive : styles.smallBtn,
                onClick: function () { setCurrency('CNY'); },
              }, '¥ CNY'),
            ]),
          ]),
        ]));
      }

      var widgetStyle = {};
      for (var sk in styles.widget) widgetStyle[sk] = styles.widget[sk];
      if (pos) {
        widgetStyle.right = 'auto';
        widgetStyle.bottom = 'auto';
        widgetStyle.left = pos.left + 'px';
        widgetStyle.top = pos.top + 'px';
      }
      // Fixed width: switching currency must not resize the widget.
      widgetStyle.width = '330px';
      widgetStyle.minWidth = '330px';
      widgetStyle.maxWidth = '330px';
      widgetStyle.boxSizing = 'border-box';
      if (collapsed) {
        widgetStyle.justifyContent = 'center';
        widgetStyle.padding = '10px 18px';
      }
      widgetStyle.cursor = dragging ? 'grabbing' : 'grab';
      if (!dragging) widgetStyle.transition = 'left 160ms ease, top 160ms ease';

      var atHome = false;
      if (pos && home) {
        atHome = Math.abs(pos.left - home.left) < 1 && Math.abs(pos.top - home.top) < 1;
      }
      var showMarker = !!home && (dragging || !atHome);

      return h(React.Fragment, null,
        showMarker ? h('div', {
          key: 'home-marker',
          style: {
            position: 'absolute',
            left: home.left + 'px',
            top: home.top + 'px',
            width: home.width + 'px',
            height: home.height + 'px',
            borderRadius: 'var(--dsw-radius-xl, 12px)',
            border: '1.5px dashed rgba(140,140,140,0.55)',
            pointerEvents: 'none',
            zIndex: 9998,
            boxSizing: 'border-box',
          },
        }) : null,
        h('div', {
          key: 'widget',
          ref: widgetRef,
          style: widgetStyle,
          onPointerDown: onPointerDown,
        }, children)
      );
    }

    return {
      inject: ['slots'],
      // Exposed for unit tests only; the host ignores unknown keys.
      _test: {
        parseRates: parseRates,
        parseDeepSeek: parseDeepSeek,
        parseOpenRouter: parseOpenRouter,
        toUsd: toUsd,
        hasRates: hasRates,
        factorTo: factorTo,
        fromUsd: fromUsd,
        fmtTokens: fmtTokens
      },
      apply: function (ctx) {
        try {
          ctx.slots.inject('shell.overlay', function () {
            ctx.slots.register({ name: 'shell.overlay', id: 'llm-balance', order: 100, label: 'LLM balance' }, BalanceWidget);
          });
        } catch (e) { /* leave the slot unoccupied */ }
      },
    };
  },
});
