/*! ChatReport UMD bundle
 * 由 report/build.js 自动生成，请勿手改。
 * 零依赖经典脚本：浏览器 <script> 加载后挂 globalThis.ChatReport；
 * Node 中 require() 本文件后同样可用。
 */
(function (global) {
  if (typeof globalThis !== "undefined") global = globalThis;
  if (typeof global === "undefined") global = {};

/* ===== model.js ===== */
/**
 * ChatReport · model.js
 * 统一消息模型（shared/schema.md §1）的校验、归一化与 ISO 时间解析。
 *
 * 时间约定：按 ISO 字符串的原始偏移计算年/月/日/小时/星期，不做时区换算。
 * 经典脚本（非 ESM）：IIFE 挂载到 globalThis.ChatReport，运行时零网络请求。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatReport = globalThis.ChatReport || {});

  const RELATIONS = ['love', 'family', 'friendship', 'general', 'work', 'bestie', 'roommate', 'parent', 'group'];
  const MESSAGE_TYPES = ['text', 'image', 'sticker', 'voice', 'video', 'file', 'link', 'system', 'call', 'forward'];
  const MEDIA_TYPES = ['image', 'voice', 'video', 'file'];

  // 兼容 "2023-09-01T21:34:12+08:00"、"2023-09-01 21:34:12"、"…Z"、"…+0800" 等形式
  const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2}|[+-]\d{2})?$/;

  /**
   * 解析 ISO 时间字符串。
   * @returns {{iso,epoch,y,mo,d,hh,mi,ss,date,ym,weekday}|null}
   *   epoch 为毫秒时间戳；weekday 0=周一 … 6=周日（按日期计算）。
   */
  function parseTime(iso) {
    if (typeof iso !== 'string') return null;
    const m = TIME_RE.exec(iso.trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const hh = +m[4], mi = +m[5], ss = m[6] === undefined ? 0 : +m[6];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59 || ss > 59) return null;
    let offMin = 0;
    if (m[7]) {
      const z = m[7];
      if (z === 'Z' || z === 'z') {
        offMin = 0;
      } else {
        const sign = z[0] === '-' ? -1 : 1;
        const rest = z.slice(1).replace(':', '');
        const oh = +rest.slice(0, 2);
        const om = rest.length > 2 ? +rest.slice(2, 4) : 0;
        offMin = sign * (oh * 60 + om);
      }
    }
    const dt = new Date(0);
    dt.setUTCFullYear(y, mo - 1, d);
    dt.setUTCHours(hh, mi, ss, 0);
    const epoch = dt.getTime() - offMin * 60000;
    const wdDt = new Date(0);
    wdDt.setUTCFullYear(y, mo - 1, d);
    const isoWd = (wdDt.getUTCDay() + 6) % 7; // 0=周一
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return {
      iso: iso,
      epoch: epoch,
      y: y, mo: mo, d: d,
      hh: hh, mi: mi, ss: ss,
      date: pad(y) + '-' + pad(mo) + '-' + pad(d),
      ym: pad(y) + '-' + pad(mo),
      weekday: isoWd,
    };
  }

  function isValidRelation(r) { return RELATIONS.indexOf(r) !== -1; }

  /**
   * 校验统一消息模型（§1）。返回 { ok:boolean, errors:string[] }，errors 为中文文案。
   */
  function validateModel(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, errors: ['数据必须是一个对象'] };
    }
    if (data.schemaVersion !== undefined && data.schemaVersion !== 1) {
      errors.push('schemaVersion 必须为 1');
    }
    const meta = data.meta;
    let meId = null, otherId = null;
    let peerIds = [];
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      errors.push('缺少 meta 对象');
    } else {
      if (!meta.me || typeof meta.me !== 'object' || typeof meta.me.id !== 'string' || !meta.me.id) {
        errors.push('meta.me.id 必须是非空字符串');
      } else meId = meta.me.id;
      if (!meta.other || typeof meta.other !== 'object' || typeof meta.other.id !== 'string' || !meta.other.id) {
        errors.push('meta.other.id 必须是非空字符串');
      } else otherId = meta.other.id;
      if (meId && otherId && meId === otherId) errors.push('meta.me.id 与 meta.other.id 不能相同');
      if (meta.relation !== undefined && meta.relation !== null && !isValidRelation(meta.relation)) {
        errors.push('meta.relation 必须是 love/family/friendship/general/work/bestie/roommate/parent/group 之一');
      }
      peerIds = (Array.isArray(data.peers) && data.peers.length >= 2)
        ? data.peers.map(function (p) { return p && p.id; }).filter(Boolean)
        : (Array.isArray(meta.peers) && meta.peers.length >= 2)
          ? meta.peers.map(function (p) { return p && p.id; }).filter(Boolean)
          : [meId, otherId].filter(Boolean);
    }
    const messages = data.messages;
    if (!Array.isArray(messages)) {
      errors.push('messages 必须是数组');
    } else {
      const cap = 30; // 错误太多时截断，避免输出失控
      let flagged = 0;
      for (let i = 0; i < messages.length && flagged < cap; i++) {
        const msg = messages[i];
        const tag = 'messages[' + i + ']';
        const err = (s) => { errors.push(tag + ' ' + s); flagged++; };
        if (!msg || typeof msg !== 'object') { err('必须是对象'); continue; }
        if (typeof msg.id !== 'string' || !msg.id) err('.id 必须是非空字符串');
        if (typeof msg.peerId !== 'string') err('.peerId 必须是字符串');
        else if (peerIds.length && peerIds.indexOf(msg.peerId) === -1) err('.peerId 必须是 meta.peers 中的成员 id');
        if (typeof msg.time !== 'string' || !parseTime(msg.time)) err('.time 无法解析为时间字符串');
        if (MESSAGE_TYPES.indexOf(msg.type) === -1) err('.type 非法（未知类型应被丢弃，不得产生 type: unknown）');
        if (msg.text !== undefined && msg.text !== null && typeof msg.text !== 'string') err('.text 必须是字符串');
        if (msg.emojis !== undefined && msg.emojis !== null && !Array.isArray(msg.emojis)) err('.emojis 必须是数组');
        if (msg.sticker !== undefined && msg.sticker !== null &&
            (typeof msg.sticker !== 'object' || typeof msg.sticker.name !== 'string')) err('.sticker 必须是 { name } 对象或 null');
        if (msg.media !== undefined && msg.media !== null &&
            (typeof msg.media !== 'object' || (msg.media.types !== undefined && !Array.isArray(msg.media.types)))) err('.media 结构非法');
        if (msg.durationSec !== undefined && msg.durationSec !== null && typeof msg.durationSec !== 'number') err('.durationSec 必须是数字');
        if (msg.replyTo !== undefined && msg.replyTo !== null && typeof msg.replyTo !== 'string') err('.replyTo 必须是字符串或 null');
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * 归一化：补默认值、按 time 升序稳定排序、规整可选字段。
   * 调用方应先用 validateModel 校验；本函数对输入尽量容错。
   */
  function normalizeModel(data) {
    const meta = (data && data.meta && typeof data.meta === 'object') ? data.meta : {};
    const me = (meta.me && typeof meta.me === 'object') ? meta.me : {};
    const other = (meta.other && typeof meta.other === 'object') ? meta.other : {};
    const peersInput = (Array.isArray(data.peers) && data.peers.length >= 2)
      ? data.peers
      : (Array.isArray(meta.peers) && meta.peers.length >= 2 ? meta.peers : null);
    let peers = [];
    if (peersInput) {
      peers = peersInput.map(function (p, i) {
        const pp = (p && typeof p === 'object') ? p : {};
        return {
          id: (typeof pp.id === 'string' && pp.id) ? pp.id : ('p' + (i + 1)),
          name: (typeof pp.name === 'string' && pp.name) ? pp.name : ('成员' + (i + 1)),
          avatar: (typeof pp.avatar === 'string' && pp.avatar) ? pp.avatar : (i === 0 ? '🙂' : '💬'),
          color: (typeof pp.color === 'string' && pp.color) ? pp.color : (i === 0 ? '#5B8DEF' : '#8A93A6'),
        };
      });
    } else {
      peers = [
        {
          id: (typeof me.id === 'string' && me.id) ? me.id : 'me',
          name: (typeof me.name === 'string' && me.name) ? me.name : ((typeof me.id === 'string' && me.id) ? me.id : '我'),
          avatar: (typeof me.avatar === 'string' && me.avatar) ? me.avatar : '🙂',
          color: (typeof me.color === 'string' && me.color) ? me.color : '#5B8DEF',
        },
        {
          id: (typeof other.id === 'string' && other.id) ? other.id : 'peer',
          name: (typeof other.name === 'string' && other.name) ? other.name : ((typeof other.id === 'string' && other.id) ? other.id : '对方'),
          avatar: (typeof other.avatar === 'string' && other.avatar) ? other.avatar : '💬',
          color: (typeof other.color === 'string' && other.color) ? other.color : '#F279A6',
        }
      ];
    }
    const meNorm = peers[0];
    const otherNorm = peers[1];
    const peerIds = peers.map(function (p) { return p.id; });
    const rawMessages = Array.isArray(data.messages) ? data.messages : [];
    const indexed = rawMessages.map((msg, i) => {
      const t = parseTime(msg && msg.time);
      return { msg: msg, epoch: t ? t.epoch : 0, index: i };
    });
    indexed.sort((a, b) => a.epoch - b.epoch || a.index - b.index);
    const messages = indexed.map((it) => {
      const msg = it.msg || {};
      const sticker = (msg.sticker && typeof msg.sticker === 'object' && typeof msg.sticker.name === 'string')
        ? {
            name: msg.sticker.name,
            emoji: typeof msg.sticker.emoji === 'string' ? msg.sticker.emoji : '',
            imageFileName: typeof msg.sticker.imageFileName === 'string' ? msg.sticker.imageFileName : '',
            img: typeof msg.sticker.img === 'string' ? msg.sticker.img : ''
          }
        : null;
      const media = (msg.media && typeof msg.media === 'object' && Array.isArray(msg.media.types) && msg.media.types.length)
        ? {
            count: (typeof msg.media.count === 'number' && msg.media.count > 0) ? msg.media.count : 1,
            types: msg.media.types.slice(),
            fileName: typeof msg.media.fileName === 'string' ? msg.media.fileName : '',
            dataUrl: typeof msg.media.dataUrl === 'string' ? msg.media.dataUrl : ''
          }
        : null;
      const text = typeof msg.text === 'string' ? msg.text : '';
      let emojis = Array.isArray(msg.emojis) ? msg.emojis.slice() : [];
      if (!emojis.length && text) {
        const found = text.match(/\p{Extended_Pictographic}/gu);
        if (found) {
          const seen = {};
          emojis = [];
          found.forEach((c) => { if (!seen[c]) { seen[c] = true; emojis.push(c); } });
        }
      }
      return {
        id: String(msg.id || 'm' + it.index),
        peerId: peerIds.indexOf(msg.peerId) !== -1 ? msg.peerId : otherNorm.id,
        time: typeof msg.time === 'string' ? msg.time : '',
        type: msg.type,
        text: text,
        emojis: emojis,
        sticker: sticker,
        media: media,
        durationSec: typeof msg.durationSec === 'number' ? msg.durationSec : 0,
        replyTo: typeof msg.replyTo === 'string' ? msg.replyTo : null,
      };
    });
    return {
      schemaVersion: 1,
      meta: {
        id: typeof meta.id === 'string' ? meta.id : '',
        title: typeof meta.title === 'string' ? meta.title : '',
        source: (meta.source && typeof meta.source === 'object') ? {
          platform: typeof meta.source.platform === 'string' ? meta.source.platform : 'unknown',
          adapter: typeof meta.source.adapter === 'string' ? meta.source.adapter : '',
          originalFile: typeof meta.source.originalFile === 'string' ? meta.source.originalFile : '',
        } : { platform: 'unknown', adapter: '', originalFile: '' },
        exportedAt: typeof meta.exportedAt === 'string' ? meta.exportedAt : '',
        relation: isValidRelation(meta.relation) ? meta.relation : 'general',
        me: meNorm,
        other: otherNorm,
        group: meta.group === true,
        groupName: typeof meta.groupName === 'string' ? meta.groupName : '',
        speakers: Array.isArray(meta.speakers) ? meta.speakers.slice() : undefined,
        mergedChats: Array.isArray(meta.mergedChats) ? meta.mergedChats.slice() : undefined,
        fileCount: typeof meta.fileCount === 'number' ? meta.fileCount : undefined,
        peers: peers,
      },
      peers: peers,
      messages: messages,
    };
  }

  NS.model = {
    RELATIONS: RELATIONS,
    MESSAGE_TYPES: MESSAGE_TYPES,
    MEDIA_TYPES: MEDIA_TYPES,
    parseTime: parseTime,
    validateModel: validateModel,
    normalizeModel: normalizeModel,
  };
})();


/* ===== words.js ===== */
/**
 * ChatReport · words.js
 * 中文 2-gram 词频 + 英文分词 + 停用词表（契约 §3 词频算法约定）。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatReport = globalThis.ChatReport || {});

  const STOP_WORDS = [
    '我们', '你们', '他们', '她们', '它们', '这个', '那个', '一个', '就是', '不是',
    '什么', '怎么', '现在', '今天', '明天', '昨天', '知道', '没有', '可以', '已经',
    '真的', '还是', '觉得', '时候', '因为', '所以', '但是', '如果', '然后', '这样',
    '那样', '大家', '自己', '有点', '一下', '一起', '这么', '那么', '这么', '好吧',
    '哈哈', '嘿嘿', '嗯嗯', '哦哦', '啊啊', '啊啊啊', '呜呜', '嗯', '啊', '哦',
    '了', '的', '在', '我', '你', '他', '她', '它', '是', '有', '和', '就',
    '都', '也', '要', '会', '说', '想', '看', '去', '来', '给', '把', '被',
    '让', '对', '这', '那', '不', '没', '很', '好', '吧', '吗', '呢', '呀',
    '还', '又', '才', '只', '能', '着', '过', '得', '地', '与', '或', '及'
  ];
  const STOP_SET = {};
  STOP_WORDS.forEach(function (w) { STOP_SET[w] = true; });

  function cleanText(text) {
    let t = String(text || '');
    t = t.replace(/\p{Extended_Pictographic}/gu, ' ');
    t = t.replace(/https?:\/\/[^\s]+/g, ' ');
    t = t.replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, ' ');
    return t;
  }

  /** 对单条文本做分词：英文按空白分词；中文连续串取相邻两字 2-gram */
  function tokenize(text) {
    const tokens = [];
    const t = cleanText(text);
    const parts = t.split(/\s+/);
    for (const p of parts) {
      if (!p) continue;
      if (/^[A-Za-z0-9]+$/.test(p)) {
        if (p.length >= 2 && p.length <= 24) tokens.push(p.toLowerCase());
      } else {
        const cjk = p.match(/[\u4e00-\u9fff]+/g) || [];
        for (const seg of cjk) {
          if (seg.length === 1) continue;
          for (let i = 0; i < seg.length - 1; i++) {
            tokens.push(seg.slice(i, i + 2));
          }
        }
      }
    }
    return tokens.filter(function (w) { return w && !STOP_SET[w]; });
  }

  /** 统计消息数组（不含 system 类）的词频，返回 [{word,count}] Top 20 */
  function countTopWords(messages, topN) {
    const n = topN || 20;
    const freq = {};
    for (const m of messages) {
      if (!m || m.type === 'system') continue;
      const tokens = tokenize(m.text);
      for (const w of tokens) freq[w] = (freq[w] || 0) + 1;
    }
    const arr = Object.keys(freq).map(function (w) { return { word: w, count: freq[w] }; });
    arr.sort(function (a, b) { return b.count - a.count || (a.word < b.word ? -1 : 1); });
    return arr.slice(0, n);
  }

  /* ---------- 本地情感词典（不联网） ---------- */
  const POS_WORDS = [
    '开心', '高兴', '快乐', '幸福', '喜欢', '爱你', '想你', '期待', '惊喜', '感动',
    '温暖', '舒服', '顺利', '成功', '厉害', '优秀', '太好了', '真棒', '棒', '赞',
    '谢谢', '辛苦', '可爱', '好看', '好吃', '好玩', '漂亮', '帅', '笑死', '哈哈',
    '嘿嘿', '嘻嘻', '好耶', '棒棒哒', '么么哒', '亲亲', '抱抱', '贴贴', '太值了',
    '超级棒', '无敌', '完美', '满意', '满足', '恭喜', '加油', '顶', '治愈', '比心', '爱了'
  ];
  const NEG_WORDS = [
    '烦', '累', '难过', '伤心', '生气', '郁闷', '痛苦', '焦虑', '压力', '崩溃',
    '哭了', '呜呜', '委屈', '讨厌', '烦死', '气死', '无语', '离谱', '尴尬', '倒霉',
    '失败', '糟糕', '惨', '难受', '头疼', '心累', '烦人', '失望', '后悔', '害怕',
    '担心', '失眠', '孤独', '想哭', '麻了', '摆烂', '服了', '哭死', '破防', '裂开',
    '绷不住', '窒息', '好气', '病了', '难受死', '愁', '恼火', '暴躁', '抓狂', '绝望'
  ];

  /** 单条文本情感分：正词数 − 负词数（子串匹配） */
  function scoreText(text) {
    const t = String(text || '');
    let pos = 0, neg = 0;
    for (const w of POS_WORDS) { if (t.indexOf(w) !== -1) pos++; }
    for (const w of NEG_WORDS) { if (t.indexOf(w) !== -1) neg++; }
    return pos - neg;
  }

  NS.words = {
    tokenize: tokenize,
    countTopWords: countTopWords,
    scoreText: scoreText,
    POS_WORDS: POS_WORDS,
    NEG_WORDS: NEG_WORDS
  };
})();


/* ===== stats.js ===== */
/**
 * ChatReport · stats.js
 * analyze(model) —— 契约 §3 的全部统计。键名与结构逐字一致。
 * 依赖 model.js（parseTime / normalizeModel）与 words.js（countTopWords），
 * build.js 拼接顺序须保证它们先于本文件。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatReport = globalThis.ChatReport || {});
  const M = NS.model || {};
  const WORDS = NS.words || {};

  const WD_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  function nameOf(model, peerId) {
    const peers = model.peers || [];
    for (const p of peers) if (p.id === peerId) return p.name || String(peerId);
    const meta = model.meta || {};
    if (meta.me && meta.me.id === peerId) return meta.me.name || '我';
    if (meta.other && meta.other.id === peerId) return meta.other.name || '对方';
    return String(peerId || '未知');
  }
  function round1(v) { return Math.round(v * 10) / 10; }
  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  function splitGap(ms) {
    const totalMin = Math.floor(ms / 60000);
    return { days: Math.floor(totalMin / 1440), hours: Math.floor((totalMin % 1440) / 60) };
  }
  function fmtLabel(ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(ym);
    if (!m) return ym;
    return m[1] + '年' + parseInt(m[2], 10) + '月';
  }
  function addDays(dateStr, n) {
    const t = M.parseTime(dateStr + 'T12:00:00+08:00');
    if (!t) return dateStr;
    const d = new Date(t.epoch);
    d.setDate(d.getDate() + n);
    const pad = (x) => (x < 10 ? '0' + x : '' + x);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function analyze(rawModel) {
    const model = M.normalizeModel ? M.normalizeModel(rawModel) : rawModel;
    const meta = model.meta;
    const meId = meta.me.id;
    const peers = model.peers || [];
    const peerIds = peers.map(function (p) { return p.id; });

    // 只保留时间可解析的消息；时间不可解析的跳过（不抛异常）
    const msgs = [];
    for (const m of model.messages) {
      const t = M.parseTime(m && m.time);
      if (t && peerIds.indexOf(m.peerId) !== -1) msgs.push({ m: m, t: t });
    }
    const isMine = function (m) { return m.peerId === meId; };

    /* ---------- counts（含每人发言排行，群聊可用） ---------- */
    let mine = 0, other = 0;
    const byPeerMap = {};
    for (const it of msgs) {
      if (isMine(it.m)) mine++; else other++;
      byPeerMap[it.m.peerId] = (byPeerMap[it.m.peerId] || 0) + 1;
    }
    const total = msgs.length;
    const counts = {
      total: total,
      mine: mine,
      other: other,
      mineRatio: total ? round1(mine / total) : 0,
      otherRatio: total ? round1(other / total) : 0,
      byPeer: peers.map(function (p) {
        return {
          peerId: p.id, name: p.name,
          count: byPeerMap[p.id] || 0,
          ratio: total ? round1((byPeerMap[p.id] || 0) / total) : 0
        };
      }).sort(function (a, b) { return b.count - a.count; })
    };
    const speakers = {
      total: peers.length,
      active: counts.byPeer.filter(function (p) { return p.count > 0; }).length,
      top: counts.byPeer.slice(0, 10)
    };

    /* ---------- span / daily ---------- */
    const perDayMap = {};
    for (const it of msgs) {
      const key = it.t.date;
      if (!perDayMap[key]) perDayMap[key] = { date: key, count: 0, mine: 0, other: 0 };
      const rec = perDayMap[key];
      rec.count++;
      if (isMine(it.m)) rec.mine++; else rec.other++;
    }
    const perDay = Object.keys(perDayMap).sort().map(function (k) { return perDayMap[k]; });
    const activeDays = perDay.length;
    const dayCounts = perDay.map(function (r) { return r.count; });
    let maxDate = '', maxCount = 0;
    for (const r of perDay) {
      if (r.count > maxCount) { maxCount = r.count; maxDate = r.date; }
    }
    const firstIt = msgs[0];
    const lastIt = msgs[msgs.length - 1];
    const firstDate = firstIt ? firstIt.t.date : '';
    const lastDate = lastIt ? lastIt.t.date : '';
    const spanDays = firstIt && lastIt
      ? Math.max(1, Math.round((lastIt.t.epoch - firstIt.t.epoch) / 86400000) + 1)
      : 0;
    const span = {
      firstTime: firstIt ? firstIt.m.time : '',
      lastTime: lastIt ? lastIt.m.time : '',
      days: spanDays,
      firstDate: firstDate,
      lastDate: lastDate,
      activeDays: activeDays
    };
    const daily = {
      avg: activeDays ? round1(total / activeDays) : 0,
      median: median(dayCounts),
      max: maxCount,
      maxDate: maxDate,
      perDay: perDay
    };

    /* ---------- monthly / weekday / hours / heatmap ---------- */
    const monthMap = {};
    for (const it of msgs) {
      const key = it.t.ym;
      if (!monthMap[key]) monthMap[key] = { ym: key, label: fmtLabel(key), total: 0, mine: 0, other: 0 };
      const rec = monthMap[key];
      rec.total++;
      if (isMine(it.m)) rec.mine++; else rec.other++;
    }
    const monthly = Object.keys(monthMap).sort().map(function (k) { return monthMap[k]; });

    const weekday = [];
    for (let wd = 0; wd < 7; wd++) weekday.push({ wd: wd, label: WD_LABELS[wd], total: 0, mine: 0, other: 0 });
    const hours = [];
    for (let h = 0; h < 24; h++) hours.push({ h: h, total: 0, mine: 0, other: 0 });
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const row = [];
      for (let h = 0; h < 24; h++) row.push(0);
      cells.push(row);
    }
    for (const it of msgs) {
      const w = weekday[it.t.weekday];
      w.total++; if (isMine(it.m)) w.mine++; else w.other++;
      const hh = hours[it.t.hh];
      hh.total++; if (isMine(it.m)) hh.mine++; else hh.other++;
      cells[it.t.weekday][it.t.hh]++;
    }
    const heatmap = { days: WD_LABELS.slice(), hours: [], cells: cells };
    for (let h = 0; h < 24; h++) heatmap.hours.push(h);

    /* ---------- lateNight（00:00–05:00）---------- */
    let lnCount = 0, lnMine = 0, lnOther = 0;
    for (const it of msgs) {
      if (it.t.hh < 5) {
        lnCount++;
        if (isMine(it.m)) lnMine++; else lnOther++;
      }
    }
    const lateNight = {
      count: lnCount, mine: lnMine, other: lnOther,
      ratio: total ? round1(lnCount / total) : 0
    };

    /* ---------- emojis / stickers ---------- */
    const emojiMap = {};
    for (const it of msgs) {
      const list = Array.isArray(it.m.emojis) ? it.m.emojis : [];
      for (const c of list) {
        if (typeof c === 'string' && c) emojiMap[c] = (emojiMap[c] || 0) + 1;
      }
    }
    const emojis = Object.keys(emojiMap).map(function (c) { return { char: c, count: emojiMap[c] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 15);

    const stickerMap = {};
    for (const it of msgs) {
      const st = it.m.sticker;
      if (st && typeof st.name === 'string' && st.name) {
        if (!stickerMap[st.name]) stickerMap[st.name] = { name: st.name, emoji: st.emoji || '', img: st.img || '', count: 0 };
        const rec = stickerMap[st.name];
        rec.count++;
        if (!rec.emoji && st.emoji) rec.emoji = st.emoji;
        if (!rec.img && st.img) rec.img = st.img;
      }
    }
    const stickers = Object.keys(stickerMap).map(function (k) { return stickerMap[k]; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 15);

    /* ---------- media ---------- */
    let mImg = 0, mVoice = 0, mVoiceSec = 0, mVideo = 0, mFile = 0, mLink = 0;
    const photos = [];
    /* 图片热度 = 该图片发出后 30 分钟内的消息条数（讨论热度） */
    const HEAT_WINDOW_MS = 30 * 60 * 1000;
    for (let i = 0; i < msgs.length; i++) {
      const it = msgs[i];
      if (!(it.m.media && typeof it.m.media.dataUrl === 'string' && it.m.media.dataUrl)) continue;
      let heat = 0;
      for (let j = i + 1; j < msgs.length; j++) {
        if (msgs[j].t.epoch - it.t.epoch > HEAT_WINDOW_MS) break;
        heat++;
      }
      photos.push({ dataUrl: it.m.media.dataUrl, time: it.m.time, peerId: it.m.peerId, heat: heat });
    }
    photos.sort(function (a, b) { return b.heat - a.heat; });
    for (const it of msgs) {
      const t = it.m.type;
      if (t === 'image') mImg += (it.m.media && it.m.media.count) || 1;
      else if (t === 'voice') { mVoice += (it.m.media && it.m.media.count) || 1; mVoiceSec += it.m.durationSec || 0; }
      else if (t === 'video') mVideo += (it.m.media && it.m.media.count) || 1;
      else if (t === 'file') mFile += (it.m.media && it.m.media.count) || 1;
      else if (t === 'link') mLink++;
    }
    const media = { images: mImg, voice: mVoice, voiceSeconds: mVoiceSec, video: mVideo, files: mFile, links: mLink, photos: photos };

    /* ---------- text ---------- */
    let totalChars = 0, mineChars = 0, otherChars = 0, textCount = 0;
    let longest = null;
    for (const it of msgs) {
      if (it.m.type === 'system') continue;
      const len = (it.m.text || '').length;
      if (!len) continue;
      totalChars += len; textCount++;
      if (isMine(it.m)) mineChars += len; else otherChars += len;
      if (!longest || len > longest.chars) {
        longest = {
          text: it.m.text, chars: len,
          peerId: it.m.peerId, peerName: nameOf(model, it.m.peerId), time: it.m.time
        };
      }
    }
    const text = {
      totalChars: totalChars,
      mineChars: mineChars,
      otherChars: otherChars,
      avgChars: textCount ? round1(totalChars / textCount) : 0,
      longest: longest || { text: '', chars: 0, peerId: '', peerName: '', time: '' },
      topWords: WORDS.countTopWords ? WORDS.countTopWords(model.messages, 20) : []
    };

    /* ---------- reply（相邻切换，间隔 ∈ [0,48h]）---------- */
    const replyMine = [], replyOther = [];
    let fastest = null;
    for (let i = 1; i < msgs.length; i++) {
      const prev = msgs[i - 1], cur = msgs[i];
      if (prev.m.peerId === cur.m.peerId) continue;
      const gapSec = Math.round((cur.t.epoch - prev.t.epoch) / 1000);
      if (gapSec < 0 || gapSec > 48 * 3600) continue;
      if (isMine(cur.m)) replyMine.push(gapSec); else replyOther.push(gapSec);
      if (!fastest || gapSec < fastest.sec) {
        fastest = {
          peerId: cur.m.peerId, peerName: nameOf(model, cur.m.peerId),
          sec: gapSec, time: cur.m.time
        };
      }
    }
    const avgOf = function (arr) { return arr.length ? Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length) : 0; };
    const reply = {
      mineAvgSec: avgOf(replyMine),
      otherAvgSec: avgOf(replyOther),
      mineMedianSec: Math.round(median(replyMine)),
      otherMedianSec: Math.round(median(replyOther)),
      fastest: fastest || { peerId: '', peerName: '', sec: 0, time: '' }
    };

    /* ---------- initiative（间隔 ≥4h 或首条）---------- */
    let iniMine = 0, iniOther = 0;
    for (let i = 0; i < msgs.length; i++) {
      if (i === 0) {
        if (isMine(msgs[i].m)) iniMine++; else iniOther++;
        continue;
      }
      const gapSec = (msgs[i].t.epoch - msgs[i - 1].t.epoch) / 1000;
      if (gapSec >= 4 * 3600) {
        if (isMine(msgs[i].m)) iniMine++; else iniOther++;
      }
    }
    const iniTotal = iniMine + iniOther;
    const initiative = {
      mine: iniMine, other: iniOther,
      mineRatio: iniTotal ? round1(iniMine / iniTotal) : 0
    };

    /* ---------- silence（相邻最大间隔；当前沉默）---------- */
    let silenceLongest = { days: 0, hours: 0, from: '', to: '' };
    for (let i = 1; i < msgs.length; i++) {
      const gapMs = msgs[i].t.epoch - msgs[i - 1].t.epoch;
      const cur = splitGap(gapMs);
      const best = silenceLongest.days * 24 + silenceLongest.hours;
      if (cur.days * 24 + cur.hours > best) {
        silenceLongest = { days: cur.days, hours: cur.hours, from: msgs[i - 1].m.time, to: msgs[i].m.time };
      }
    }
    const nowMs = Date.now();
    const sinceLast = lastIt ? Math.max(0, nowMs - lastIt.t.epoch) : 0;
    const curGap = splitGap(sinceLast);
    const silence = {
      longest: silenceLongest,
      current: { days: curGap.days, hours: curGap.hours, since: lastIt ? lastIt.m.time : '' }
    };

    /* ---------- streak（最长连续活跃自然日）---------- */
    let streakLongest = 0, streakStart = '', streakEnd = '';
    let run = 0, runStart = '';
    for (let i = 0; i < perDay.length; i++) {
      if (i === 0) { run = 1; runStart = perDay[i].date; }
      else if (perDay[i].date === addDays(perDay[i - 1].date, 1)) { run++; }
      else { run = 1; runStart = perDay[i].date; }
      if (run > streakLongest) {
        streakLongest = run;
        streakStart = runStart;
        streakEnd = perDay[i].date;
      }
    }
    const streak = { longestDays: streakLongest, longestStart: streakStart, longestEnd: streakEnd };

    /* ---------- calls ---------- */
    let callCount = 0, callMine = 0, callOther = 0, callSec = 0;
    for (const it of msgs) {
      if (it.m.type === 'call') {
        callCount++;
        if (isMine(it.m)) callMine++; else callOther++;
        callSec += it.m.durationSec || 0;
      }
    }
    const calls = { count: callCount, mine: callMine, other: callOther, totalSec: callSec };

    /* ---------- highlights ---------- */
    const mkHl = function (it) {
      if (!it) return { time: '', peerId: '', peerName: '', text: '' };
      return {
        time: it.m.time, peerId: it.m.peerId,
        peerName: nameOf(model, it.m.peerId), text: it.m.text || ''
      };
    };
    const hlFirst = mkHl(firstIt), hlLast = mkHl(lastIt);
    const highlights = { first: hlFirst, last: hlLast, latest: hlLast };

    /* ---------- emotion（本地情感词典，逐条打分） ---------- */
    const emoOverall = { pos: 0, neg: 0, neutral: 0 };
    const emoDailyMap = {};
    const emoMonthMap = {};
    for (const it of msgs) {
      if (it.m.type !== 'text' || !it.m.text) continue;
      const sc = WORDS.scoreText ? WORDS.scoreText(it.m.text) : 0;
      if (sc > 0) emoOverall.pos++;
      else if (sc < 0) emoOverall.neg++;
      else emoOverall.neutral++;
      if (sc === 0) continue;
      if (!emoDailyMap[it.t.date]) emoDailyMap[it.t.date] = { date: it.t.date, pos: 0, neg: 0 };
      if (!emoMonthMap[it.t.ym]) emoMonthMap[it.t.ym] = { ym: it.t.ym, label: fmtLabel(it.t.ym), pos: 0, neg: 0 };
      if (sc > 0) { emoDailyMap[it.t.date].pos++; emoMonthMap[it.t.ym].pos++; }
      else { emoDailyMap[it.t.date].neg++; emoMonthMap[it.t.ym].neg++; }
    }
    const emoDaily = Object.keys(emoDailyMap).sort().map(function (k) {
      const r = emoDailyMap[k];
      return { date: r.date, pos: r.pos, neg: r.neg, score: r.pos - r.neg };
    });
    const emotionMonthly = Object.keys(emoMonthMap).sort().map(function (k) { return emoMonthMap[k]; });
    let happiest = { date: '', score: 0 };
    let saddest = { date: '', score: 0 };
    if (emoDaily.length) {
      let hi = emoDaily[0], lo = emoDaily[0];
      for (const r of emoDaily) {
        if (r.score > hi.score) hi = r;
        if (r.score < lo.score) lo = r;
      }
      happiest = { date: hi.date, score: hi.score };
      saddest = { date: lo.date, score: lo.score };
    }
    const emotion = {
      overall: emoOverall,
      daily: emoDaily,
      monthly: emotionMonthly,
      happiest: happiest,
      saddest: saddest
    };

    return {
      counts: counts, span: span, daily: daily, monthly: monthly,
      weekday: weekday, hours: hours, heatmap: heatmap, lateNight: lateNight,
      emojis: emojis, stickers: stickers, media: media, text: text,
      reply: reply, initiative: initiative, silence: silence,
      streak: streak, calls: calls, highlights: highlights,
      speakers: speakers, emotion: emotion
    };
  }

  NS.stats = { analyze: analyze };
})();


/* ===== charts.js ===== */
/**
 * ChatReport · charts.js
 * inline SVG 图表生成器（纯字符串拼接，零依赖，可嵌入自包含 HTML）。
 * 统一输出 viewBox="0 0 W H" 的 <svg>，宽度自适应（width:100%）。
 * 所有文案需调用方传入；本模块只负责几何与样式。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatReport = globalThis.ChatReport || {});

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 柱状图（单系列或双系列分组柱）。series: [{name,color,values}] */
  function barChart(opts) {
    const W = 600, H = 240, padL = 44, padR = 12, padT = 24, padB = 40;
    const labels = opts.labels || [];
    const series = (opts.series && opts.series.length) ? opts.series : [{ name: '', color: '#5B8DEF', values: opts.values || [] }];
    let max = 1;
    for (const s of series) for (const v of s.values) if (v > max) max = v;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = labels.length || 1;
    const groupW = plotW / n;
    const barW = Math.min(28, (groupW * 0.8) / series.length);
    const y = (v) => padT + plotH - (v / max) * plotH;
    const gridLines = 4;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto" role="img">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none"/>';
    for (let g = 0; g <= gridLines; g++) {
      const gy = padT + (plotH * g) / gridLines;
      const val = Math.round(max - (max * g) / gridLines);
      s += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#e8ebf3" stroke-width="1"/>';
      s += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="#8a91a3">' + val + '</text>';
    }
    for (let i = 0; i < n; i++) {
      const cx = padL + groupW * i + groupW / 2;
      const totalBarW = series.length * barW;
      for (let si = 0; si < series.length; si++) {
        const v = series[si].values[i] || 0;
        const bx = cx - totalBarW / 2 + si * barW;
        const by = y(v);
        s += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + (barW - 2).toFixed(1) + '" height="' + Math.max(0, (padT + plotH - by)).toFixed(1) + '" rx="3" fill="' + series[si].color + '"/>';
        if (v > 0 && n <= 24) {
          s += '<text x="' + (bx + barW / 2).toFixed(1) + '" y="' + (by - 4).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#6a7285">' + v + '</text>';
        }
      }
      if (n <= 24) {
        s += '<text x="' + cx.toFixed(1) + '" y="' + (H - padB + 16) + '" text-anchor="middle" font-size="10" fill="#8a91a3">' + esc(labels[i]) + '</text>';
      }
    }
    if (series.length > 1 && series[0].name) {
      let lx = padL;
      for (const sr of series) {
        s += '<rect x="' + lx + '" y="' + (H - 14) + '" width="10" height="10" rx="2" fill="' + sr.color + '"/>';
        s += '<text x="' + (lx + 15) + '" y="' + (H - 5) + '" font-size="11" fill="#6a7285">' + esc(sr.name) + '</text>';
        lx += 15 + esc(sr.name).length * 12 + 18;
      }
    }
    s += '</svg>';
    return s;
  }

  /** 24 小时柱状图。data: {labels:[0..23], values:[n]} */
  function hourBarChart(opts) {
    const W = 600, H = 200, padL = 40, padR = 10, padT = 20, padB = 34;
    const values = opts.values || [];
    let max = 1;
    for (const v of values) if (v > max) max = v;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = values.length || 24;
    const barW = plotW / n;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto" role="img">';
    for (let g = 0; g <= 4; g++) {
      const gy = padT + (plotH * g) / 4;
      s += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#e8ebf3"/>';
    }
    for (let i = 0; i < n; i++) {
      const v = values[i] || 0;
      const by = padT + plotH - (v / max) * plotH;
      const h = Math.max(0, (v / max) * plotH);
      const bx = padL + i * barW;
      s += '<rect x="' + (bx + 0.5).toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + Math.max(1, barW - 1.2).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.5" fill="' + (opts.color || '#5B8DEF') + '"/>';
    }
    for (const hh of [0, 6, 12, 18, 23]) {
      const tx = padL + hh * barW + barW / 2;
      s += '<text x="' + tx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="10" fill="#8a91a3">' + hh + '时</text>';
    }
    s += '</svg>';
    return s;
  }

  /** 7×24 活跃热力图。cells[d][h]=count，d 0=周一 */
  function heatmapChart(opts) {
    const cell = 17, gap = 3, padL = 46, padT = 26, padB = 26;
    const W = padL + 24 * (cell + gap) + 8, H = padT + 7 * (cell + gap) + padB;
    const cells = opts.cells || [];
    const days = opts.days || ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    let max = 1;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
      const v = (cells[d] && cells[d][h]) || 0;
      if (v > max) max = v;
    }
    const color = (v) => {
      if (!v) return '#eef0f6';
      const ratio = Math.min(1, v / max);
      // 从浅到深的主题色插值（opts.color 为 #RRGGBB 基色）
      const base = opts.color || '#5B8DEF';
      const r = parseInt(base.slice(1, 3), 16), g = parseInt(base.slice(3, 5), 16), b = parseInt(base.slice(5, 7), 16);
      const a = 0.16 + 0.84 * ratio;
      const mix = (c) => Math.round(255 - (255 - c) * a);
      return 'rgb(' + mix(r) + ',' + mix(g) + ',' + mix(b) + ')';
    };
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto" role="img">';
    for (let d = 0; d < 7; d++) {
      const y = padT + d * (cell + gap);
      s += '<text x="' + (padL - 8) + '" y="' + (y + cell / 2 + 4) + '" text-anchor="end" font-size="10" fill="#8a91a3">' + days[d] + '</text>';
      for (let h = 0; h < 24; h++) {
        const x = padL + h * (cell + gap);
        const v = (cells[d] && cells[d][h]) || 0;
        s += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" rx="3" fill="' + color(v) + '">';
        s += '<title>' + days[d] + ' ' + h + ':00 - ' + v + ' 条</title></rect>';
      }
    }
    for (const hh of [0, 6, 12, 18, 23]) {
      const tx = padL + hh * (cell + gap) + cell / 2;
      s += '<text x="' + tx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#8a91a3">' + hh + '时</text>';
    }
    s += '</svg>';
    return s;
  }

  /** 环形图。segments: [{label,value,color}]，center 显示总数与说明 */
  function ringChart(opts) {
    const size = 210, cx = size / 2, cy = size / 2, r = 78, sw = 34;
    const segments = opts.segments || [];
    const total = segments.reduce(function (a, b) { return a + (b.value || 0); }, 0) || 1;
    const C = 2 * Math.PI * r;
    let s = '<svg viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg" style="width:210px;height:210px" role="img">';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#eef0f6" stroke-width="' + sw + '"/>';
    let acc = 0;
    for (const seg of segments) {
      const frac = (seg.value || 0) / total;
      const dash = frac * C;
      const offset = C / 4 - acc * C;
      if (frac > 0) {
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (seg.color || '#5B8DEF') + '" stroke-width="' + sw + '" stroke-dasharray="' + dash.toFixed(2) + ' ' + (C - dash).toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      }
      acc += frac;
    }
    s += '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="24" font-weight="700" fill="#2b3040">' + (opts.center || total) + '</text>';
    s += '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" font-size="11" fill="#8a91a3">' + esc(opts.centerLabel || '') + '</text>';
    s += '</svg>';
    return s;
  }

  /** 横向条形图（表情包 / emoji / 高频词 Top）。items: [{label,value,emoji?}] */
  function hBarChart(opts) {
    const max = Math.max.apply(null, (opts.items || []).map(function (i) { return i.value || 0; }).concat([1]));
    const rowH = 30, padL = 160, padR = 46, barMaxW = 320;
    const W = padL + barMaxW + padR, H = (opts.items || []).length * rowH + 8;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto" role="img">';
    (opts.items || []).forEach(function (it, i) {
      const y = i * rowH + 4;
      const w = Math.max(3, (it.value / max) * barMaxW);
      const label = (it.emoji ? it.emoji + ' ' : '') + it.label;
      s += '<text x="' + (padL - 8) + '" y="' + (y + 18) + '" text-anchor="end" font-size="12" fill="#2b3040">' + esc(label) + '</text>';
      s += '<rect x="' + padL + '" y="' + y + '" width="' + w.toFixed(1) + '" height="20" rx="4" fill="' + (opts.color || '#5B8DEF') + '" opacity="0.85"/>';
      s += '<text x="' + (padL + w + 8).toFixed(1) + '" y="' + (y + 15) + '" font-size="11" fill="#6a7285">' + it.value + '次</text>';
    });
    s += '</svg>';
    return s;
  }

  /** 词云（确定性螺旋布局 + 矩形碰撞检测，最多 16 个词）。items: [{label,value}] */
  function wordCloud(opts) {
    const words = (opts.items || []).slice(0, 16);
    if (!words.length) return '<p class="note">文本量不足，暂无词云。</p>';
    const W = 600, H = 300;
    const colors = opts.colors || ['#5B8DEF', '#F279A6', '#22B8A6', '#F59E42', '#8F6FF0', '#3E6FD0', '#D9567F', '#148F80'];
    const max = words[0].value || 1;
    const placed = [];
    const cx = W / 2, cy = H / 2;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto" role="img">';
    words.forEach(function (it, idx) {
      const ratio = Math.sqrt((it.value || 0) / max);
      const fs = Math.max(13, Math.round(12 + ratio * 30));
      const label = String(it.label == null ? '' : it.label);
      const textW = label.length * fs + 10;
      const textH = fs + 8;
      let spot = null;
      for (let step = 0; step < 4000; step++) {
        const t = step * 0.3;
        const r = 3 + t * 2.1;
        const x = cx + r * Math.cos(t) - textW / 2;
        const y = cy + r * Math.sin(t) * 0.7 - textH / 2;
        if (x < 4 || x + textW > W - 4 || y < 4 || y + textH > H - 4) continue;
        let ok = true;
        for (const p of placed) {
          if (x < p.x + p.w + 5 && x + textW > p.x - 5 && y < p.y + p.h + 5 && y + textH > p.y - 5) { ok = false; break; }
        }
        if (ok) { spot = { x: x, y: y, w: textW, h: textH }; break; }
      }
      if (!spot) return;
      placed.push(spot);
      const tx = Math.round(spot.x + textW / 2);
      const ty = Math.round(spot.y + textH / 2 + fs * 0.34);
      s += '<text x="' + tx + '" y="' + ty + '" text-anchor="middle" font-size="' + fs + '" font-weight="' + (fs > 22 ? 700 : 500) + '" fill="' + colors[idx % colors.length] + '" opacity="' + (0.75 + ratio * 0.25).toFixed(2) + '">' + esc(label) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  NS.charts = { esc: esc, barChart: barChart, hourBarChart: hourBarChart, heatmapChart: heatmapChart, ringChart: ringChart, hBarChart: hBarChart, wordCloud: wordCloud };
})();


/* ===== templates.js ===== */
/**
 * ChatReport · templates.js
 * 九套报告模板注册表（契约 §4）：id/name/description/icon/theme + 板块清单 + 叙事文案。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatReport = globalThis.ChatReport || {});

  const TEMPLATES = [
    {
      id: 'love',
      name: '恋爱报告',
      icon: '💕',
      description: '甜蜜叙事：相识起点、深夜聊天、TA 的表情包、回复速度、主动指数、最长沉默与高光时刻',
      theme: { primary: '#F279A6', bg: '#FFF3F7', accent: '#D9567F', light: '#FDEEF3' },
      sections: ['overview', 'span', 'monthly', 'heatmap', 'lateNight', 'stickers', 'emojis', 'textWords', 'wordCloud', 'emotion', 'reply', 'initiative', 'silence', 'photos', 'highlight']
    },
    {
      id: 'family',
      name: '亲情报告',
      icon: '🏠',
      description: '温情叙事：陪伴时长、通话与语音统计、活跃时段、深夜牵挂、最常分享与高光时刻',
      theme: { primary: '#F59E42', bg: '#FFF7EC', accent: '#D97F1E', light: '#FDF1DE' },
      sections: ['overview', 'span', 'calls', 'media', 'hourly', 'heatmap', 'lateNight', 'photos', 'textWords', 'wordCloud', 'emotion', 'highlight']
    },
    {
      id: 'friendship',
      name: '友情报告',
      icon: '🤝',
      description: '幽默叙事：友谊时长、熬夜战友、最活跃一天、互怼时刻、沉默考验与高光时刻',
      theme: { primary: '#22B8A6', bg: '#F0FBF9', accent: '#148F80', light: '#E2F7F3' },
      sections: ['overview', 'span', 'daily', 'heatmap', 'lateNight', 'emojis', 'stickers', 'photos', 'textWords', 'wordCloud', 'emotion', 'silence', 'streak', 'highlight']
    },
    {
      id: 'general',
      name: '通用报告',
      icon: '📊',
      description: '中性叙事：全部统计板块',
      theme: { primary: '#5B8DEF', bg: '#F4F7FD', accent: '#3E6FD0', light: '#EAF0FB' },
      sections: ['overview', 'span', 'monthly', 'hourly', 'heatmap', 'lateNight', 'emojis', 'stickers', 'media', 'photos', 'calls', 'textWords', 'wordCloud', 'emotion', 'reply', 'initiative', 'silence', 'streak', 'highlight']
    },
    {
      id: 'work',
      name: '职场报告',
      icon: '💼',
      description: '协作叙事：工作时段、效率曲线、高频词、回复速度与配合默契',
      theme: { primary: '#64748B', bg: '#F6F7F9', accent: '#475569', light: '#EEF1F5' },
      sections: ['overview', 'span', 'monthly', 'hourly', 'heatmap', 'textWords', 'wordCloud', 'reply', 'initiative', 'silence', 'highlight']
    },
    {
      id: 'bestie',
      name: '闺蜜报告',
      icon: '👯',
      description: '亲密叙事：互怼日常、深夜八卦、表情包大战与高光时刻',
      theme: { primary: '#A855F7', bg: '#FAF5FF', accent: '#8B3DE0', light: '#F3EAFD' },
      sections: ['overview', 'span', 'daily', 'heatmap', 'lateNight', 'emojis', 'stickers', 'photos', 'textWords', 'wordCloud', 'emotion', 'streak', 'highlight']
    },
    {
      id: 'roommate',
      name: '室友报告',
      icon: '🛋️',
      description: '合租叙事：日常琐事、分享统计、熬夜记录与默契时刻',
      theme: { primary: '#06B6D4', bg: '#F0FCFE', accent: '#0891B2', light: '#E3F8FC' },
      sections: ['overview', 'span', 'monthly', 'hourly', 'heatmap', 'lateNight', 'media', 'stickers', 'textWords', 'wordCloud', 'silence', 'highlight']
    },
    {
      id: 'parent',
      name: '亲子报告',
      icon: '👶',
      description: '成长叙事：陪伴时长、通话与语音、成长话题与高光时刻',
      theme: { primary: '#FB7185', bg: '#FFF5F6', accent: '#E11D48', light: '#FEEBEE' },
      sections: ['overview', 'span', 'calls', 'media', 'hourly', 'heatmap', 'lateNight', 'photos', 'textWords', 'wordCloud', 'emotion', 'highlight']
    },
    {
      id: 'group',
      name: '群聊报告',
      icon: '👥',
      description: '群像叙事：发言排行、活跃热力图、深夜活跃、表情包与词云',
      theme: { primary: '#6366F1', bg: '#F5F6FF', accent: '#4F46E5', light: '#EBEDFE' },
      sections: ['overview', 'speakers', 'span', 'monthly', 'heatmap', 'lateNight', 'emojis', 'stickers', 'textWords', 'wordCloud', 'emotion', 'highlight']
    }
  ];

  const BY_ID = {};
  TEMPLATES.forEach(function (t) { BY_ID[t.id] = t; });

  /** 模板叙事：opening / closing，参数 (model, stats)。返回中文文案（可含换行）。 */
  const NARRATIVE = {
    love: {
      opening: function (model, s) {
        const o = model.meta.other.name, m = model.meta.me.name;
        return '从 ' + (s.span.firstDate || '相识那天') + ' 的第一句「' + (s.highlights.first.text || '你好') + '」开始，' + m + ' 与 ' + o + ' 在 ' + s.span.days + ' 天里交换了 ' + s.counts.total + ' 条消息。每一条都像一颗糖，散落在' + (s.daily.avg || 0) + ' 条/天的日常里。';
      },
      closing: function (model, s) {
        const o = model.meta.other.name, m = model.meta.me.name;
        let parts = ['数据记得住每一次心动。'];
        if (s.lateNight.count > 0) parts.push('那些 ' + s.lateNight.count + ' 条深夜消息，是彼此把最安静的时光都给了对方。');
        if (s.stickers.length) parts.push('而最常用的表情包「' + s.stickers[0].name + '」，早已成为两个人之间无需翻译的语言。');
        parts.push('愿 ' + m + ' 与 ' + o + ' 的下一个 ' + s.span.days + ' 天，消息更多，想念更少。');
        return parts.join('\n');
      }
    },
    family: {
      opening: function (model, s) {
        const o = model.meta.other.name, m = model.meta.me.name;
        return m + ' 与 ' + o + ' 的聊天记录里，藏着 ' + s.span.days + ' 天的牵挂：' + s.counts.total + ' 条消息、' + s.calls.count + ' 次通话、' + (s.media.voice + s.media.voiceSeconds > 0 ? s.media.voiceSeconds + ' 秒语音' : '无数句叮嘱') + '。家的温度，都被文字记得。';
      },
      closing: function (model, s) {
        const o = model.meta.other.name;
        let parts = ['家人之间的爱很少直说，却总是准时送达。'];
        if (s.lateNight.count > 0) parts.push('那 ' + s.lateNight.count + ' 条深夜消息，是放心不下的惦记。');
        parts.push('常回家看看，也常回消息看看。' + o + ' 一直在等你。');
        return parts.join('\n');
      }
    },
    friendship: {
      opening: function (model, s) {
        const o = model.meta.other.name, m = model.meta.me.name;
        return m + ' 与 ' + o + ' 的友谊已经走过 ' + s.span.days + ' 天，' + s.counts.total + ' 条消息平均每天 ' + (s.daily.avg || 0) + ' 条——这哪里是聊天，分明是连载。';
      },
      closing: function (model, s) {
        const o = model.meta.other.name;
        let parts = ['真正的友谊，经得起沉默的考验，也扛得住深夜的废话。'];
        if (s.streak.longestDays > 3) parts.push('最长连续 ' + s.streak.longestDays + ' 天的每日打卡，友谊持久度拉满。');
        parts.push('下次见面，就按这份报告碰杯。' + o + '，友谊万岁。');
        return parts.join('\n');
      }
    },
    general: {
      opening: function (model, s) {
        return '本报告覆盖 ' + s.span.days + ' 天、' + s.counts.total + ' 条消息（活跃 ' + s.span.activeDays + ' 天），以下从多个维度呈现这段聊天记录。';
      },
      closing: function () {
        return '数据是时间的化石。愿每一次回顾，都能让珍贵的点滴更加清晰。';
      }
    },
    work: {
      opening: function (model, s) {
        const o = model.meta.other.name, m = model.meta.me.name;
        return m + ' 与 ' + o + ' 在 ' + s.span.days + ' 天的工作协作中交换了 ' + s.counts.total + ' 条消息，平均回复 ' + fmtShort(s.reply.mineAvgSec) + '。靠谱的伙伴，值得被数据证明。';
      },
      closing: function () {
        return '工作消息虽短，但每一条「收到」背后都是推进。祝合作愉快，deadline 全绿。';
      }
    },
    bestie: {
      opening: function (model, s) {
        const o = model.meta.other.name, m = model.meta.me.name;
        return m + ' 与 ' + o + ' 的 ' + s.counts.total + ' 条消息里，藏着 ' + s.stickers.reduce(function (a, b) { return a + b.count; }, 0) + ' 个表情包和说不完的八卦。';
      },
      closing: function (model, s) {
        let parts = ['闺蜜是世界上另一种亲人。'];
        if (s.streak.longestDays > 3) parts.push('最长连续 ' + s.streak.longestDays + ' 天互聊不断，黏性超标。');
        parts.push('约好下一次逛街，继续聊。');
        return parts.join('\n');
      }
    },
    roommate: {
      opening: function (model, s) {
        const o = model.meta.other.name, m = model.meta.me.name;
        return m + ' 与 ' + o + ' 的合租日常：' + s.counts.total + ' 条消息，分享过 ' + (s.media.images + s.media.video) + ' 张图影，深夜消息 ' + s.lateNight.count + ' 条。';
      },
      closing: function () {
        return '同住一个屋檐下，还能聊这么多，说明这个室友选对了。';
      }
    },
    parent: {
      opening: function (model, s) {
        const o = model.meta.other.name, m = model.meta.me.name;
        return m + ' 与 ' + o + ' 的 ' + s.counts.total + ' 条消息里，有 ' + s.calls.count + ' 次通话和 ' + s.media.voice + ' 条语音。孩子长大，牵挂不会。';
      },
      closing: function (model, s) {
        let parts = ['陪伴是最长情的告白。'];
        if (s.emotion && s.emotion.overall.pos > 0) parts.push('这段记录里有 ' + s.emotion.overall.pos + ' 条开心时刻，家的温度一直都在。');
        parts.push('多打打电话，多回家看看。');
        return parts.join('\n');
      }
    },
    group: {
      opening: function (model, s) {
        const name = model.meta.groupName || model.meta.title || '这个群';
        return '「' + name + '」里有 ' + s.speakers.active + ' 位活跃成员，' + s.counts.total + ' 条消息。群像如下。';
      },
      closing: function (model, s) {
        const top = s.speakers.top[0];
        return top ? ('群里的「话痨担当」是 ' + top.name + '，贡献了 ' + Math.round(top.ratio * 100) + '% 的消息。群因每个人而热闹。') : '群因每个人而热闹。';
      }
    }
  };

  function fmtShort(sec) {
    sec = Math.round(sec || 0);
    if (sec < 60) return sec + ' 秒';
    if (sec < 3600) return Math.round(sec / 60) + ' 分钟';
    return Math.round(sec / 360) / 10 + ' 小时';
  }

  function listTemplates() {
    return TEMPLATES.map(function (t) {
      return { id: t.id, name: t.name, icon: t.icon, description: t.description, theme: { primary: t.theme.primary, bg: t.theme.bg, accent: t.theme.accent } };
    });
  }
  function getTemplate(id) { return BY_ID[id] || BY_ID.general; }
  function narrativeOf(id) { return NARRATIVE[id] || NARRATIVE.general; }

  NS.templates = { listTemplates: listTemplates, getTemplate: getTemplate, narrativeOf: narrativeOf };
})();


/* ===== html.js ===== */
/**
 * ChatReport · html.js
 * generateHtml(model, opts) —— 自包含 HTML 报告（契约 §2.1/§4）。
 * inline CSS + inline SVG 图表，无任何外部请求。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatReport = globalThis.ChatReport || {});
  const C = NS.charts || {};
  const T = NS.templates || {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmtTime(iso) {
    const t = (NS.model && NS.model.parseTime) ? NS.model.parseTime(iso) : null;
    if (!t) return String(iso || '');
    return t.y + '年' + t.mo + '月' + t.d + '日 ' + (t.hh < 10 ? '0' : '') + t.hh + ':' + (t.mi < 10 ? '0' : '') + t.mi;
  }
  function fmtDur(sec) {
    sec = Math.round(sec || 0);
    if (sec < 60) return sec + ' 秒';
    if (sec < 3600) return Math.round(sec / 60) + ' 分钟';
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }
  function fmtGap(g) { return g.days ? g.days + ' 天 ' + g.hours + ' 小时' : g.hours + ' 小时'; }

  const SECTION_TITLES = {
    overview: '消息总览',
    span: { love: '相识起点', family: '陪伴时长', friendship: '友谊时长', general: '时间跨度' },
    monthly: '月度趋势',
    hourly: '24 小时活跃分布',
    heatmap: '活跃时间热力图',
    lateNight: { love: '深夜聊天', family: '深夜牵挂', friendship: '熬夜战友', general: '深夜消息' },
    stickers: { love: 'TA 最爱的表情包', family: '最常用的表情包', friendship: '最常用的表情包', general: '最常用的表情包' },
    emojis: '最常用 Emoji',
    textWords: { love: '聊天里的高频词', family: '高频词', friendship: '互怼时刻', general: '高频词' },
    wordCloud: '词云',
    reply: '回复速度',
    initiative: '主动指数',
    silence: { love: '最长沉默', family: '最长沉默', friendship: '沉默考验', general: '最长沉默' },
    streak: '连续活跃纪录',
    media: { family: '最常分享', general: '媒体分享统计' },
    photos: '照片墙',
    speakers: '发言排行',
    emotion: '情感趋势',
    calls: { family: '通话与语音统计', general: '通话统计' },
    daily: { friendship: '最活跃的一天', general: '最活跃的一天' },
    highlight: '高光时刻'
  };
  function titleOf(tplId, sec) {
    const t = SECTION_TITLES[sec];
    if (!t) return sec;
    if (typeof t === 'string') return t;
    return t[tplId] || t.general || sec;
  }

  function statCard(label, value, sub) {
    return '<div class="stat"><div class="stat-v">' + esc(value) + '</div><div class="stat-l">' + esc(label) + '</div>' +
      (sub ? '<div class="stat-s">' + esc(sub) + '</div>' : '') + '</div>';
  }

  /* ---------------- 各板块渲染 ---------------- */
  function secOverview(model, s, tpl) {
    const o = model.meta.other.name, m = model.meta.me.name;
    const ring = C.ringChart({
      segments: [
        { label: m, value: s.counts.mine, color: tpl.theme.primary },
        { label: o, value: s.counts.other, color: '#c8d0e2' }
      ],
      center: s.counts.total,
      centerLabel: '条消息'
    });
    return '<div class="flex">' + ring +
      '<div class="statgrid">' +
      statCard(m + ' 发出', s.counts.mine, Math.round(s.counts.mineRatio * 100) + '%') +
      statCard(o + ' 发出', s.counts.other, Math.round(s.counts.otherRatio * 100) + '%') +
      statCard('日均消息', s.daily.avg, '活跃 ' + s.span.activeDays + ' 天') +
      statCard('总字数', s.text.totalChars, '平均 ' + s.text.avgChars + ' 字/条') +
      '</div></div>';
  }

  function secSpan(model, s) {
    const o = model.meta.other.name, m = model.meta.me.name;
    return '<div class="statgrid four">' +
      statCard('第一条消息', fmtTime(s.span.firstTime), s.highlights.first.text ? '「' + s.highlights.first.text.slice(0, 20) + '」' : '') +
      statCard('相伴天数', s.span.days, s.span.firstDate + ' → ' + s.span.lastDate) +
      statCard('活跃天数', s.span.activeDays, '最长连续 ' + s.streak.longestDays + ' 天') +
      statCard('最活跃一天', s.daily.max + ' 条', s.daily.maxDate) +
      '</div>';
  }

  function secMonthly(model, s, tpl) {
    const labels = s.monthly.map(function (r) { return r.label.replace('年', '/'); });
    const svg = C.barChart({
      labels: labels,
      series: [
        { name: model.meta.me.name, color: tpl.theme.primary, values: s.monthly.map(function (r) { return r.mine; }) },
        { name: model.meta.other.name, color: '#c8d0e2', values: s.monthly.map(function (r) { return r.other; }) }
      ]
    });
    return '<div class="chart">' + svg + '</div>';
  }

  function secHourly(model, s, tpl) {
    const svg = C.hourBarChart({ values: s.hours.map(function (r) { return r.total; }), color: tpl.theme.primary });
    return '<div class="chart">' + svg + '</div>';
  }

  function secHeatmap(model, s, tpl) {
    const svg = C.heatmapChart({ days: s.heatmap.days, cells: s.heatmap.cells, color: tpl.theme.primary });
    return '<div class="chart">' + svg + '</div><p class="note">颜色越深代表该时段消息越多（按消息原始时区统计）。</p>';
  }

  function secLateNight(model, s) {
    const ratio = Math.round(s.lateNight.ratio * 100);
    return '<div class="quote">' + s.lateNight.count + ' 条消息发生在凌晨 0–5 点，占全部消息的 ' + ratio + '%。' +
      (s.lateNight.count > 0 ? '深夜的每一句，都是白天没说完的话。' : '作息规律，是个乖宝宝。') + '</div>' +
      '<div class="statgrid three">' +
      statCard('深夜消息', s.lateNight.count, ratio + '%') +
      statCard('我发出的', s.lateNight.mine, '') +
      statCard('对方发出的', s.lateNight.other, '') +
      '</div>';
  }

  function secEmojis(model, s, tpl) {
    if (!s.emojis.length) return '<p class="note">这段聊天里没有出现 emoji。</p>';
    const svg = C.hBarChart({
      items: s.emojis.slice(0, 10).map(function (e) { return { label: '', emoji: e.char, value: e.count }; }),
      color: tpl.theme.primary
    });
    return '<div class="chart">' + svg + '</div>';
  }

  function secStickers(model, s, tpl) {
    if (!s.stickers.length) return '<p class="note">这段聊天里没有表情包记录。</p>';
    const icons = ['✨', '🌟', '💫', '🎈', '🎀', '🪄', '🫧', '🌈', '🎉'];
    const hasImg = s.stickers.some(function (st) { return !!st.img; });
    let html = '<div class="sticker-wall">';
    s.stickers.slice(0, 10).forEach(function (st, i) {
      html += '<div class="sticker-chip">' +
        (st.img
          ? '<img class="sticker-img" src="' + st.img + '" alt="' + esc(st.name) + '">'
          : '<div class="sticker-ico">' + esc(st.emoji || icons[i % icons.length]) + '</div>') +
        '<div class="sticker-name">' + esc(st.name) + '</div>' +
        '<div class="sticker-count">×' + st.count + '</div>' +
        '</div>';
    });
    html += '</div><p class="note">共 ' + s.stickers.reduce(function (a, b) { return a + b.count; }, 0) + ' 个表情包记录。' +
      (hasImg ? '已内嵌真实表情包图片。' : '微信导出只保留「动画表情」占位符，不包含表情包图片本体；若导出包含表情包文件（如 gif），用「选择导出文件夹」导入即可显示真实图片。') +
      '</p>';
    return html;
  }

  function secSpeakers(model, s, tpl) {
    const top = (s.speakers && s.speakers.top) || [];
    if (!top.length) return '<p class="note">暂无发言人数据。</p>';
    const svg = C.hBarChart({
      items: top.slice(0, 8).map(function (p) { return { label: p.name, value: p.count }; }),
      color: tpl.theme.primary
    });
    return '<div class="statgrid three">' +
      statCard('群成员', s.speakers.total, '') +
      statCard('活跃成员', s.speakers.active, '') +
      statCard('话痨担当', top[0].name, top[0].count + ' 条 · ' + Math.round(top[0].ratio * 100) + '%') +
      '</div><div class="chart">' + svg + '</div>';
  }

  function secEmotion(model, s, tpl) {
    const emo = s.emotion || { overall: { pos: 0, neg: 0, neutral: 0 }, monthly: [], happiest: { date: '', score: 0 }, saddest: { date: '', score: 0 } };
    const svg = emo.monthly.length ? C.barChart({
      labels: emo.monthly.map(function (r) { return r.label.replace('年', '/'); }),
      series: [
        { name: '积极', color: '#F279A6', values: emo.monthly.map(function (r) { return r.pos; }) },
        { name: '消极', color: '#94A3B8', values: emo.monthly.map(function (r) { return r.neg; }) }
      ]
    }) : '';
    return '<div class="statgrid three">' +
      statCard('积极消息', emo.overall.pos, '') +
      statCard('消极消息', emo.overall.neg, '') +
      statCard('中性消息', emo.overall.neutral, '') +
      '</div>' +
      (svg ? '<div class="chart">' + svg + '</div>' : '<p class="note">情感样本不足。</p>') +
      (emo.happiest.date || emo.saddest.date
        ? '<div class="quote">😊 最开心的一天：' + esc(emo.happiest.date) + '（+' + emo.happiest.score + '）<br>😢 最 emo 的一天：' + esc(emo.saddest.date) + '（' + emo.saddest.score + '）</div>'
        : '') +
      '<p class="note">基于本地情感词典逐条打分，完全离线、不联网。</p>';
  }

  function secPhotos(model, s) {
    const photos = (s.media && s.media.photos) || [];
    if (!photos.length) return '<p class="note">本次导出未包含图片文件（只有占位符），无法展示真实图片。用「选择导出文件夹」导入可内嵌图片。</p>';
    /* 按讨论热度取前 5 张 */
    const top = photos.slice().sort(function (a, b) { return b.heat - a.heat; }).slice(0, 5);
    let html = '<div class="photo-wall">';
    top.forEach(function (p, i) {
      html += '<div class="photo-card">' +
        '<img class="photo" src="' + p.dataUrl + '" alt="聊天图片">' +
        '<div class="photo-meta">' +
        '<span class="photo-rank">#' + (i + 1) + '</span>' +
        '<span class="photo-heat">🔥 ' + p.heat + ' 条讨论</span>' +
        '</div></div>';
    });
    html += '</div><p class="note">按「图片发出后 30 分钟内的讨论消息数」排序，展示热度前 ' + top.length + ' 张（共 ' + s.media.images + ' 张图片）。</p>';
    return html;
  }

  function secTextWords(model, s, tpl) {
    const words = s.text.topWords.slice(0, 10);
    const svg = words.length ? C.hBarChart({ items: words.map(function (w) { return { label: w.word, value: w.count }; }), color: tpl.theme.primary }) : '';
    return '<div class="statgrid three">' +
      statCard('总字数', s.text.totalChars, '我 ' + s.text.mineChars + ' · 对方 ' + s.text.otherChars) +
      statCard('平均每条', s.text.avgChars + ' 字', '') +
      statCard('最长一句话', s.text.longest.chars + ' 字', s.text.longest.peerName + ' · ' + fmtTime(s.text.longest.time)) +
      '</div>' +
      (words.length ? '<div class="chart">' + svg + '</div>' : '<p class="note">文本量不足，暂无法统计高频词。</p>') +
      (s.text.longest.text ? '<div class="quote">最长的一句话：<br>「' + esc(s.text.longest.text.slice(0, 160)) + '」</div>' : '');
  }

  function secWordCloud(model, s, tpl) {
    const words = s.text.topWords.slice(0, 16);
    if (!words.length) return '<p class="note">文本量不足，暂无词云。</p>';
    const svg = C.wordCloud({
      items: words.map(function (w) { return { label: w.word, value: w.count }; }),
      colors: [tpl.theme.primary, tpl.theme.accent, '#8F6FF0', '#22B8A6', '#F59E42', '#5B8DEF']
    });
    return svg;
  }

  function secReply(model, s) {
    const f = s.reply.fastest;
    return '<div class="statgrid four">' +
      statCard('我的平均回复', fmtDur(s.reply.mineAvgSec), '中位数 ' + fmtDur(s.reply.mineMedianSec)) +
      statCard('对方平均回复', fmtDur(s.reply.otherAvgSec), '中位数 ' + fmtDur(s.reply.otherMedianSec)) +
      statCard('史上最快回复', fmtDur(f.sec), f.peerName + ' · ' + fmtTime(f.time)) +
      statCard('主动指数', s.initiative.mine + ' : ' + s.initiative.other, '我占 ' + Math.round(s.initiative.mineRatio * 100) + '%') +
      '</div>';
  }

  function secInitiative(model, s, tpl) {
    const svg = C.barChart({
      labels: [model.meta.me.name + '（我）', model.meta.other.name],
      series: [{ name: '发起会话次数', color: tpl.theme.primary, values: [s.initiative.mine, s.initiative.other] }]
    });
    return '<div class="chart">' + svg + '</div><p class="note">间隔超过 4 小时后再次开口，记为一次「主动发起会话」。</p>';
  }

  function secSilence(model, s) {
    return '<div class="quote">最长的一次沉默持续了 <b>' + fmtGap(s.silence.longest) + '</b>（' +
      fmtTime(s.silence.longest.from) + ' → ' + fmtTime(s.silence.longest.to) + '）。' +
      (s.silence.current.days || s.silence.current.hours
        ? '当前已 ' + fmtGap(s.silence.current) + ' 没有新消息。'
        : '目前仍在热聊中！') + '</div>';
  }

  function secStreak(model, s) {
    return '<div class="statgrid three">' +
      statCard('最长连续活跃', s.streak.longestDays + ' 天', s.streak.longestStart + ' → ' + s.streak.longestEnd) +
      statCard('日均消息', s.daily.avg, '') +
      statCard('单日最高', s.daily.max + ' 条', s.daily.maxDate) +
      '</div>';
  }

  function secMedia(model, s) {
    return '<div class="statgrid four">' +
      statCard('图片', s.media.images, '') +
      statCard('语音', s.media.voice, '共 ' + fmtDur(s.media.voiceSeconds)) +
      statCard('视频', s.media.video, '') +
      statCard('文件 / 链接', s.media.files + ' / ' + s.media.links, '') +
      '</div>';
  }

  function secCalls(model, s) {
    return '<div class="statgrid three">' +
      statCard('通话次数', s.calls.count, '') +
      statCard('通话时长', fmtDur(s.calls.totalSec), '') +
      statCard('发起分布', '我 ' + s.calls.mine + ' · 对方 ' + s.calls.other, '') +
      '</div>';
  }

  function secDaily(model, s, tpl) {
    const perDay = s.daily.perDay;
    const recent = perDay.slice(-40);
    const svg = C.barChart({
      labels: recent.map(function (r) { return r.date.slice(5); }),
      series: [{ name: '消息数', color: tpl.theme.primary, values: recent.map(function (r) { return r.count; }) }]
    });
    return '<div class="statgrid three">' +
      statCard('最活跃的一天', s.daily.maxDate, s.daily.max + ' 条消息') +
      statCard('最安静的一天', (function () {
        let min = null;
        for (const r of perDay) if (!min || r.count < min.count) min = r;
        return min ? min.date : '-';
      })(), '') +
      statCard('中位数', s.daily.median + ' 条/天', '') +
      '</div><div class="chart">' + svg + '</div>';
  }

  function secHighlight(model, s, tpl) {
    const hl = s.highlights;
    return '<div class="timeline">' +
      '<div class="tl-item"><div class="tl-dot" style="background:' + tpl.theme.primary + '"></div>' +
      '<div class="tl-body"><div class="tl-time">' + fmtTime(hl.first.time) + ' · ' + esc(hl.first.peerName) + '</div>' +
      '<div class="tl-text">「' + esc(hl.first.text.slice(0, 80)) + '」</div></div></div>' +
      '<div class="tl-item"><div class="tl-dot" style="background:' + tpl.theme.accent + '"></div>' +
      '<div class="tl-body"><div class="tl-time">' + fmtTime(hl.last.time) + ' · ' + esc(hl.last.peerName) + '</div>' +
      '<div class="tl-text">「' + esc(hl.last.text.slice(0, 80)) + '」</div></div></div>' +
      '</div>';
  }

  const RENDERERS = {
    overview: secOverview, span: secSpan, monthly: secMonthly, hourly: secHourly,
    heatmap: secHeatmap, lateNight: secLateNight, emojis: secEmojis, stickers: secStickers,
    textWords: secTextWords, wordCloud: secWordCloud, reply: secReply, initiative: secInitiative,
    silence: secSilence, streak: secStreak, media: secMedia, calls: secCalls,
    daily: secDaily, highlight: secHighlight, photos: secPhotos,
    speakers: secSpeakers, emotion: secEmotion
  };

  const CSS = [
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:#2b3040;line-height:1.65;background:#f5f6fa}',
    '.cover{background:linear-gradient(135deg,PRIMARY,ACCENT);color:#fff;padding:48px 28px 40px;text-align:center}',
    '.cover .icon{font-size:52px;line-height:1}',
    '.cover h1{margin:14px 0 6px;font-size:28px;letter-spacing:2px}',
    '.cover .sub{opacity:.92;font-size:14px;margin-bottom:18px}',
    '.cover .peers{display:flex;justify-content:center;gap:34px;flex-wrap:wrap}',
    '.cover .peer{display:flex;flex-direction:column;align-items:center;gap:4px}',
    '.cover .avatar{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:28px}',
    '.cover .pname{font-size:13px;opacity:.95}',
    '.cover .meta{margin-top:16px;font-size:11px;opacity:.75}',
    '.container{max-width:780px;margin:0 auto;padding:26px 18px 48px}',
    '.opening,.closing{background:#fff;border-radius:14px;padding:20px 22px;font-size:14px;color:#4a5266;margin-bottom:16px;border:1px solid #e8ebf3;white-space:pre-line}',
    '.closing{margin-top:16px;border-left:4px solid PRIMARY}',
    'section{background:#fff;border-radius:14px;padding:20px 22px;margin-bottom:16px;border:1px solid #e8ebf3}',
    'section h2{font-size:16px;margin-bottom:14px;color:#2b3040;display:flex;align-items:center;gap:8px}',
    'section h2:before{content:"";width:4px;height:16px;border-radius:2px;background:PRIMARY}',
    '.flex{display:flex;gap:22px;align-items:center;flex-wrap:wrap}',
    '.statgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;flex:1;min-width:240px}',
    '.statgrid.three{grid-template-columns:repeat(3,1fr)}',
    '.statgrid.four{grid-template-columns:repeat(4,1fr)}',
    '@media(max-width:640px){.statgrid,.statgrid.three,.statgrid.four{grid-template-columns:repeat(2,1fr)}}',
    '.stat{background:BG;border-radius:10px;padding:12px 14px}',
    '.stat-v{font-size:20px;font-weight:700;color:PRIMARY}',
    '.stat-l{font-size:12px;color:#6a7285;margin-top:2px}',
    '.stat-s{font-size:11px;color:#8a91a3;margin-top:2px}',
    '.chart{margin:8px 0 4px}',
    '.note{font-size:12px;color:#8a91a3;margin-top:8px}',
    '.quote{background:BG;border-radius:10px;padding:14px 16px;font-size:13.5px;color:#4a5266;margin-bottom:12px;line-height:1.8}',
    '.timeline{position:relative;padding-left:22px}',
    '.tl-item{position:relative;padding:0 0 18px 14px;border-left:2px solid #e8ebf3}',
    '.tl-item:last-child{border-left-color:transparent;padding-bottom:0}',
    '.tl-dot{position:absolute;left:-6px;top:6px;width:10px;height:10px;border-radius:50%}',
    '.tl-time{font-size:12px;color:#8a91a3;margin-bottom:3px}',
    '.tl-text{font-size:14px;color:#2b3040}',
    '.sticker-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}',
    '.sticker-chip{background:BG;border:1px solid #e8ebf3;border-radius:12px;padding:12px 8px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}',
    '.sticker-ico{font-size:26px;line-height:1.2}',
    '.sticker-img{width:100%;height:64px;object-fit:contain;border-radius:8px;background:#fff}',
    '.sticker-name{font-size:12px;color:#2b3040;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.sticker-count{font-size:11px;color:PRIMARY;font-weight:600}',
    '.photo-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
    '.photo-card{background:BG;border:1px solid #e8ebf3;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px}',
    '.photo{width:100%;height:120px;object-fit:cover;border-radius:8px;display:block;background:#eef0f6}',
    '.photo-meta{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#6a7285}',
    '.photo-rank{font-weight:700;color:PRIMARY}',
    '.photo-heat{color:#d9567f;font-weight:600}',
    '@media print{body{background:#fff}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}section{break-inside:avoid;page-break-inside:avoid}footer{display:none}.photo-wall{grid-template-columns:repeat(3,1fr)}}',
    'footer{text-align:center;font-size:11px;color:#a4aab8;padding:0 0 30px}'
  ].join('\n');

  function generateHtml(rawModel, opts) {
    opts = opts || {};
    const model = NS.model && NS.model.normalizeModel ? NS.model.normalizeModel(rawModel) : rawModel;
    const s = NS.stats.analyze(model);
    const tpl = T.getTemplate(opts.template || 'general');
    const theme = tpl.theme;
    const title = opts.title || model.meta.title || (tpl.name + ' · ' + (model.meta.other.name || 'TA'));
    const subtitle = opts.subtitle || '';
    const generatedAt = opts.generatedAt ? fmtTime(opts.generatedAt) : '';
    const css = CSS.replace(/PRIMARY/g, theme.primary).replace(/ACCENT/g, theme.accent).replace(/BG/g, theme.light);
    const narration = T.narrativeOf(tpl.id);
    const me = model.meta.me, other = model.meta.other;
    const isGroup = !!(model.meta && model.meta.group);
    const coverPeers = isGroup ? (model.peers || [me, other]).slice(0, 5) : [me, other];
    const coverSub = subtitle || (isGroup && model.meta.groupName ? model.meta.groupName : '');

    let body = '<div class="container">';
    body += '<p class="opening">' + esc(narration.opening(model, s)) + '</p>';
    for (const sec of tpl.sections) {
      const r = RENDERERS[sec];
      if (!r) continue;
      body += '<section><h2>' + esc(titleOf(tpl.id, sec)) + '</h2>' + r(model, s, tpl) + '</section>';
    }
    body += '<p class="closing">' + esc(narration.closing(model, s)) + '</p>';
    body += '</div>';

    let peersHtml = '';
    for (const p of coverPeers) {
      peersHtml += '<div class="peer"><div class="avatar">' + esc(p.avatar) + '</div><div class="pname">' + esc(p.name) + '</div></div>';
    }
    const cover =
      '<div class="cover">' +
      '<div class="icon">' + tpl.icon + '</div>' +
      '<h1>' + esc(title) + '</h1>' +
      (coverSub ? '<div class="sub">' + esc(coverSub) + '</div>' : '') +
      '<div class="peers">' + peersHtml + '</div>' +
      (generatedAt ? '<div class="meta">生成时间：' + esc(generatedAt) + ' · ' + esc(tpl.name) + '</div>' : '') +
      '</div>';

    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + esc(title) + '</title>\n<style>\n' + css + '\n</style>\n</head>\n<body>\n' +
      cover + body +
      '<footer>由「聊天记录报告生成器」本地生成 · 数据未离开设备</footer>\n</body>\n</html>';
  }

  NS.html = { generateHtml: generateHtml };
})();


/* ===== md.js ===== */
/**
 * ChatReport · md.js
 * generateMarkdown(model, opts) —— Markdown 报告（契约 §2.1/§4）。
 * 统计用表格，图表用 █ 字符条替代，零依赖。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatReport = globalThis.ChatReport || {});
  const T = NS.templates || {};

  function fmtTime(iso) {
    const t = (NS.model && NS.model.parseTime) ? NS.model.parseTime(iso) : null;
    if (!t) return String(iso || '');
    return t.y + '年' + t.mo + '月' + t.d + '日 ' + (t.hh < 10 ? '0' : '') + t.hh + ':' + (t.mi < 10 ? '0' : '') + t.mi;
  }
  function fmtDur(sec) {
    sec = Math.round(sec || 0);
    if (sec < 60) return sec + ' 秒';
    if (sec < 3600) return Math.round(sec / 60) + ' 分钟';
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }
  function fmtGap(g) { return g.days ? g.days + ' 天 ' + g.hours + ' 小时' : g.hours + ' 小时'; }
  function bar(v, max) {
    const n = max > 0 ? Math.max(1, Math.round((v / max) * 24)) : 1;
    return '█'.repeat(Math.min(24, n));
  }
  function table(head, rows) {
    let out = '| ' + head.join(' | ') + ' |\n|' + head.map(function () { return ' --- '; }).join('|') + '|\n';
    for (const r of rows) out += '| ' + r.join(' | ') + ' |\n';
    return out;
  }

  const SECTION_TITLES = {
    overview: '消息总览',
    span: { love: '相识起点', family: '陪伴时长', friendship: '友谊时长', general: '时间跨度' },
    monthly: '月度趋势',
    hourly: '24 小时活跃分布',
    heatmap: '活跃时段分布',
    lateNight: { love: '深夜聊天', family: '深夜牵挂', friendship: '熬夜战友', general: '深夜消息' },
    stickers: { love: 'TA 最爱的表情包', family: '最常用的表情包', friendship: '最常用的表情包', general: '最常用的表情包' },
    emojis: '最常用 Emoji',
    textWords: { love: '聊天里的高频词', family: '高频词', friendship: '互怼时刻', general: '高频词' },
    wordCloud: '词云',
    reply: '回复速度与主动指数',
    initiative: '主动指数',
    silence: { love: '最长沉默', family: '最长沉默', friendship: '沉默考验', general: '最长沉默' },
    streak: '连续活跃纪录',
    media: { family: '最常分享', general: '媒体分享统计' },
    photos: '照片墙',
    speakers: '发言排行',
    emotion: '情感趋势',
    calls: { family: '通话与语音统计', general: '通话统计' },
    daily: { friendship: '最活跃的一天', general: '最活跃的一天' },
    highlight: '高光时刻'
  };
  function titleOf(tplId, sec) {
    const t = SECTION_TITLES[sec];
    if (!t) return sec;
    if (typeof t === 'string') return t;
    return t[tplId] || t.general || sec;
  }

  function secOverview(model, s) {
    return table(['指标', '数值'], [
      ['消息总数', s.counts.total + ' 条'],
      [model.meta.me.name + ' 发出', s.counts.mine + ' 条（' + Math.round(s.counts.mineRatio * 100) + '%）'],
      [model.meta.other.name + ' 发出', s.counts.other + ' 条（' + Math.round(s.counts.otherRatio * 100) + '%）'],
      ['日均消息', s.daily.avg + ' 条/天'],
      ['总字数', s.text.totalChars + ' 字（平均 ' + s.text.avgChars + ' 字/条）']
    ]);
  }
  function secSpan(model, s) {
    return table(['指标', '数值'], [
      ['第一条消息', fmtTime(s.span.firstTime)],
      ['最后一条消息', fmtTime(s.span.lastTime)],
      ['相伴天数', s.span.days + ' 天（' + s.span.firstDate + ' → ' + s.span.lastDate + '）'],
      ['活跃天数', s.span.activeDays + ' 天'],
      ['最活跃一天', s.daily.maxDate + '（' + s.daily.max + ' 条）']
    ]);
  }
  function secMonthly(model, s) {
    const max = s.monthly.reduce(function (a, r) { return Math.max(a, r.total); }, 1);
    return table(['月份', model.meta.me.name, model.meta.other.name, '合计', '热度'],
      s.monthly.map(function (r) { return [r.label, r.mine, r.other, r.total, bar(r.total, max)]; }));
  }
  function secHourly(model, s) {
    const max = s.hours.reduce(function (a, r) { return Math.max(a, r.total); }, 1);
    const rows = [];
    for (let h = 0; h < 24; h += 2) {
      const t = s.hours[h].total + (s.hours[h + 1] ? s.hours[h + 1].total : 0);
      rows.push([String(h).padStart(2, '0') + ':00-' + String(h + 1).padStart(2, '0') + ':59', t, bar(t, max)]);
    }
    return table(['时段', '消息数', '热度'], rows);
  }
  function secHeatmap(model, s) {
    const max = s.weekday.reduce(function (a, r) { return Math.max(a, r.total); }, 1);
    return table(['星期', '消息数', '热度'],
      s.weekday.map(function (r) { return [r.label, r.total, bar(r.total, max)]; }));
  }
  function secLateNight(model, s) {
    return table(['指标', '数值'], [
      ['凌晨 0–5 点消息', s.lateNight.count + ' 条（占 ' + Math.round(s.lateNight.ratio * 100) + '%）'],
      ['我发出的深夜消息', s.lateNight.mine + ' 条'],
      ['对方发出的深夜消息', s.lateNight.other + ' 条']
    ]);
  }
  function secEmojis(model, s) {
    if (!s.emojis.length) return '这段聊天里没有出现 emoji。\n';
    const max = s.emojis[0].count;
    return table(['表情', '次数', '热度'], s.emojis.slice(0, 10).map(function (e) {
      return [e.char, e.count, bar(e.count, max)];
    }));
  }
  function secStickers(model, s) {
    if (!s.stickers.length) return '这段聊天里没有表情包记录。\n';
    const max = s.stickers[0].count;
    return table(['表情包', '次数', '热度'], s.stickers.slice(0, 10).map(function (st) {
      return [(st.emoji ? st.emoji + ' ' : '') + st.name, st.count, bar(st.count, max)];
    }));
  }
  function secTextWords(model, s) {
    const head = table(['指标', '数值'], [
      ['总字数', s.text.totalChars + ' 字（我 ' + s.text.mineChars + ' · 对方 ' + s.text.otherChars + '）'],
      ['最长一句话', s.text.longest.chars + ' 字（' + s.text.longest.peerName + ' · ' + fmtTime(s.text.longest.time) + '）']
    ]);
    if (!s.text.topWords.length) return head + '\n文本量不足，暂无法统计高频词。\n';
    const max = s.text.topWords[0].count;
    return head + '\n' + table(['高频词', '次数', '热度'], s.text.topWords.slice(0, 10).map(function (w) {
      return [w.word, w.count, bar(w.count, max)];
    }));
  }
  function secReply(model, s) {
    const f = s.reply.fastest;
    return table(['指标', '数值'], [
      ['我的平均回复', fmtDur(s.reply.mineAvgSec) + '（中位数 ' + fmtDur(s.reply.mineMedianSec) + '）'],
      ['对方平均回复', fmtDur(s.reply.otherAvgSec) + '（中位数 ' + fmtDur(s.reply.otherMedianSec) + '）'],
      ['史上最快回复', fmtDur(f.sec) + '（' + f.peerName + ' · ' + fmtTime(f.time) + '）']
    ]);
  }
  function secWordCloud(model, s) {
    if (!s.text.topWords.length) return '文本量不足，暂无词云。\n';
    return '词云图仅在内嵌 HTML 版中展示（本 Markdown 版以文字统计代替）。\n';
  }
  function secSpeakers(model, s) {
    const top = (s.speakers && s.speakers.top) || [];
    if (!top.length) return '暂无发言人数据。\n';
    const max = top[0].count || 1;
    return '共 ' + s.speakers.total + ' 位成员、' + s.speakers.active + ' 位活跃。\n\n' +
      table(['成员', '消息数', '占比', '热度'], top.slice(0, 8).map(function (p) {
        return [p.name, p.count, Math.round(p.ratio * 100) + '%', bar(p.count, max)];
      }));
  }
  function secEmotion(model, s) {
    const emo = s.emotion || { overall: { pos: 0, neg: 0, neutral: 0 }, monthly: [], happiest: { date: '', score: 0 }, saddest: { date: '', score: 0 } };
    let out = table(['类型', '数量'], [
      ['积极消息', emo.overall.pos + ' 条'],
      ['消极消息', emo.overall.neg + ' 条'],
      ['中性消息', emo.overall.neutral + ' 条']
    ]);
    if (emo.monthly.length) {
      out += '\n' + table(['月份', '积极', '消极'], emo.monthly.map(function (r) {
        return [r.label, r.pos, r.neg];
      }));
    }
    if (emo.happiest.date || emo.saddest.date) {
      out += '\n- 😊 最开心的一天：' + emo.happiest.date + '（+' + emo.happiest.score + '）\n';
      out += '- 😢 最 emo 的一天：' + emo.saddest.date + '（' + emo.saddest.score + '）\n';
    }
    out += '\n> 基于本地情感词典逐条打分，完全离线。';
    return out;
  }
  function secInitiative(model, s) {
    const max = Math.max(s.initiative.mine, s.initiative.other, 1);
    return table(['谁', '发起会话次数', '热度'], [
      [model.meta.me.name, s.initiative.mine, bar(s.initiative.mine, max)],
      [model.meta.other.name, s.initiative.other, bar(s.initiative.other, max)]
    ]) + '\n> 间隔超过 4 小时后的第一条消息记为一次主动发起。';
  }
  function secSilence(model, s) {
    return table(['指标', '数值'], [
      ['最长沉默', fmtGap(s.silence.longest) + '（' + fmtTime(s.silence.longest.from) + ' → ' + fmtTime(s.silence.longest.to) + '）'],
      ['当前状态', (s.silence.current.days || s.silence.current.hours) ? '已 ' + fmtGap(s.silence.current) + ' 无新消息' : '仍在热聊中']
    ]);
  }
  function secStreak(model, s) {
    return table(['指标', '数值'], [
      ['最长连续活跃', s.streak.longestDays + ' 天（' + s.streak.longestStart + ' → ' + s.streak.longestEnd + '）'],
      ['单日最高', s.daily.max + ' 条（' + s.daily.maxDate + '）'],
      ['日均消息', s.daily.avg + ' 条']
    ]);
  }
  function secMedia(model, s) {
    return table(['类型', '数量'], [
      ['图片', s.media.images + ' 张'],
      ['语音', s.media.voice + ' 条（共 ' + fmtDur(s.media.voiceSeconds) + '）'],
      ['视频', s.media.video + ' 个'],
      ['文件', s.media.files + ' 个'],
      ['链接', s.media.links + ' 条']
    ]);
  }
  function secPhotos(model, s) {
    const photos = (s.media && s.media.photos) || [];
    if (!photos.length) return '本次导出未包含图片文件（只有占位符）。\n';
    const top = photos.slice().sort(function (a, b) { return b.heat - a.heat; }).slice(0, 5);
    const rows = top.map(function (p, i) { return ['#' + (i + 1), p.time, p.heat + ' 条讨论']; });
    return '按图片发出后 30 分钟内讨论消息数排序，热度前 ' + top.length + ' 张（共 ' + s.media.images + ' 张图片；Markdown 版不内嵌图片）：\n\n' +
      table(['排名', '时间', '热度'], rows);
  }
  function secCalls(model, s) {
    return table(['指标', '数值'], [
      ['通话次数', s.calls.count + ' 次'],
      ['通话总时长', fmtDur(s.calls.totalSec)],
      ['发起分布', '我 ' + s.calls.mine + ' 次 · 对方 ' + s.calls.other + ' 次']
    ]);
  }
  function secDaily(model, s) {
    let min = null;
    for (const r of s.daily.perDay) if (!min || r.count < min.count) min = r;
    return table(['指标', '数值'], [
      ['最活跃的一天', s.daily.maxDate + '（' + s.daily.max + ' 条）'],
      ['最安静的一天', min ? min.date + '（' + min.count + ' 条）' : '-'],
      ['中位数', s.daily.median + ' 条/天']
    ]);
  }
  function secHighlight(model, s) {
    const h = s.highlights;
    return '1. **' + fmtTime(h.first.time) + '** · ' + h.first.peerName + '：' + h.first.text.slice(0, 80) + '\n' +
      '2. **' + fmtTime(h.last.time) + '** · ' + h.last.peerName + '：' + h.last.text.slice(0, 80) + '\n';
  }

  const RENDERERS = {
    overview: secOverview, span: secSpan, monthly: secMonthly, hourly: secHourly,
    heatmap: secHeatmap, lateNight: secLateNight, emojis: secEmojis, stickers: secStickers,
    textWords: secTextWords, wordCloud: secWordCloud, reply: secReply, initiative: secInitiative,
    silence: secSilence, streak: secStreak, media: secMedia, calls: secCalls,
    daily: secDaily, highlight: secHighlight, photos: secPhotos,
    speakers: secSpeakers, emotion: secEmotion
  };

  function generateMarkdown(rawModel, opts) {
    opts = opts || {};
    const model = NS.model && NS.model.normalizeModel ? NS.model.normalizeModel(rawModel) : rawModel;
    const s = NS.stats.analyze(model);
    const tpl = T.getTemplate(opts.template || 'general');
    const title = opts.title || model.meta.title || (tpl.name + ' · ' + (model.meta.other.name || 'TA'));
    const narration = T.narrativeOf(tpl.id);
    const me = model.meta.me, other = model.meta.other;
    const lines = [];
    lines.push('# ' + tpl.icon + ' ' + title);
    if (opts.subtitle) lines.push('> ' + opts.subtitle);
    lines.push('');
    lines.push('- 生成时间：' + (opts.generatedAt ? fmtTime(opts.generatedAt) : '-'));
    lines.push('- 双方：' + me.name + ' ↔ ' + other.name);
    if (model.meta.source && model.meta.source.adapter) lines.push('- 数据来源：' + model.meta.source.adapter + '（' + model.meta.source.platform + '）');
    lines.push('');
    lines.push('## 开场');
    lines.push(narration.opening(model, s));
    for (const sec of tpl.sections) {
      const r = RENDERERS[sec];
      if (!r) continue;
      lines.push('');
      lines.push('## ' + titleOf(tpl.id, sec));
      lines.push(r(model, s));
    }
    lines.push('');
    lines.push('## 结尾');
    lines.push(narration.closing(model, s));
    lines.push('');
    lines.push('---');
    lines.push('*由「聊天记录报告生成器」本地生成 · 数据未离开设备*');
    return lines.join('\n') + '\n';
  }

  NS.md = { generateMarkdown: generateMarkdown };
})();


/* ===== index.js ===== */
/**
 * ChatReport · index.js
 * 对外公共 API 面（契约 §2.1）。必须最后拼接。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatReport = globalThis.ChatReport || {});
  const M = NS.model || {};
  const S = NS.stats || {};
  const T = NS.templates || {};
  const H = NS.html || {};
  const D = NS.md || {};

  NS.listTemplates = T.listTemplates;
  NS.validateModel = M.validateModel;
  NS.analyze = S.analyze;
  NS.generateHtml = H.generateHtml;
  NS.generateMarkdown = D.generateMarkdown;
})();


})(typeof globalThis !== "undefined" ? globalThis : (typeof global !== "undefined" ? global : {}));
