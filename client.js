window.__ModuleLoader__.load({
  id: '@local/llm-balance-widget',
  factory(require) {
    var React;
    try { React = require('react'); } catch (e) { return { inject: ['slots'], apply() {} }; }
    var h = React.createElement;

    var DEEPSEEK_URL = 'https://api.deepseek.com/user/balance';
    var OPENROUTER_URL = 'https://openrouter.ai/api/v1/credits';
    var RATES_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';

    // USD per 1M input tokens, cache miss (DeepSeek V3.2 pricing).
    var DEEPSEEK_PRICE = 0.28;

    var REFRESH_MS = 60000;
    var RETRY_MS = 20000;
    var RATES_TTL = 6 * 60 * 60 * 1000;

    var K = {
      lang: 'llm-balance.lang',
      currency: 'llm-balance.currency',
      provider: 'llm-balance.provider',
      pos: 'llm-balance.pos',
      collapsed: 'llm-balance.collapsed',
      rates: 'llm-balance.rates',
      ratesAt: 'llm-balance.ratesAt',
      keyPrefix: 'llm-balance.key.'
    };

    var PROVIDERS = [
      { id: 'deepseek', label: 'DeepSeek', hint: 'sk-…', keysUrl: 'https://platform.deepseek.com/api_keys' },
      { id: 'openrouter', label: 'OpenRouter', hint: 'sk-or-…', keysUrl: 'https://openrouter.ai/keys' }
    ];

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
        keyPlaceholder: 'paste your key',
        getKey: 'get a key',
        keySaved: 'key saved',
        refresh: 'refresh'
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
        keyPlaceholder: 'вставьте ключ',
        getKey: 'получить ключ',
        keySaved: 'ключ сохранён',
        refresh: 'обновить'
      }
    };

    function t(lang) { return TEXT[lang === 'ru' ? 'ru' : 'en']; }
    function locale(lang) { return lang === 'ru' ? 'ru-RU' : 'en-US'; }

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
          style: 'currency', currency: code,
          minimumFractionDigits: 2, maximumFractionDigits: 2
        }).format(value);
      } catch (e) { return value.toFixed(2) + ' ' + code; }
    }
    function fmtTokens(value, lang) {
      if (value == null || !isFinite(value) || value <= 0) return null;
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

    /** Parse CBR daily rates into RUB per unit for USD and CNY. */
    function parseRates(body) {
      var valute = body && body.Valute;
      if (!valute) return null;
      function rubPer(code) {
        var entry = valute[code];
        if (!entry || !entry.Nominal) return null;
        return entry.Value / entry.Nominal;
      }
      var usd = rubPer('USD');
      var cny = rubPer('CNY');
      if (usd == null) return null;
      return { usd: usd, cny: cny, date: body.Date || null };
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
        fontSize: 12, lineHeight: '17px', maxWidth: 300,
        pointerEvents: 'auto', userSelect: 'none', zIndex: 9999,
        cursor: 'grab',
      },
      headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      header: { fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)', cursor: 'inherit' },
      iconBtn: {
        border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-tertiary, #aaaaaa)',
        cursor: 'pointer', fontSize: 14, lineHeight: '14px', padding: '0 3px', fontFamily: 'inherit',
      },
      meta: { fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' },
      bigRow: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
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
      saved: { fontSize: 10.5, color: '#2e9e5b' },
    };

    function BalanceWidget() {
      var langRef = React.useState(function () { return readChoice(K.lang, ['en', 'ru'], 'en'); });
      var lang = langRef[0], setLang = langRef[1];

      var currencyRef = React.useState(function () { return readChoice(K.currency, ['USD', 'RUB'], 'USD'); });
      var currency = currencyRef[0], setCurrency = currencyRef[1];

      var providerRef = React.useState(function () { return readChoice(K.provider, ['deepseek', 'openrouter'], 'deepseek'); });
      var provider = providerRef[0], setProvider = providerRef[1];

      var keyRef = React.useState(function () { return storageGet(K.keyPrefix + readChoice(K.provider, ['deepseek', 'openrouter'], 'deepseek')) || ''; });
      var apiKey = keyRef[0], setApiKey = keyRef[1];

      var draftRef = React.useState('');
      var draftKey = draftRef[0], setDraftKey = draftRef[1];

      var balanceRef = React.useState({ status: 'idle' });
      var balance = balanceRef[0], setBalance = balanceRef[1];

      var ratesRef = React.useState(null);
      var rates = ratesRef[0], setRates = ratesRef[1];

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

      React.useEffect(function () {
        var cached = readJson(K.rates);
        if (cached && cached.usd) setRates(cached);
        var at = Number(storageGet(K.ratesAt));
        if (!cached || !isFinite(at) || Date.now() - at > RATES_TTL) {
          fetchRates().then(function (next) { if (next) setRates(next); });
        }
      }, []);

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
      var rub = usd != null && rates && rates.usd ? usd * rates.usd : null;
      var shown = currency === 'RUB' ? rub : usd;
      var other = currency === 'RUB' ? usd : rub;
      var otherCode = currency === 'RUB' ? 'USD' : 'RUB';
      var tokens = provider === 'deepseek' && usd != null ? usd / DEEPSEEK_PRICE * 1e6 : null;

      var amountText;
      if (balance.status === 'ready') amountText = fmtMoney(shown, currency, lang);
      else if (balance.status === 'unauthorized') amountText = text.unauthorized;
      else if (balance.status === 'error' || balance.status === 'empty') amountText = text.error;
      else if (balance.status === 'loading') amountText = text.loading;
      else amountText = text.addKey;

      var metaText = providerMeta.label;
      if (balance.status === 'ready' && balance.at) metaText += ' · ' + text.updated + ' ' + fmtClock(balance.at, lang);

      var children = [];
      children.push(h('div', { key: 'hdr', style: styles.headerRow }, [
        h('span', { key: 't', style: styles.header }, text.balance),
        h('span', { key: 'btns', style: { display: 'flex', gap: 2 } }, [
          h('button', {
            key: 'gear', type: 'button', style: styles.iconBtn,
            title: text.settings, 'aria-label': text.settings,
            onClick: function () { setSettingsOpen(!settingsOpen); },
          }, '⚙'),
          h('button', {
            key: 'collapse', type: 'button', style: styles.iconBtn,
            title: collapsed ? text.expand : text.collapse,
            'aria-label': collapsed ? text.expand : text.collapse,
            onClick: function () { setCollapsed(!collapsed); },
          }, collapsed ? '+' : '−'),
        ]),
      ]));

      if (!collapsed) {
        children.push(h('div', { key: 'meta', style: styles.meta }, metaText));
        children.push(h('div', {
          key: 'big',
          style: styles.bigRow,
          onClick: function () { if (balance.status !== 'ready') setSettingsOpen(true); },
        }, [
          h('span', {
            key: 'a',
            style: styles.amount,
            title: balance.status === 'ready' ? text.refresh : text.addKey,
          }, amountText),
          tokens != null ? h('span', { key: 'k', style: styles.tokens, title: text.tokensHint },
            '≈ ' + fmtTokens(tokens, lang) + ' ' + text.tokens) : null,
        ]));
        if (balance.status === 'ready' && other != null && otherCode !== currency) {
          children.push(h('div', { key: 'sec', style: styles.secondary }, fmtMoney(other, otherCode, lang)));
        }
      } else {
        children.push(h('div', { key: 'small', style: styles.bigRow }, [
          h('span', { key: 'a', style: { fontSize: 14, fontWeight: 700 } },
            balance.status === 'ready' ? fmtMoney(shown, currency, lang) : '—'),
          tokens != null ? h('span', { key: 'k', style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #aaaaaa)' } },
            '≈' + fmtTokens(tokens, lang)) : null,
        ]));
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
              onChange: function (e) { setDraftKey(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter') saveKey(); },
            }),
            h('button', { key: 's', type: 'button', style: styles.smallBtn, onClick: saveKey }, text.save),
          ]),
          h('div', { key: 'kh', style: styles.hintRow }, [
            h('span', {
              key: 'link', style: styles.link,
              onClick: function () { try { window.open(providerMeta.keysUrl, '_blank'); } catch (e) { /* ignore */ } },
            }, text.getKey),
            saved ? h('span', { key: 'ok', style: styles.saved }, '✓ ' + text.keySaved) : null,
            apiKey ? h('span', {
              key: 'clear', style: styles.link,
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
      widgetStyle.minWidth = '240px';
      if (collapsed) {
        widgetStyle.boxSizing = 'border-box';
        widgetStyle.justifyContent = 'center';
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
