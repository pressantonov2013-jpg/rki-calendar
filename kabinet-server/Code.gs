/**
 * Календарь РКИ · серверная часть личного кабинета (Google Apps Script).
 * Таблица = база данных. Инструкция по запуску: ИНСТРУКЦИЯ.md.
 */
var BASE_URL = 'https://calendar.rki.center/kabinet/';
var FROM_EMAIL = 'hello@rki.center';   // должен быть добавлен в Gmail как «Отправлять письма как»
var SENDER_NAME = 'Календарь РКИ';
var TZ = 'Europe/Moscow';

var SH = { ppl: 'Люди', prog: 'Прогресс', q: 'Вопросы', cfg: 'События', stat: 'Сводка', log: 'Журнал' };
var HEAD = {
  ppl:  ['Почта', 'Имя', 'Токен', 'Источник', 'Согласие на рассылку', 'Создан', 'Личная ссылка', 'Последний вход'],
  prog: ['Почта', 'Событие', 'Запись', 'Запись выдана', 'Баллы', 'Вопросов', 'Тест пройден', 'Имя в сертификате', 'Сертификат', 'Сертификат выдан', 'Реакция (запись)', 'Реакция (сертификат)', 'Стикеры', 'Отзыв', 'Открыл кабинет', 'Обновлено'],
  q:    ['ID', 'Время', 'Почта', 'Имя', 'Событие', 'Шаг', 'Вопрос', 'Ответ', 'Время ответа', 'Telegram message_id'],
  cfg:  ['ID события', 'Название', 'Запись выдавать сразу (ДА/НЕТ)', 'Сертификат выдавать сразу (ДА/НЕТ)'],
  log:  ['Время', 'Событие']
};
var P = { email: 0, ev: 1, mat: 2, matAt: 3, score: 4, total: 5, passed: 6, certName: 7, cert: 8, certAt: 9, hMat: 10, hCert: 11, tags: 12, review: 13, opened: 14, upd: 15 };
var ISSUED = 'выдано', WAIT = 'ждёт', YES = 'да';

/* ---------- первичная настройка (запускается один раз) ---------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['ppl', 'prog', 'q', 'cfg', 'log'].forEach(function (k) {
    var s = ss.getSheetByName(SH[k]) || ss.insertSheet(SH[k]);
    if (s.getLastRow() === 0) { s.appendRow(HEAD[k]); }
  });
  var cfg = ss.getSheetByName(SH.cfg);
  if (cfg.getLastRow() < 2) {
    cfg.appendRow(['mult', 'Мир мультфильмов', 'ДА', 'ДА']);
    cfg.appendRow(['mozg', 'Мозг, эмоции, мотивация', 'ДА', 'ДА']);
  }
  var st = ss.getSheetByName(SH.stat) || ss.insertSheet(SH.stat);
  st.clear();
  st.appendRow(['Мастер-класс', 'Людей в базе', 'Открыли кабинет', 'Получили запись', 'Ждут запись', 'Прошли тест', 'Получили сертификат', 'Ждут сертификат', 'Оставили реакцию', 'Оставили отзыв']);
  for (var r = 2; r <= 12; r++) {
    var id = SH.cfg + '!A' + r, e = 'IF(' + id + '="","",';
    fml_(st, r, 1, '=' + e + SH.cfg + '!B' + r + ')');
    fml_(st, r, 2, '=' + e + 'COUNTA(' + SH.ppl + '!A2:A))');
    var cnt = function (extra) { return '=' + e + 'COUNTIFS(' + SH.prog + '!B2:B,' + id + extra + '))'; };
    fml_(st, r, 3, cnt(',' + SH.prog + '!O2:O,"<>"'));
    fml_(st, r, 4, cnt(',' + SH.prog + '!C2:C,"' + ISSUED + '"'));
    fml_(st, r, 5, cnt(',' + SH.prog + '!C2:C,"' + WAIT + '"'));
    fml_(st, r, 6, cnt(',' + SH.prog + '!G2:G,"' + YES + '"'));
    fml_(st, r, 7, cnt(',' + SH.prog + '!I2:I,"' + ISSUED + '"'));
    fml_(st, r, 8, cnt(',' + SH.prog + '!G2:G,"' + YES + '",' + SH.prog + '!I2:I,"<>' + ISSUED + '"'));
    fml_(st, r, 9, cnt(',' + SH.prog + '!K2:K,"<>"'));
    fml_(st, r, 10, cnt(',' + SH.prog + '!N2:N,"<>"'));
  }
  log_('Таблица настроена');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Календарь РКИ')
    .addItem('Создать личные ссылки для новых людей', 'makeTokens')
    .addItem('Выдать всё, что ждёт (запись и сертификаты)', 'approvePending')
    .addToUi();
}

/** Каждому человеку в листе «Люди» без токена создаёт личный токен и ссылку (колонка G — для Unisender). */
function makeTokens() {
  var s = sheet_('ppl'), v = s.getDataRange().getValues(), n = 0;
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    if (!v[i][2]) { s.getRange(i + 1, 3).setValue(token_()); n++; }
    fml_(s, i + 1, 7, '=IF(C' + (i + 1) + '="","","' + BASE_URL + '?t="&C' + (i + 1) + ')');
    if (!v[i][5]) s.getRange(i + 1, 6).setValue(now_());
    if (!v[i][3]) s.getRange(i + 1, 4).setValue('рассылка');
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('Новых ссылок: ' + n);
}

/** Для ручного режима: выдаёт всем запрошенное и пишет им письмо. */
function approvePending() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var s = sheet_('prog'), v = s.getDataRange().getValues(), n = 0;
    for (var i = 1; i < v.length; i++) {
      var ch = false;
      if (v[i][P.mat] === WAIT) { s.getRange(i + 1, P.mat + 1).setValue(ISSUED); s.getRange(i + 1, P.matAt + 1).setValue(now_()); ch = true; }
      if (v[i][P.cert] === WAIT) { s.getRange(i + 1, P.cert + 1).setValue(ISSUED); s.getRange(i + 1, P.certAt + 1).setValue(now_()); ch = true; }
      if (ch) { n++; var pe = person_(v[i][P.email]); if (pe) mailReady_(pe, v[i][P.ev]); }
    }
    SpreadsheetApp.getActiveSpreadsheet().toast('Выдано: ' + n);
  } finally { lock.releaseLock(); }
}

/** Запустите один раз после того, как в свойствах скрипта указаны TG_TOKEN и WEB_URL. */
function setWebhook() {
  var p = PropertiesService.getScriptProperties();
  p.setProperty('WEB_URL', 'https://script.google.com/macros/s/AKfycbzjj6wzDH8pBxqk79CCeviDMV7Wlvgetbm_34ESymipEnHwTmmY-zjDW2ugHji5vueb/exec');
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + p.getProperty('TG_TOKEN') + '/setWebhook?url=' + encodeURIComponent(p.getProperty('WEB_URL')));
  Logger.log(r.getContentText());
}

/* ---------- входящие запросы ---------- */
function doGet() { return json_({ ok: true, name: 'rki-kabinet' }); }

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, err: 'Некорректный запрос' }); }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    if (body.update_id !== undefined) { tgUpdate_(body); return json_({ ok: true }); }
    return json_(route_(body));
  } catch (err) {
    log_('ОШИБКА: ' + err);
    return json_({ ok: false, err: 'Ошибка сервера. Попробуйте ещё раз.' });
  } finally { try { lock.releaseLock(); } catch (x) {} }
}

function route_(b) {
  switch (b.a) {
    case 'link': return actLink_(b);
    case 'request': return actRequest_(b);
  }
  var me = byToken_(b.t);
  if (!me) return { ok: false, err: 'auth' };
  var ids = evIds_();
  if (b.a === 'me') { touch_(me, ids); return state_(me); }
  if (ids.indexOf(b.ev) < 0 && b.a !== 'me') return { ok: false, err: 'Неизвестное событие' };
  var row = ensureProg_(me.email, b.ev), s = sheet_('prog'), cfg = evCfg_(b.ev), nm = me.name || me.email;
  var cur = s.getRange(row, 1, 1, HEAD.prog.length).getValues()[0];
  function set(col, val) { s.getRange(row, col + 1).setValue(val); cur[col] = val; }
  set(P.upd, now_());
  if (b.a === 'mat') {
    if (!cur[P.mat]) {
      var auto = cfg.autoMat; set(P.mat, auto ? ISSUED : WAIT); if (auto) set(P.matAt, now_());
      tg_('🎬 ' + nm + ' запросила запись и презентацию · ' + cfg.title + (auto ? ' (выдано автоматически)' : ' — ЖДЁТ ВАС'));
    }
  } else if (b.a === 'test') {
    var sc = Math.max(0, Math.min(Number(b.score) || 0, Number(b.total) || 0)), tot = Number(b.total) || 0;
    if (tot < 1) return { ok: false, err: 'Нет вопросов' };
    var pass = sc >= Math.max(1, Math.ceil(tot * 0.6 - 1e-9)) || cur[P.passed] === YES;
    set(P.score, sc); set(P.total, tot);
    if (pass) set(P.passed, YES);
    tg_('📝 ' + nm + ' · ' + cfg.title + ': ' + sc + ' из ' + tot + (pass ? ' — тест пройден' : ' — не хватило'));
  } else if (b.a === 'cert') {
    if (cur[P.passed] !== YES) return { ok: false, err: 'Сначала нужно пройти тест' };
    var name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (name.length < 3) return { ok: false, err: 'Напишите имя полностью' };
    if (!cur[P.certName]) {
      set(P.certName, name); var a2 = cfg.autoCert; set(P.cert, a2 ? ISSUED : WAIT); if (a2) set(P.certAt, now_());
      tg_('🏆 ' + nm + ' · ' + cfg.title + ': имя в сертификате «' + name + '»' + (a2 ? ' (выдан автоматически)' : ' — ЖДЁТ ВАС'));
    }
  } else if (b.a === 'heart') {
    var em = String(b.emoji || '').slice(0, 8);
    if (b.key === 'mat' && !cur[P.hMat]) set(P.hMat, em);
    if (b.key === 'cert' && !cur[P.hCert]) set(P.hCert, em);
    tg_(em + ' ' + nm + ' · ' + cfg.title + ' (' + (b.key === 'mat' ? 'запись' : 'сертификат') + ')');
  } else if (b.a === 'review') {
    var tags = (b.tags || []).map(String).slice(0, 6).join(', '), tx = String(b.text || '').slice(0, 600);
    set(P.tags, tags); set(P.review, tx);
    tg_('💬 ' + nm + ' · ' + cfg.title + ' — отзыв: ' + (tags || '—') + (tx ? ' «' + tx + '»' : ''));
  } else if (b.a === 'ask') {
    var qt = String(b.text || '').trim().slice(0, 800);
    if (qt.length < 3) return { ok: false, err: 'Напишите вопрос' };
    var id = 'q' + new Date().getTime();
    var mid = tg_('❓ ' + nm + ' (' + me.email + ')\n' + cfg.title + ' · шаг ' + (b.step || '?') + '\n\n' + qt + '\n\n↩ Чтобы ответить, нажмите «Ответить» на это сообщение.');
    sheet_('q').appendRow([id, now_(), me.email, me.name, b.ev, b.step || '', qt, '', '', mid || '']);
  } else { return { ok: false, err: 'Неизвестное действие' }; }
  return state_(me);
}

function actLink_(b) {
  var email = norm_(b.email);
  if (!validEmail_(email)) return { ok: false, err: 'Проверьте адрес почты' };
  var cache = CacheService.getScriptCache();
  if (cache.get('l:' + email)) return { ok: true };
  cache.put('l:' + email, '1', 60);
  var p = person_(email);
  if (p) { ensureToken_(p); mailLink_(person_(email), 'login'); log_('Ссылка для входа: ' + email); }
  else { log_('Запрос ссылки, адреса нет в базе: ' + email); }
  return { ok: true };       // всегда одинаковый ответ, чтобы нельзя было узнать, есть ли адрес в базе
}

function actRequest_(b) {
  var email = norm_(b.email), name = String(b.name || '').trim().slice(0, 100);
  if (!validEmail_(email) || name.length < 2) return { ok: false, err: 'Проверьте имя и адрес почты' };
  if (!b.consent) return { ok: false, err: 'Нужно согласие на получение писем' };
  var cache = CacheService.getScriptCache();
  if (cache.get('l:' + email)) return { ok: true };
  cache.put('l:' + email, '1', 60);
  var p = person_(email);
  if (!p) {
    sheet_('ppl').appendRow([email, name, token_(), 'сайт', YES, now_(), '', '']);
    var n = sheet_('ppl').getLastRow();
    fml_(sheet_('ppl'), n, 7, '=IF(C' + n + '="","","' + BASE_URL + '?t="&C' + n + ')');
    tg_('🆕 Новая заявка с сайта: ' + name + ' · ' + email + '\nСогласие на рассылку есть. Не забудьте добавить в Unisender.');
  } else {
    ensureToken_(p);
    tg_('🌐 ' + (p.name || name) + ' (' + email + ') запросила ссылку с сайта · адрес уже в базе');
  }
  mailLink_(person_(email), 'request');
  return { ok: true };
}

/* ---------- состояние для страницы ---------- */
function state_(me) {
  var v = sheet_('prog').getDataRange().getValues(), prog = {};
  for (var i = 1; i < v.length; i++) {
    if (norm_(v[i][P.email]) !== me.email) continue;
    var r = v[i];
    prog[r[P.ev]] = {
      mat: r[P.mat] === ISSUED ? 'sent' : (r[P.mat] === WAIT ? 'req' : ''),
      test: r[P.total] ? { score: Number(r[P.score]), total: Number(r[P.total]), pass: r[P.passed] === YES } : null,
      certName: String(r[P.certName] || ''),
      cert: r[P.cert] === ISSUED ? 'sent' : (r[P.cert] === WAIT ? 'req' : ''),
      hMat: String(r[P.hMat] || ''), hCert: String(r[P.hCert] || ''),
      tags: r[P.tags] ? String(r[P.tags]).split(', ') : [], review: String(r[P.review] || '')
    };
  }
  var qv = sheet_('q').getDataRange().getValues(), qs = [];
  for (var j = 1; j < qv.length; j++) if (norm_(qv[j][2]) === me.email) qs.push({ id: qv[j][0], ev: qv[j][4], text: qv[j][6], ans: String(qv[j][7] || '') });
  return { ok: true, user: { name: me.name || me.email, email: me.email }, prog: prog, qs: qs };
}

function touch_(me, ids) {
  var s = sheet_('ppl');
  var first = !s.getRange(me.row, 8).getValue();
  s.getRange(me.row, 8).setValue(now_());
  ids.forEach(function (id) { ensureProg_(me.email, id, true); });
  if (first) tg_('👋 ' + (me.name || me.email) + ' открыл(а) кабинет (' + (me.src || 'рассылка') + ')');
}

/* ---------- Telegram ---------- */
function tg_(text) {
  var p = PropertiesService.getScriptProperties(), tok = p.getProperty('TG_TOKEN'), chat = p.getProperty('TG_CHAT');
  log_(text.replace(/\n+/g, ' '));
  if (!tok || !chat) return '';
  try {
    var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/sendMessage', { method: 'post', contentType: 'application/json', payload: JSON.stringify({ chat_id: chat, text: text }), muteHttpExceptions: true });
    var j = JSON.parse(r.getContentText());
    return j.ok ? String(j.result.message_id) : '';
  } catch (e) { return ''; }
}

function tgUpdate_(u) {
  var chat = PropertiesService.getScriptProperties().getProperty('TG_CHAT');
  var m = u.message;
  if (!m || String(m.chat.id) !== String(chat) || !m.reply_to_message || !m.text) return;
  var mid = String(m.reply_to_message.message_id), s = sheet_('q'), v = s.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][9]) === mid) {
      s.getRange(i + 1, 8).setValue(m.text); s.getRange(i + 1, 9).setValue(now_());
      var p = person_(v[i][2]);
      if (p) mailAnswer_(p, v[i][6], m.text);
      tg_('✅ Ответ отправлен: ' + (v[i][3] || v[i][2]));
      return;
    }
  }
}

/* ---------- письма ---------- */
function linkFor_(p) { return BASE_URL + '?t=' + p.token; }
function mail_(to, subject, html, plain) {
  var opt = { name: SENDER_NAME, htmlBody: html, replyTo: FROM_EMAIL };
  try { GmailApp.sendEmail(to, subject, plain, { name: SENDER_NAME, htmlBody: html, replyTo: FROM_EMAIL, from: FROM_EMAIL }); }
  catch (e) { GmailApp.sendEmail(to, subject, plain, opt); }   // если адрес-алиас не подключён — отправится с основного адреса
}
function wrap_(inner) { return '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#101014;max-width:520px">' + inner + '<p style="color:#8A8A96;font-size:13px;margin-top:28px">Календарь РКИ · calendar.rki.center<br>Вопросы: ' + FROM_EMAIL + '</p></div>'; }
function btn_(url, text) { return '<p><a href="' + url + '" style="display:inline-block;background:#4D5DFB;color:#fff;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:bold">' + text + '</a></p>'; }
function mailLink_(p, kind) {
  var url = linkFor_(p), hi = 'Здравствуйте' + (p.name ? ', ' + p.name.split(' ')[0] : '') + '!';
  var subj = kind === 'request' ? 'Ваша ссылка на запись мастер-класса' : 'Ваша ссылка для входа в личный кабинет';
  var txt = kind === 'request' ? 'Вы попросили запись мастер-класса. Запись, презентация и сертификат ждут вас в личном кабинете.' : 'Вы просили войти в личный кабинет.';
  mail_(p.email, subj, wrap_('<p>' + hi + '</p><p>' + txt + '</p>' + btn_(url, 'Открыть мой кабинет') + '<p style="color:#52525B">Ссылка личная, пароль не нужен. Не пересылайте её другим.</p>'), hi + '\n' + txt + '\n' + url);
}
function mailReady_(p, evId) {
  var t = evCfg_(evId).title, url = linkFor_(p);
  mail_(p.email, 'Готово: «' + t + '»', wrap_('<p>Здравствуйте' + (p.name ? ', ' + p.name.split(' ')[0] : '') + '!</p><p>Материалы и сертификат по мастер-классу «' + t + '» готовы.</p>' + btn_(url, 'Открыть кабинет')), 'Материалы готовы: ' + url);
}
function mailAnswer_(p, q, a) {
  mail_(p.email, 'Ответ на ваш вопрос · Календарь РКИ', wrap_('<p>Вы спрашивали: <i>' + esc_(q) + '</i></p><p><b>Ответ:</b> ' + esc_(a) + '</p>' + btn_(linkFor_(p), 'Открыть кабинет')), 'Ответ: ' + a);
}

/* ---------- помощники ---------- */
/** Записывает формулу с учётом языка таблицы: в русской локали разделитель аргументов «;», а не «,». */
function fml_(sh, r, c, f) {
  var loc = String(SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetLocale() || 'en');
  if (!/^en/i.test(loc)) f = f.replace(/,/g, ';');
  sh.getRange(r, c).setFormula(f);
}
function sheet_(k) { var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH[k]); if (!s) throw new Error('Нет листа ' + SH[k] + '. Запустите setup().'); return s; }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function norm_(e) { return String(e || '').trim().toLowerCase(); }
function validEmail_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function token_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function log_(t) { try { sheet_('log').appendRow([now_(), String(t)]); } catch (e) {} }
function evIds_() { var v = sheet_('cfg').getDataRange().getValues(), r = []; for (var i = 1; i < v.length; i++) if (v[i][0]) r.push(String(v[i][0])); return r; }
function evCfg_(id) {
  var v = sheet_('cfg').getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === id) return { title: v[i][1], autoMat: String(v[i][2]).toUpperCase() !== 'НЕТ', autoCert: String(v[i][3]).toUpperCase() !== 'НЕТ' };
  return { title: id, autoMat: true, autoCert: true };
}
function person_(email) {
  email = norm_(email); var v = sheet_('ppl').getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (norm_(v[i][0]) === email) return { row: i + 1, email: email, name: String(v[i][1] || ''), token: String(v[i][2] || ''), src: v[i][3] };
  return null;
}
function byToken_(t) {
  t = String(t || ''); if (t.length < 20) return null;
  var v = sheet_('ppl').getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][2]) === t) return { row: i + 1, email: norm_(v[i][0]), name: String(v[i][1] || ''), token: t, src: v[i][3] };
  return null;
}
function ensureToken_(p) {
  if (p.token) return; var t = token_(); sheet_('ppl').getRange(p.row, 3).setValue(t);
  fml_(sheet_('ppl'), p.row, 7, '=IF(C' + p.row + '="","","' + BASE_URL + '?t="&C' + p.row + ')');
}
/** Возвращает номер строки в «Прогресс» (создаёт, если нет). При created=true возвращает объект {row, created}. */
function ensureProg_(email, ev, wantObj) {
  var s = sheet_('prog'), v = s.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (norm_(v[i][0]) === email && v[i][1] === ev) return wantObj ? { row: i + 1, created: false } : i + 1;
  var row = new Array(HEAD.prog.length).fill(''); row[P.email] = email; row[P.ev] = ev; row[P.opened] = now_(); row[P.upd] = now_();
  s.appendRow(row);
  var n = s.getLastRow();
  return wantObj ? { row: n, created: true } : n;
}

/** Один раз: читает chat id из сообщения боту (/start) и сохраняет TG_CHAT. */
function findChatId() {
  var p = PropertiesService.getScriptProperties(), tok = p.getProperty('TG_TOKEN');
  var me = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/getMe').getContentText());
  var r = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/getUpdates').getContentText());
  var id = '';
  (r.result || []).forEach(function (u) { if (u.message && u.message.chat) id = String(u.message.chat.id); });
  if (!id) { Logger.log('Бот @' + me.result.username + ' найден, но сообщений ещё нет. Напишите ему /start.'); return; }
  p.setProperty('TG_CHAT', id);
  UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/sendMessage', { method: 'post', contentType: 'application/json', payload: JSON.stringify({ chat_id: id, text: '✅ Бот кабинета РКИ подключён. Сюда будут приходить события и вопросы участников.' }) });
  Logger.log('Готово: бот @' + me.result.username + ', chat id сохранён.');
}
