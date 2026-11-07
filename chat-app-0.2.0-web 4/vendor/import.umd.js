/*! ChatImport UMD bundle
 * 由 adapters/build.js 自动生成，请勿手改。
 * 零依赖经典脚本：挂 globalThis.ChatImport；Node require() 后同样可用。
 */
(function (global) {
  if (typeof globalThis !== "undefined") global = globalThis;
  if (typeof global === "undefined") global = {};

/* ===== util.js ===== */
/**
 * ChatImport · util.js
 * 时间解析、id 生成、排序与统一模型组装（契约 §1/§6）。
 * 经典脚本：IIFE 挂 globalThis.ChatImport。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});

  const MESSAGE_TYPES = ['text', 'image', 'sticker', 'voice', 'video', 'file', 'link', 'system', 'call', 'forward'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** "2024-01-01 12:00:00" / "2024/1/1 12:00" / ISO / 秒级时间戳 → ISO 字符串（缺时区补 +08:00）；失败 null */
  function parseTimeStr(raw) {
    if (raw == null) return null;
    if (typeof raw === 'number') {
      const d = new Date(raw < 1e12 ? raw * 1000 : raw);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const s = String(raw).trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) + 'T' + pad2(+m[4]) + ':' + pad2(+m[5]) + ':' + pad2(m[6] ? +m[6] : 0) + '+08:00';
    }
    m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) + 'T' + pad2(+m[4]) + ':' + pad2(+m[5]) + ':' + pad2(m[6] ? +m[6] : 0) + '+08:00';
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
    if (m) {
      const off = m[7] ? (m[7] === 'Z' ? '+00:00' : (/^\+\d{2}:\d{2}$/.test(m[7]) ? m[7] : m[7].replace(/([+-]\d{2})(\d{2})/, '$1:$2'))) : '+08:00';
      return m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + off;
    }
    /* 秒级时间戳数字字符串 */
    if (/^\d{10}$/.test(s)) {
      const d = new Date(+s * 1000);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  }

  function epochOf(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /** 组装统一消息模型：排序（time 升序）、生成递增 id、规范化 meta。
   * 支持多发言人（群聊）：meta.peers = [{id,name,avatar,color}]（第一项为我），meta.group = true。 */
  function buildModel(input) {
    const meta = input.meta || {};
    const me = meta.me || {};
    const other = meta.other || {};
    let peers = [];
    if (Array.isArray(meta.peers) && meta.peers.length >= 2) {
      peers = meta.peers.map(function (p, i) {
        return {
          id: (typeof p.id === 'string' && p.id) ? p.id : ('p' + (i + 1)),
          name: (typeof p.name === 'string' && p.name) ? p.name : ('成员' + (i + 1)),
          avatar: typeof p.avatar === 'string' ? p.avatar : (i === 0 ? '🙂' : '💬'),
          color: typeof p.color === 'string' ? p.color : (i === 0 ? '#5B8DEF' : '#8A93A6')
        };
      });
    } else {
      peers = [
        {
          id: (typeof me.id === 'string' && me.id) ? me.id : 'me',
          name: (typeof me.name === 'string' && me.name) ? me.name : '我',
          avatar: typeof me.avatar === 'string' ? me.avatar : '🙂',
          color: typeof me.color === 'string' ? me.color : '#5B8DEF'
        },
        {
          id: (typeof other.id === 'string' && other.id) ? other.id : 'peer',
          name: (typeof other.name === 'string' && other.name) ? other.name : '对方',
          avatar: typeof other.avatar === 'string' ? other.avatar : '💬',
          color: typeof other.color === 'string' ? other.color : '#F279A6'
        }
      ];
    }
    const meNorm = peers[0];
    const otherNorm = peers[1];
    const peerIds = peers.map(function (p) { return p.id; });
    const RELATIONS = ['love', 'family', 'friendship', 'general', 'work', 'bestie', 'roommate', 'parent', 'group'];
    const rawMsgs = (input.messages || []).map(function (m, i) {
      const time = parseTimeStr(m.time);
      return {
        id: 'm' + String(i + 1).padStart(4, '0'),
        peerId: peerIds.indexOf(m.peerId) !== -1 ? m.peerId : otherNorm.id,
        time: time || '',
        type: MESSAGE_TYPES.indexOf(m.type) !== -1 ? m.type : 'text',
        text: typeof m.text === 'string' ? m.text : '',
        emojis: Array.isArray(m.emojis) ? m.emojis : [],
        sticker: (m.sticker && typeof m.sticker.name === 'string') ? {
          name: m.sticker.name,
          emoji: typeof m.sticker.emoji === 'string' ? m.sticker.emoji : '',
          imageFileName: typeof m.sticker.imageFileName === 'string' ? m.sticker.imageFileName : '',
          img: typeof m.sticker.img === 'string' ? m.sticker.img : ''
        } : null,
        media: (m.media && typeof m.media === 'object' && Array.isArray(m.media.types) && m.media.types.length)
          ? {
              count: (typeof m.media.count === 'number' && m.media.count > 0) ? m.media.count : 1,
              types: m.media.types,
              fileName: typeof m.media.fileName === 'string' ? m.media.fileName : '',
              dataUrl: typeof m.media.dataUrl === 'string' ? m.media.dataUrl : ''
            }
          : null,
        durationSec: typeof m.durationSec === 'number' ? m.durationSec : 0,
        replyTo: typeof m.replyTo === 'string' ? m.replyTo : null,
        _epoch: epochOf(parseTimeStr(m.time) || '')
      };
    }).filter(function (m) {
      return m.time && m.peerId; // 时间不可解析或归属不明的丢弃（契约：丢弃而非 unknown）
    });
    rawMsgs.sort(function (a, b) { return a._epoch - b._epoch; });
    const messages = rawMsgs.map(function (m, i) {
      const out = {
        id: 'm' + String(i + 1).padStart(4, '0'),
        peerId: m.peerId, time: m.time, type: m.type, text: m.text,
        emojis: m.emojis, sticker: m.sticker, media: m.media,
        durationSec: m.durationSec, replyTo: m.replyTo
      };
      return out;
    });
    const source = input.source || {};
    const model = {
      schemaVersion: 1,
      meta: {
        id: typeof meta.id === 'string' ? meta.id : '',
        title: typeof meta.title === 'string' ? meta.title : '',
        source: {
          platform: typeof source.platform === 'string' ? source.platform : 'unknown',
          adapter: typeof source.adapter === 'string' ? source.adapter : '',
          originalFile: typeof source.originalFile === 'string' ? source.originalFile : ''
        },
        exportedAt: typeof meta.exportedAt === 'string' ? meta.exportedAt : new Date().toISOString(),
        relation: RELATIONS.indexOf(meta.relation) !== -1 ? meta.relation : 'general',
        me: meNorm,
        other: otherNorm,
        group: meta.group === true,
        groupName: typeof meta.groupName === 'string' ? meta.groupName : ''
      },
      peers: peers,
      messages: messages
    };
    if (Array.isArray(meta.speakers)) model.meta.speakers = meta.speakers;
    if (Array.isArray(meta.mergedChats)) model.meta.mergedChats = meta.mergedChats;
    if (typeof meta.fileCount === 'number') model.meta.fileCount = meta.fileCount;
    /* 群聊兼容：meta 与顶层都保留 peers 引用 */
    model.meta.peers = peers;
    return model;
  }

  /** 文本内容类型识别：'[图片]' 等标记 → type */
  function classifyText(type, text) {
    const t = String(text || '').trim();
    if (type && MESSAGE_TYPES.indexOf(type) !== -1 && type !== 'text') return type;
    if (/^\[图片\]$|^\[照片\]$|^\[image\]$/i.test(t)) return 'image';
    if (/^\[语音\]$|^\[录音\]$|^\[voice\]$/i.test(t)) return 'voice';
    if (/^\[视频\]$|^\[video\]$/i.test(t)) return 'video';
    if (/^\[文件\]$|^\[file\]$/i.test(t)) return 'file';
    if (/^\[链接\]$|^\[分享\]$/i.test(t)) return 'link';
    if (/^\[通话\]$|^\[语音通话\]$|^\[视频通话\]$|^\[未接听\]$/i.test(t)) return 'call';
    if (/^\(系统消息\)|^系统消息|的打招呼内容$|^以上是打招呼内容/.test(t)) return 'system';
    return 'text';
  }

  /** 从文本提取去重 emoji（按出现顺序） */
  function extractEmojis(text) {
    const out = [];
    if (!text) return out;
    try {
      const re = /\p{Extended_Pictographic}/gu;
      let m;
      while ((m = re.exec(text))) {
        if (out.indexOf(m[0]) < 0) out.push(m[0]);
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  NS.util = {
    MESSAGE_TYPES: MESSAGE_TYPES,
    parseTimeStr: parseTimeStr,
    buildModel: buildModel,
    classifyText: classifyText,
    extractEmojis: extractEmojis,
    mergeModels: mergeModels,
    mergeByOverlap: mergeByOverlap,
    filterByRange: filterByRange
  };

  /* ---------- 重叠截图的上下文对齐合并 ---------- */

  /** 归一化消息文本签名：去空白、小写（OCR 容差基础） */
  function sigOf(msg) {
    return String(msg && msg.text ? msg.text : '').replace(/\s+/g, '').toLowerCase();
  }

  /** 字符 bigram Jaccard 相似度（0..1），容忍 OCR 个别错字 */
  function simOf(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    const ga = new Set(), gb = new Set();
    for (let i = 0; i < a.length - 1; i++) ga.add(a.slice(i, i + 2));
    for (let i = 0; i < b.length - 1; i++) gb.add(b.slice(i, i + 2));
    if (!ga.size || !gb.size) return a === b ? 1 : 0;
    let inter = 0;
    for (const x of ga) if (gb.has(x)) inter++;
    return (2 * inter) / (ga.size + gb.size);
  }

  const OVERLAP_SIM = 0.7;
  const OVERLAP_MIN_RUN = 2;

  function hasRealTime(m) {
    return typeof m.time === 'string' && m.time.slice(11, 16) !== '12:00'; /* 12:00 为兜底时间 */
  }
  /** 重叠区逐条取更优版本：文本更长优先；同长则带真实时间者优先 */
  function betterMsg(a, b) {
    const la = String(a && a.text || '').length;
    const lb = String(b && b.text || '').length;
    if (la !== lb) return la > lb ? a : b;
    const ta = hasRealTime(a), tb = hasRealTime(b);
    if (ta !== tb) return ta ? a : b;
    return a;
  }

  /** 锚点时间兼容：双方都有真实时间则必须一致（防同前缀文本误锚）；至少一侧无真实时间则放宽 */
  function timeCompatible(a, b) {
    const ta = hasRealTime(a), tb = hasRealTime(b);
    if (ta && tb) return String(a.time).slice(11, 16) === String(b.time).slice(11, 16);
    return true;
  }

  /** 找两条消息序列的最长连续重叠区（bigram 相似度 ≥ 阈值 且时间兼容 的连续锚定链） */
  function findOverlapRun(m1, m2) {
    const s1 = m1.map(sigOf), s2 = m2.map(sigOf);
    let best = { i0: -1, j0: -1, len: 0 };
    for (let i = 0; i < m1.length; i++) {
      for (let j = 0; j < m2.length; j++) {
        if (simOf(s1[i], s2[j]) < OVERLAP_SIM) continue;
        if (!timeCompatible(m1[i], m2[j])) continue;
        let k = 0;
        while (i + k < m1.length && j + k < m2.length &&
               simOf(s1[i + k], s2[j + k]) >= OVERLAP_SIM &&
               timeCompatible(m1[i + k], m2[j + k])) k++;
        if (k > best.len) best = { i0: i, j0: j, len: k };
      }
    }
    return best;
  }

  /** 两份模型按重叠区对齐合并（A 在前 B 在后；允许 B 包含在 A 中） */
  function mergeTwoByOverlap(A, B) {
    const m1 = A.messages || [], m2 = B.messages || [];
    if (!m1.length) return B;
    if (!m2.length) return A;
    const run = findOverlapRun(m1, m2);
    let chosen;
    if (run.len >= OVERLAP_MIN_RUN) {
      const overlapA = m1.slice(run.i0, run.i0 + run.len);
      const overlapB = m2.slice(run.j0, run.j0 + run.len);
      const region = [];
      for (let k = 0; k < run.len; k++) region.push(betterMsg(overlapA[k], overlapB[k]));
      chosen = m1.slice(0, run.i0).concat(region).concat(m2.slice(run.j0 + run.len));
    } else {
      chosen = m1.concat(m2);
    }
    /* 拷贝并补齐兜底时间（12:00 为“无时间”标记，用前一条真实时间回填以保持时序） */
    const copies = chosen.map(function (m) {
      return {
        time: m.time, peerId: m.peerId, type: m.type, text: m.text,
        emojis: m.emojis, sticker: m.sticker, media: m.media, durationSec: m.durationSec
      };
    });
    let lastReal = '';
    for (const c of copies) {
      if (hasRealTime(c)) lastReal = c.time;
      else if (lastReal) c.time = lastReal;
    }
    const merged = buildModel({
      meta: A.meta,
      source: {
        platform: (A.meta.source && A.meta.source.platform) || 'unknown',
        adapter: ((A.meta.source && A.meta.source.adapter) || '') + '+overlap',
        originalFile: '对齐合并'
      },
      messages: copies
    });
    const speakers = [];
    [A, B].forEach(function (mm) {
      if (mm.meta && Array.isArray(mm.meta.speakers)) {
        mm.meta.speakers.forEach(function (s) { if (s && speakers.indexOf(s) === -1) speakers.push(s); });
      }
    });
    if (speakers.length) merged.meta.speakers = speakers;
    return merged;
  }

  /** 多份模型（同一聊天的多张重叠截图/多次导出）依次对齐合并 */
  function mergeByOverlap(models) {
    if (!Array.isArray(models) || !models.length) return null;
    let acc = models[0];
    for (let i = 1; i < models.length; i++) {
      acc = mergeTwoByOverlap(acc, models[i]);
    }
    return acc;
  }

  /**
   * 按日期范围筛选消息（含起止两天）。
   * fromDate/toDate 为 'YYYY-MM-DD'（按 +08:00 解释）或 null 表示不限。
   */
  function filterByRange(model, fromDate, toDate) {
    if (!model) return model;
    const fromMs = fromDate ? new Date(fromDate + 'T00:00:00+08:00').getTime() : -Infinity;
    const toMs = toDate ? new Date(toDate + 'T23:59:59+08:00').getTime() : Infinity;
    const msgs = (model.messages || []).filter(function (m) {
      const t = new Date(m.time).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });
    const filtered = buildModel({
      meta: model.meta,
      source: (model.meta && model.meta.source) || undefined,
      messages: msgs.map(function (m) {
        return {
          time: m.time, peerId: m.peerId, type: m.type, text: m.text,
          emojis: m.emojis, sticker: m.sticker, media: m.media, durationSec: m.durationSec
        };
      })
    });
    if (model.meta && model.meta.speakers) filtered.meta.speakers = model.meta.speakers;
    if (model.meta && model.meta.mergedChats) filtered.meta.mergedChats = model.meta.mergedChats;
    if (model.meta && model.meta.fileCount) filtered.meta.fileCount = model.meta.fileCount;
    return filtered;
  }

  /**
   * 合并多份统一消息模型（同一个人不同时间段的多批导出）：
   * - 按 time 升序排序、重新编号 id
   * - 按 (time+peerId+type+text) 去重，避免多批导出重叠部分重复计入
   * - 保留 base 的 meta（title/me/other），汇总 speakers 与 mergedChats 供界面展示
   */
  function mergeModels(models) {
    if (!Array.isArray(models) || !models.length) return null;
    const base = models[0];
    const speakers = [];
    const chatNames = {};
    const seen = {};
    const messages = [];
    for (const m of models) {
      if (!m || !m.meta) continue;
      if (Array.isArray(m.meta.speakers)) {
        m.meta.speakers.forEach(function (s) { if (s && speakers.indexOf(s) === -1) speakers.push(s); });
      }
      if (m.meta.other && m.meta.other.name) chatNames[m.meta.other.name] = true;
      for (const msg of (m.messages || [])) {
        if (!msg || typeof msg.time !== 'string') continue;
        const key = msg.time + '|' + (msg.peerId || '') + '|' + (msg.type || '') + '|' + (msg.text || '');
        if (seen[key]) continue;
        seen[key] = true;
        messages.push({
          time: msg.time,
          peerId: msg.peerId === 'me' ? 'me' : 'peer',
          type: msg.type,
          text: msg.text,
          emojis: msg.emojis,
          sticker: msg.sticker,
          media: msg.media,
          durationSec: msg.durationSec || 0
        });
      }
    }
    const merged = buildModel({
      meta: {
        id: (base.meta.id || 'merged') + '-merged',
        title: base.meta.title,
        relation: base.meta.relation,
        me: base.meta.me,
        other: base.meta.other
      },
      source: {
        platform: (base.meta.source && base.meta.source.platform) || 'unknown',
        adapter: ((base.meta.source && base.meta.source.adapter) || '') + '+merged',
        originalFile: '合并 ' + models.length + ' 份记录'
      },
      messages: messages
    });
    merged.meta.speakers = speakers;
    merged.meta.mergedChats = Object.keys(chatNames);
    merged.meta.fileCount = models.length;
    return merged;
  }
})();


/* ===== detect.js ===== */
/**
 * ChatImport · detect.js
 * 导出内容格式识别（契约 §6.5）。返回 { adapter, confidence } 或 { adapter: null, confidence: 0 }。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});

  function looksLikeQQTxt(text) {
    return text.indexOf('消息记录（此消息记录为文本格式') !== -1 ||
      text.indexOf('消息对象:') !== -1 ||
      text.indexOf('消息分组:') !== -1;
  }

  function tryJson(text) {
    try { return { ok: true, data: JSON.parse(text) }; } catch (e) { return { ok: false, data: null }; }
  }

  function looksLikeOneBot(data) {
    if (Array.isArray(data)) {
      return data.some(function (e) { return e && (e.post_type === 'message' || (e.self_id !== undefined && e.message)); });
    }
    if (data && typeof data === 'object') {
      if (Array.isArray(data.messages) && data.messages.some(function (m) { return m && m.sender && m.message; })) return true;
      if (data.post_type === 'message') return true;
      if (data.self_id !== undefined && data.user_id !== undefined && Array.isArray(data.messages)) return true;
    }
    return false;
  }

  function detect(raw) {
    if (typeof raw === 'object' && raw !== null) {
      return looksLikeOneBot(raw) ? { adapter: 'onebot-json', confidence: 0.9 } : { adapter: null, confidence: 0 };
    }
    if (typeof raw !== 'string') return { adapter: null, confidence: 0 };
    const text = raw;
    if (looksLikeQQTxt(text)) return { adapter: 'qq-txt', confidence: 0.95 };
    const json = tryJson(text);
    if (json.ok && looksLikeOneBot(json.data)) return { adapter: 'onebot-json', confidence: 0.9 };
    const lines = text.split(/\r?\n/);
    const first = (lines[0] || '').trim();
    if (first.includes('时间') && first.includes('内容') && (first.includes('发送者') || first.includes('昵称')) && first.includes(',')) {
      return { adapter: 'wechat-csv', confidence: 0.85 };
    }
    /* 微信合并转发原生 txt：中文日期行「2026年11月1日 13:03」成块出现 */
    const cnDateRe = /^\d{4}年\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2}/;
    let cnDates = 0;
    for (const ln of lines) if (cnDateRe.test(ln.trim())) cnDates++;
    if (cnDates >= 2) return { adapter: 'wechat-forward', confidence: 0.9 };
    const timeLineRe = /^\d{4}[-/]\d{1,2}[-/]\d{1,2} \d{1,2}:\d{2}/;
    let matched = 0, content = 0;
    for (const ln of lines) {
      if (timeLineRe.test(ln.trim())) matched++;
      else if (ln.trim()) content++;
    }
    if (matched > 0 && matched + content > 0 && matched / (matched + content) >= 0.2 && !looksLikeQQTxt(text)) {
      return { adapter: 'wechat-txt', confidence: 0.8 };
    }
    return { adapter: null, confidence: 0 };
  }

  NS.detect = detect;
})();


/* ===== qqtxt.js ===== */
/**
 * ChatImport · qqtxt.js
 * 解析 QQ 消息管理器导出 txt（契约 §6.1）。
 * 行格式：`2023-09-01 21:34:12 小美(123456789)` 开启一条消息，内容为后续行直到下一时间行/分隔线。
 *
 * 双方身份推断（重要）：
 *   1) opts.me / opts.other 显式指定优先；
 *   2) "消息对象:xxx" 行确定"对方"；
 *   3) 一对一聊天中，除"对方"以外的发送者即"我"（即使没有提供任何 opts 也能正确分侧）。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});
  const U = NS.util || {};

  const TIME_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(.+?)\((\d+)\)$/;
  const SEP_RE = /^=+$/;
  const SKIP_HEADERS = ['消息记录', '消息分组', '消息对象', '日期', '时间', '------'];

  /** 返回 'me' | 'other'；otherName/otherQQ 为消息对象（对方）线索 */
  function resolvePeer(name, qq, opts, otherName, otherQQ) {
    const me = opts.me || {};
    const other = opts.other || {};
    /* 1) 显式指定优先级最高 */
    if (typeof me.name === 'string' && me.name && me.name === name) return 'me';
    if (typeof me.id === 'string' && me.id && me.id === qq) return 'me';
    if (typeof me.pattern === 'string' && me.pattern) {
      try { if (new RegExp(me.pattern).test(name)) return 'me'; } catch (e) { /* ignore */ }
    }
    if (typeof other.name === 'string' && other.name && other.name === name) return 'other';
    if (typeof other.id === 'string' && other.id && other.id === qq) return 'other';
    /* 2) 消息对象（对方）匹配 */
    if (otherName && name === otherName) return 'other';
    if (otherQQ && qq === otherQQ) return 'other';
    /* 3) 一对一聊天：对方已确定，其余发送者即“我” */
    if (otherName) return 'me';
    /* 4) 无任何线索：兜底归 other */
    return 'other';
  }

  function parseQQTxt(text, opts) {
    opts = opts || {};
    const lines = String(text || '').split(/\r?\n/);
    const raw = []; /* { time, name, qq, lines:[] } */
    let otherName = (opts.other && opts.other.name) || '';
    let otherQQ = (opts.other && opts.other.id) || '';
    let cur = null;
    const flush = function () {
      if (cur) {
        if (cur.lines.join('\n').trim()) raw.push(cur);
        cur = null;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = TIME_RE.exec(line);
      if (m) {
        flush();
        const time = U.parseTimeStr(m[1]);
        if (time) cur = { time: time, name: m[2], qq: m[3], lines: [] };
        continue;
      }
      const objMatch = /^消息对象[:：]\s*(.+)$/.exec(line);
      if (objMatch && !otherName) { otherName = objMatch[1].trim(); continue; }
      if (SEP_RE.test(line) || SKIP_HEADERS.some(function (h) { return line.startsWith(h); })) continue;
      if (cur) cur.lines.push(rawLine);
    }
    flush();

    /* 对方名缺失时：取出现次数最多、且不是“我”/opts.me.name 的发送者 */
    if (!otherName) {
      const counts = {};
      for (const e of raw) counts[e.name] = (counts[e.name] || 0) + 1;
      const meName = (opts.me && opts.me.name) || '我';
      const names = Object.keys(counts).filter(function (n) { return n !== '我' && n !== meName; });
      names.sort(function (a, b) { return counts[b] - counts[a]; });
      if (names.length) otherName = names[0];
    }
    if (otherName && !otherQQ) {
      const hit = raw.find(function (e) { return e.name === otherName; });
      if (hit) otherQQ = hit.qq;
    }

    const messages = [];
    for (const e of raw) {
      const content = e.lines.join('\n').trim();
      if (!content) continue;
      const side = resolvePeer(e.name, e.qq, opts, otherName, otherQQ);
      const type = U.classifyText(null, content);
      messages.push({
        time: e.time,
        peerId: side === 'me' ? 'me' : 'peer',
        type: type,
        text: type === 'text' ? content
          : type === 'image' ? '[图片]'
          : type === 'voice' ? '[语音]'
          : type === 'video' ? '[视频]'
          : type === 'file' ? '[文件]'
          : type === 'call' ? '[通话]'
          : type === 'system' ? '[系统消息]' : content,
        emojis: U.extractEmojis(content),
        sticker: null,
        media: (type === 'image' || type === 'voice' || type === 'video' || type === 'file') ? { count: 1, types: [type] } : null,
        durationSec: 0
      });
    }

    const meName = (opts.me && opts.me.name) || '我';
    const model = U.buildModel({
      meta: {
        title: (opts.title || '') || ('与' + (otherName || '对方') + '的聊天记录'),
        relation: opts.relation,
        me: { id: 'me', name: meName },
        other: { id: 'peer', name: otherName || '对方', color: '#F279A6' }
      },
      source: { platform: 'qq', adapter: 'qq-txt', originalFile: (opts.originalFile || '') },
      messages: messages
    });
    /* 供导入界面列出「我是谁」选项 */
    const speakers = [];
    for (const e of raw) {
      const n = String(e.name || '').trim();
      if (n && speakers.indexOf(n) === -1) speakers.push(n);
    }
    model.meta.speakers = speakers;
    return model;
  }

  NS.parseQQTxt = parseQQTxt;
})();


/* ===== onebot.js ===== */
/**
 * ChatImport · onebot.js
 * 解析 OneBot / NapCat 风格 JSON（契约 §6.2）。
 * 支持：NapCat 私聊导出对象 { self_id, user_id, time, messages:[{sender, message:[segments]}] }
 *      以及标准 OneBot 消息事件数组 [{ post_type, message_type, self_id, user_id, time, raw_message, message, sender }]。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});
  const U = NS.util || {};

  /* QQ face id → emoji 常用映射（尽力而为；未映射的置空串，按契约以 name 计数） */
  const FACE_MAP = {
    0: '😮', 1: '😕', 2: '😍', 3: '😳', 4: '😏', 5: '😢', 6: '😊', 7: '🤐', 8: '😴',
    9: '😭', 10: '😅', 11: '😡', 12: '😜', 13: '😁', 14: '🙂', 15: '☹️', 16: '😎',
    17: '😫', 18: '🤮', 19: '🤭', 20: '🥰', 21: '🙄', 22: '😒', 23: '😋', 24: '🥱',
    25: '😨', 26: '😓', 27: '😄', 28: '🪖', 29: '💪', 30: '🤬', 31: '❓', 32: '🤫',
    33: '😵', 34: '😖', 35: '😞', 36: '💀', 37: '🔨', 38: '👋', 39: '🥶', 40: '❤️',
    41: '🕺', 42: '🐷', 43: '🤗', 44: '🎂', 45: '⚡', 46: '💣', 47: '🔪', 48: '⚽',
    49: '🐞', 50: '💩', 51: '🌙', 52: '☀️', 53: '🎁', 54: '💪', 55: '🦴', 56: '🤝',
    57: '✌️', 58: '🙏', 59: '😉', 60: '👊', 61: '🌹', 62: '🥀', 63: '💧', 64: '🎉',
    66: '🌵', 67: '🍉', 68: '🍺', 69: '☕', 70: '🍚', 71: '🍜', 72: '🍰', 73: '🎵',
    74: '🎤', 75: '📱', 76: '🎮', 77: '💄', 78: '🎒', 79: '📷', 80: '🍎'
  };

  function faceEmoji(id) { return FACE_MAP[id] || ''; }

  /** 把 segments 数组 → { text, type, sticker, media, durationSec } */
  function segmentsToMsg(segments) {
    let text = '', type = 'text', sticker = null, media = null, durationSec = 0;
    if (!Array.isArray(segments) || !segments.length) return { text: '', type: 'text' };
    for (const seg of segments) {
      if (!seg || typeof seg !== 'object') continue;
      const st = seg.type, data = seg.data || {};
      if (st === 'text') {
        text += (data.text || '');
      } else if (st === 'face') {
        sticker = { name: 'QQ表情#' + (data.id != null ? data.id : '?'), emoji: faceEmoji(data.id) };
        text += '[' + (sticker.emoji || '表情') + ']';
        if (type === 'text') type = 'sticker';
      } else if (st === 'image') {
        media = { count: 1, types: ['image'] }; type = 'image'; text = '[图片]';
      } else if (st === 'record') {
        media = { count: 1, types: ['voice'] }; type = 'voice'; text = '[语音]';
      } else if (st === 'video') {
        media = { count: 1, types: ['video'] }; type = 'video'; text = '[视频]';
      } else if (st === 'file') {
        media = { count: 1, types: ['file'] }; type = 'file'; text = '[文件]';
      } else if (st === 'at') {
        text += '@' + (data.qq || data.name || '某人');
      } else if (st === 'reply') {
        /* 引用回复：忽略内容，保留回复关系以外的信息 */
      }
    }
    if (!text && !sticker && !media) return { text: '', type: 'text' };
    return { text: text, type: type, sticker: sticker, media: media, durationSec: durationSec };
  }

  function normEvents(raw) {
    /* 统一成事件数组 [{ time, selfId, senderId, senderName, segments, rawMessage }] */
    const events = [];
    if (Array.isArray(raw)) {
      for (const e of raw) {
        if (!e || typeof e !== 'object') continue;
        if (e.post_type === 'message') {
          events.push({
            time: e.time, selfId: e.self_id,
            senderId: e.sender && e.sender.user_id, senderName: e.sender && (e.sender.nickname || e.sender.card || ''),
            segments: e.message, rawMessage: e.raw_message || ''
          });
        } else if (e.self_id !== undefined && e.messages) {
          /* NapCat 导出：外层是会话对象 */
          for (const m of e.messages) {
            events.push({
              time: m.time != null ? m.time : e.time,
              selfId: e.self_id, senderId: m.sender && m.sender.user_id,
              senderName: m.sender && (m.sender.nickname || m.sender.card || ''),
              segments: m.message, rawMessage: m.raw_message || ''
            });
          }
        }
      }
    } else if (raw && typeof raw === 'object') {
      if (raw.messages && raw.self_id !== undefined) {
        const selfId = raw.self_id;
        const otherName = raw.user_name || '';
        for (const m of raw.messages) {
          events.push({
            time: m.time != null ? m.time : raw.time,
            selfId: selfId, senderId: m.sender && m.sender.user_id,
            senderName: m.sender && (m.sender.nickname || m.sender.card || ''),
            segments: m.message, rawMessage: m.raw_message || ''
          });
        }
        if (otherName && !events.length) events.push({ time: raw.time, selfId: selfId, senderId: raw.user_id, senderName: otherName, segments: raw.message || [], rawMessage: raw.raw_message || '' });
      } else if (raw.post_type === 'message') {
        events.push({
          time: raw.time, selfId: raw.self_id,
          senderId: raw.sender && raw.sender.user_id, senderName: raw.sender && (raw.sender.nickname || ''),
          segments: raw.message, rawMessage: raw.raw_message || ''
        });
      }
    }
    return events;
  }

  function parseOneBot(raw, opts) {
    opts = opts || {};
    let data = raw;
    if (typeof raw === 'string') {
      try { data = JSON.parse(raw); } catch (e) { data = null; }
    }
    const events = normEvents(data);
    const messages = [];
    const speakers = [];
    for (const ev of events) {
      const time = U.parseTimeStr(ev.time);
      if (!time) continue;
      const isMe = (ev.selfId != null && ev.senderId != null) ? String(ev.senderId) === String(ev.selfId) : false;
      const senderName = String(ev.senderName || '').trim();
      if (senderName && speakers.indexOf(senderName) === -1) speakers.push(senderName);
      let parsed;
      if (Array.isArray(ev.segments) && ev.segments.length) parsed = segmentsToMsg(ev.segments);
      else if (ev.rawMessage) parsed = { text: ev.rawMessage, type: 'text' };
      else continue;
      const emojis = U.extractEmojis(parsed.text);
      if (!parsed.text && !parsed.sticker && !parsed.media) continue;
      const finalType = parsed.sticker ? 'sticker' : (U.classifyText(parsed.type, parsed.text));
      messages.push({
        time: time,
        peerId: isMe ? 'me' : 'peer',
        type: finalType,
        text: parsed.text || '',
        emojis: emojis,
        sticker: parsed.sticker,
        media: parsed.media,
        durationSec: parsed.durationSec || 0
      });
    }
    const meName = (opts.me && opts.me.name) || '我';
    const otherName = (opts.other && opts.other.name) ||
      (data && typeof data.user_name === 'string' && data.user_name) || '对方';
    const model = U.buildModel({
      meta: {
        title: opts.title || ('与' + otherName + '的聊天记录'),
        relation: opts.relation,
        me: { id: 'me', name: meName },
        other: { id: 'peer', name: otherName }
      },
      source: { platform: 'qq', adapter: 'onebot-json', originalFile: opts.originalFile || '' },
      messages: messages
    });
    model.meta.speakers = speakers;
    return model;
  }

  NS.parseOneBot = parseOneBot;
})();


/* ===== wechat-csv.js ===== */
/**
 * ChatImport · wechat-csv.js
 * 解析微信 CSV（契约 §6.3）：表头含 时间/发送者/类型/内容，列序不固定，容忍别名与引号字段。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});
  const U = NS.util || {};

  /** 简易 CSV 解析（支持双引号包裹与转义 ""） */
  function parseCSVLine(line) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
        } else cur += c;
      } else if (c === '"') {
        inQ = true;
      } else if (c === ',') {
        out.push(cur); cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  const COL_ALIAS = {
    time: ['时间', '日期', '日期时间', '发送时间'],
    sender: ['发送者', '昵称', '用户名', '发送人'],
    type: ['类型', '消息类型'],
    content: ['内容', '消息内容', '文本']
  };

  function headerIndexes(header) {
    const idx = { time: -1, sender: -1, type: -1, content: -1 };
    header.forEach(function (h, i) {
      const t = String(h || '').trim();
      for (const key of Object.keys(COL_ALIAS)) {
        if (COL_ALIAS[key].indexOf(t) !== -1) idx[key] = i;
      }
    });
    return idx;
  }

  const TYPE_MAP = {
    '文本': 'text', '文字': 'text', 'text': 'text',
    '图片': 'image', '图像': 'image', 'image': 'image',
    '表情': 'sticker', '表情包': 'sticker', 'sticker': 'sticker', 'emoticon': 'sticker',
    '语音': 'voice', '录音': 'voice', 'voice': 'voice',
    '视频': 'video', 'video': 'video',
    '文件': 'file', 'file': 'file',
    '系统': 'system', '系统消息': 'system', 'system': 'system',
    '链接': 'link', '分享链接': 'link', 'link': 'link',
    '通话': 'call', '语音通话': 'call', '视频通话': 'call', 'call': 'call'
  };

  function parseWechatCsv(text, opts) {
    opts = opts || {};
    const lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    let idx = null;
    const messages = [];
    const senders = [];
    for (let i = 0; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (!idx) {
        const h = headerIndexes(cols);
        if (h.time !== -1 && h.content !== -1) { idx = h; continue; }
        /* 无表头直接按常见列序尝试 */
        if (i < 3 && cols.length >= 4 && /^\d{4}/.test(String(cols[0] || '').trim())) {
          idx = { time: 0, sender: 1, type: 2, content: 3 };
          /* fallthrough 到本行解析 */
        } else {
          continue;
        }
      }
      const timeRaw = String(cols[idx.time] || '').trim();
      const time = U.parseTimeStr(timeRaw);
      if (!time) continue;
      const sender = String(cols[idx.sender] != null ? cols[idx.sender] : '').trim();
      if (sender && senders.indexOf(sender) === -1) senders.push(sender);
      const typeRaw = String(cols[idx.type] != null ? cols[idx.type] : '文本').trim();
      const content = String(cols[idx.content] != null ? cols[idx.content] : '').trim();
      const meName = (opts.me && opts.me.name) || '我';
      const otherName = (opts.other && opts.other.name) || '';
      const isMe = sender === meName || (opts.me && opts.me.pattern && new RegExp(opts.me.pattern).test(sender));
      let type = TYPE_MAP[typeRaw] || 'text';
      let sticker = null, media = null, durationSec = 0;
      if (type === 'sticker') {
        sticker = { name: content || '表情', emoji: (U.extractEmojis(content)[0]) || '' };
        type = 'sticker';
      } else if (type === 'call') {
        const m = /(\d+)\s*(?:秒|分钟|min)/.exec(content);
        if (m) durationSec = /分钟|min/.test(content) ? +m[1] * 60 : +m[1];
      } else if (type === 'image' || type === 'voice' || type === 'video' || type === 'file') {
        media = { count: 1, types: [type] };
      }
      messages.push({
        time: time,
        peerId: isMe ? 'me' : 'peer',
        type: type,
        text: content,
        emojis: U.extractEmojis(content),
        sticker: sticker,
        media: media,
        durationSec: durationSec
      });
    }
    if (!idx || !messages.length) {
      return U.buildModel({
        meta: { title: opts.title || '微信聊天记录', relation: opts.relation, me: { id: 'me', name: (opts.me && opts.me.name) || '我' }, other: { id: 'peer', name: (opts.other && opts.other.name) || '对方' } },
        source: { platform: 'wechat', adapter: 'wechat-csv', originalFile: opts.originalFile || '' },
        messages: []
      });
    }
    const model = U.buildModel({
      meta: {
        title: opts.title || '微信聊天记录',
        relation: opts.relation,
        me: { id: 'me', name: (opts.me && opts.me.name) || '我' },
        other: { id: 'peer', name: (opts.other && opts.other.name) || '对方' }
      },
      source: { platform: 'wechat', adapter: 'wechat-csv', originalFile: opts.originalFile || '' },
      messages: messages
    });
    /* 收集发信人列表供「我是谁」选择 */
    model.meta.speakers = senders;
    return model;
  }

  NS.parseWechatCsv = parseWechatCsv;
})();


/* ===== wechat-txt.js ===== */
/**
 * ChatImport · wechat-txt.js
 * 解析微信 txt（契约 §6.4）：`2024-01-01 12:00:00 昵称：内容` 及其变体
 * （昵称后换行再内容、`昵称: 内容`、时间行单独成行等）。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});
  const U = NS.util || {};

  const TIME_RE = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2} \d{1,2}:\d{2}(?::\d{2})?)(?:\s+(.+))?$/;
  const SENDER_RE = /^(.{1,40}?)\s*[:：]\s*(.*)$/;

  function parseWechatTxt(text, opts) {
    opts = opts || {};
    const lines = String(text || '').split(/\r?\n/);
    const meName = (opts.me && opts.me.name) || '我';
    const messages = [];
    const senders = [];
    let cur = null;
    const flush = function () {
      if (cur && cur.text) {
        const type = U.classifyText(null, cur.text);
        const content = cur.text.trim();
        const sender = cur.sender || '';
        if (sender && senders.indexOf(sender) === -1) senders.push(sender);
        messages.push({
          time: cur.time,
          peerId: sender === meName ? 'me' : 'peer',
          type: type,
          text: type === 'text' ? content : content,
          emojis: U.extractEmojis(content),
          sticker: null,
          media: (type === 'image' || type === 'voice' || type === 'video' || type === 'file') ? { count: 1, types: [type] } : null,
          durationSec: 0
        });
      }
      cur = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const tm = TIME_RE.exec(line);
      if (tm) {
        flush();
        const time = U.parseTimeStr(tm[1].replace('/', '-'));
        if (!time) continue;
        cur = { time: time, sender: '', text: '' };
        const rest = (tm[2] || '').trim();
        if (rest) {
          const sm = SENDER_RE.exec(rest);
          if (sm) {
            cur.sender = sm[1].trim();
            cur.text = sm[2];
          } else if (/^.{1,40}?[:：]$/.test(rest)) {
            cur.sender = rest.slice(0, -1).trim();
          } else {
            /* 只有时间没有内容？按纯时间行处理，等待后续行 */
            cur.text = rest;
          }
        }
        continue;
      }
      if (cur && !cur.text) {
        const sm = SENDER_RE.exec(line);
        if (sm && sm[2]) {
          cur.sender = sm[1].trim();
          cur.text = sm[2];
        } else if (sm) {
          cur.sender = sm[1].trim();
        } else {
          cur.text = rawLine.trim();
        }
        continue;
      }
      if (cur) {
        cur.text += '\n' + rawLine.trim();
      }
    }
    flush();

    const otherName = (opts.other && opts.other.name) || '对方';
    const model = U.buildModel({
      meta: {
        title: opts.title || '微信聊天记录',
        relation: opts.relation,
        me: { id: 'me', name: meName },
        other: { id: 'peer', name: otherName }
      },
      source: { platform: 'wechat', adapter: 'wechat-txt', originalFile: opts.originalFile || '' },
      messages: messages
    });
    model.meta.speakers = senders;
    return model;
  }

  NS.parseWechatTxt = parseWechatTxt;
})();


/* ===== wechat-forward.js ===== */
/**
 * ChatImport · wechat-forward.js
 * 解析微信「合并转发 / 存成文件」导出的原生 TXT（Dukou、微信 PC 端「存成文件」等）。
 *
 * 块结构（空行分隔）：
 *   发送者昵称
 *   2026年11月1日 13:03
 *   消息内容（可多行）
 *
 * 媒体以占位符出现：`[图片] xxx.jpg`、`[动画表情]`、`[语音]`、`[视频]`、`[文件]` 等。
 * 发送者名可能带前缀「·」（微信导出格式），匹配时忽略。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});
  const U = NS.util || {};

  const DT_RE = /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const DT_RE2 = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const HEADER_RE = /^(聊天[:：]|说明[:：]|【第\s*\d+\s*批】|本批文字中的文件路径相对于[:：]|原始记录[:：]|本批文件[:：]|batches\/)/;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoOf(m) {
    return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) + 'T' + pad2(+m[4]) + ':' + pad2(+m[5]) + ':' + pad2(m[6] ? +m[6] : 0) + '+08:00';
  }
  function parseDateLine(line) {
    let m = DT_RE.exec(line);
    if (m) return isoOf(m);
    m = DT_RE2.exec(line);
    if (m) return isoOf(m);
    return null;
  }

  /** 发送者名规范化：去前缀圆点/空白，便于「我的昵称」匹配 */
  function normName(name) {
    return String(name || '').replace(/^[·•\s]+/, '').trim();
  }

  /** 按内容占位符判定消息类型 */
  function classifyContent(content) {
    const t = String(content || '').trim();
    const m = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec(t);
    if (m) {
      const tag = m[1], rest = m[2].trim();
      if (tag === '图片' || tag === '照片') {
        return { type: 'image', text: '[图片]', media: { count: 1, types: ['image'] }, fileName: rest };
      }
      if (tag === '动画表情' || tag === '表情' || tag === '表情包') {
        /* 若后面跟着文件名（如 xxx.gif），保留文件引用，供文件夹导入时内嵌真实表情包图片 */
        if (rest && /\.[a-z0-9]{2,5}$/i.test(rest)) {
          return {
            type: 'sticker', text: '[动画表情]',
            sticker: { name: rest.replace(/\.[a-z0-9]{2,5}$/i, ''), emoji: '', imageFileName: rest }
          };
        }
        return { type: 'sticker', text: '[动画表情]', sticker: { name: rest || '[动画表情]', emoji: '' } };
      }
      if (tag === '语音') return { type: 'voice', text: '[语音]', media: { count: 1, types: ['voice'] } };
      if (tag === '视频') return { type: 'video', text: '[视频]', media: { count: 1, types: ['video'] } };
      if (tag === '文件') return { type: 'file', text: '[文件]', media: { count: 1, types: ['file'] } };
      if (tag === '链接' || tag === '分享') return { type: 'link', text: '[链接]' };
      if (tag === '通话' || tag === '语音通话' || tag === '视频通话') return { type: 'call', text: '[通话]' };
      /* 其他 [xxx] 视为普通文本（如 [吃瓜] 表情码） */
    }
    return { type: 'text', text: t };
  }

  function parseWechatForwardTxt(text, opts) {
    opts = opts || {};
    const rawLines = String(text || '').split(/\r?\n/);
    /* 先按空行切块 */
    const blocks = [];
    let cur = [];
    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) {
        if (cur.length) blocks.push(cur);
        cur = [];
      } else if (!HEADER_RE.test(line)) {
        cur.push(raw);
      }
    }
    if (cur.length) blocks.push(cur);

    const myName = (opts.me && opts.me.name) || '我';
    const myPattern = opts.me && opts.me.pattern;
    function isMeNode(name) {
      const n = normName(name);
      if (!n) return false;
      if (normName(myName) === n) return true;
      if (myPattern) {
        try { if (new RegExp(myPattern).test(n)) return true; } catch (e) { /* ignore */ }
      }
      return false;
    }

    const entries = [];
    let otherName = (opts.other && opts.other.name) || '';
    const speakers = [];
    for (const block of blocks) {
      let sender = '', time = null, contentLines = [];
      const first = (block[0] || '').trim();
      const secondIsDate = block.length >= 2 && parseDateLine((block[1] || '').trim()) !== null;
      const firstIsDate = parseDateLine(first) !== null;
      if (secondIsDate) {
        sender = first;
        time = parseDateLine((block[1] || '').trim());
        contentLines = block.slice(2);
      } else if (firstIsDate) {
        time = parseDateLine(first);
        contentLines = block.slice(1);
      } else {
        /* 无日期行：整块视为无法解析，跳过（不产生错误数据） */
        continue;
      }
      if (!time) continue;
      const content = contentLines.join('\n').trim();
      if (!content) continue;
      const cls = classifyContent(content);
      const sp = normName(sender);
      if (sp && speakers.indexOf(sp) === -1) speakers.push(sp);
      if (!otherName && sender) otherName = sender;
      entries.push({ time: time, speaker: sp, cls: cls });
    }

    /* ---------- 分侧：群聊 vs 一对一 ---------- */
    const isGroup = speakers.length > 2;
    let peers = null;
    let messages = [];
    if (isGroup) {
      /* 群聊：peers[0] = 我（由 myName 指定；未指定则占位），其余按首次出现顺序编号 */
      const meName = (opts.me && opts.me.name) ? normName(opts.me.name) : '';
      const others = speakers.filter(function (s) { return s !== meName; });
      peers = [{ id: 'me', name: meName || '我', avatar: '🙂', color: '#5B8DEF' }];
      others.forEach(function (s, i) {
        peers.push({ id: 'p' + (i + 1), name: s, avatar: '💬', color: '#8A93A6' });
      });
      const idOf = function (sp) {
        if (meName && sp === meName) return 'me';
        if (!meName && sp === peers[0].name) return 'me';
        for (let i = 1; i < peers.length; i++) if (peers[i].name === sp) return peers[i].id;
        return 'me';
      };
      messages = entries.map(function (e) {
        const cls = e.cls;
        const content = cls.text;
        return {
          time: e.time,
          peerId: idOf(e.speaker),
          type: cls.type,
          text: content,
          emojis: cls.type === 'text' ? U.extractEmojis(content) : [],
          sticker: cls.sticker || null,
          media: cls.media || null,
          durationSec: 0
        };
      });
    } else {
      messages = entries.map(function (e) {
        const cls = e.cls;
        const me = isMeNode(e.speaker);
        const content = cls.type === 'text' ? cls.text : cls.text;
        let media = cls.media || null;
        if (media && cls.fileName) media = { count: media.count, types: media.types, fileName: cls.fileName };
        return {
          time: e.time,
          peerId: me ? 'me' : 'peer',
          type: cls.type,
          text: content,
          emojis: cls.type === 'text' ? U.extractEmojis(content) : [],
          sticker: cls.sticker || null,
          media: media,
          durationSec: 0
        };
      });
      /* 一对一：对方 = 非我的发言人（覆盖首条发送者兜底） */
      otherName = (opts.other && opts.other.name) ||
        speakers.filter(function (s) { return !isMeNode(s); })[0] || '';
    }

    const meta = isGroup
      ? {
          title: opts.title || (opts.groupName || '群聊') + '聊天记录',
          relation: opts.relation || 'group',
          group: true,
          groupName: opts.groupName || '',
          peers: peers
        }
      : {
          title: opts.title || ('与' + (normName(otherName) || '对方') + '的聊天记录'),
          relation: opts.relation,
          me: { id: 'me', name: normName(myName) || '我' },
          other: { id: 'peer', name: normName(otherName) || '对方', color: '#F279A6' }
        };
    const model = U.buildModel({
      meta: meta,
      source: { platform: 'wechat', adapter: 'wechat-forward', originalFile: opts.originalFile || '' },
      messages: messages
    });
    /* 供导入界面展示「检测到的发言人」，让用户一键选择我是谁 */
    model.meta.speakers = speakers;
    return model;
  }

  NS.parseWechatForwardTxt = parseWechatForwardTxt;
})();


/* ===== screenshot-ocr.js ===== */
/**
 * ChatImport · screenshot-ocr.js
 * 聊天长截图 OCR 排版解析器（纯函数，可测试）。
 *
 * 输入：OCR 行数组 [{ text, bbox: {x0,y0,x1,y1} }]（tesseract.js line 结果，绝对像素坐标）
 * opts：{ width, height, me:{name?} }
 *
 * 启发式规则（微信截图常见布局）：
 *   1. 居中日期行（YYYY年M月D日）→ 更新当前日期
 *   2. 短行（≤12 字）且下一行是同侧气泡 → 发送者昵称
 *   3. 气泡行左右分侧：右侧 58% 之外 → 我；左侧 → 对方
 *   4. `HH:mm` 短行 → 消息时间；无时间则沿用上一条，再退化为日期 12:00
 *   5. 同侧连续气泡行并入同一条消息；新昵称/换侧/日期行 → 新消息
 *   6. 单行合并格式「昵称: 内容」也支持
 * 输出：统一消息模型（多个其他发言人为群聊 peers）。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});
  const U = NS.util || {};

  const TIME_RE = /^(\d{1,2}):(\d{2})$/;
  const DATE_RE = /^(\d{4})年(\d{1,2})月(\d{1,2})日/;
  /* 「Sun 20:08」「昨天 21:40」「周一 20:08」等相对时间行 */
  const REL_TIME_RE = /^(?:今天|昨天|前天|星期[一二三四五六日天]|周[一二三四五六日天]|Sun|Mon|Tue|Wed|Thu|Fri|Sat)[\s,，]*(\d{1,2}):(\d{2})$/i;
  function todayLocal() {
    const d = new Date();
    const pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  const COMBINED_RE = /^(.{1,12})[:：]\s*([\s\S]+)$/;
  const ME_THRESHOLD = 0.58; /* 气泡右缘超过宽度 58% 视为我的消息 */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateOf(iso) {
    const t = U.parseTimeStr(iso);
    if (!t) return '2024-01-01';
    return t.slice(0, 10);
  }

  function parseScreenshotOcr(lines, opts) {
    opts = opts || {};
    const width = opts.width || 1000;
    const height = opts.height || 2000;
    const meNameRaw = (opts.me && opts.me.name) ? String(opts.me.name) : '';
    /* 默认不识别发言人名（微信单聊不显示昵称，噪声短行会被误判）；群聊时显式开启 */
    const detectSenders = opts.detectSenders === true;
    const meName = meNameRaw.replace(/^[·•\s]+/, '').trim();

    if (!Array.isArray(lines) || !lines.length) {
      return emptyModel(meName, '截图未识别出任何文字');
    }

    /* 1. 行聚类成“排”：同一视觉行 = 行中心距离小于 0.45 倍行高 */
    const rows = [];
    let medianH = 0;
    (function () {
      const hs = [];
      for (const l of lines) {
        if (l && l.bbox && typeof l.text === 'string') hs.push(l.bbox.y1 - l.bbox.y0);
      }
      hs.sort(function (a, b) { return a - b; });
      medianH = hs.length ? hs[Math.floor(hs.length / 2)] : 16;
    })();
    const MERGE_DIST = Math.max(5, medianH * 0.45);
    const sorted = lines.slice().sort(function (a, b) { return a.bbox.y0 - b.bbox.y0; });
    for (const l of sorted) {
      if (!l || !l.bbox || typeof l.text !== 'string' || !l.text.trim()) continue;
      const last = rows[rows.length - 1];
      const center = (l.bbox.y0 + l.bbox.y1) / 2;
      const lastCenter = last ? (last.y0 + last.y1) / 2 : -Infinity;
      if (last && center - lastCenter <= MERGE_DIST) {
        last.lines.push(l);
        last.x0 = Math.min(last.x0, l.bbox.x0);
        last.x1 = Math.max(last.x1, l.bbox.x1);
        last.y0 = Math.min(last.y0, l.bbox.y0);
        last.y1 = Math.max(last.y1, l.bbox.y1);
        last.h = Math.max(last.h || 0, l.bbox.y1 - l.bbox.y0);
        last.text += ' ' + l.text.trim();
      } else {
        rows.push({ lines: [l], text: l.text.trim(), x0: l.bbox.x0, x1: l.bbox.x1, y0: l.bbox.y0, y1: l.bbox.y1, h: l.bbox.y1 - l.bbox.y0 });
      }
    }

    /* 2. 逐排分类与组装 */
    const defaultDate = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.dateHint || '')) ? opts.dateHint : todayLocal();
    let currentDate = defaultDate;
    let pendingTime = '';
    let pendingSender = null; /* { name, side } */
    const msgs = []; /* { sender, side, date, time, lines: [] } */
    const meSideName = meName || '我';
    let firstMeSideName = '';

    function sideOf(row) {
      if (row.x0 < width * 0.35 && row.x1 < width * 0.5) return 'other';
      if (row.x1 > width * ME_THRESHOLD) return 'me';
      if (row.x0 < width * 0.35) return 'other';
      return row.x1 > width * 0.55 ? 'me' : 'center';
    }
    function newMsg(sender, side) {
      const m = { sender: sender, side: side, date: currentDate, time: '', lines: [] };
      msgs.push(m);
      return m;
    }
    function currentMsg() { return msgs.length ? msgs[msgs.length - 1] : null; }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const text = row.text.trim();
      if (!text) continue;
      /* 噪声行过滤：纯标点/符号、1-2 位拉丁碎片、孤立数字（OCR 噪点） */
      if (/^[\s\p{P}\p{S}]+$/u.test(text)) continue;
      if (/^[A-Za-z]{1,2}$/.test(text)) continue;
      if (/^\d{1,2}$/.test(text)) continue;
      /* 日期分隔行 */
      const dm = DATE_RE.exec(text);
      if (dm && row.x0 < width * 0.45 && row.x1 > width * 0.55) {
        currentDate = dm[1] + '-' + pad2(+dm[2]) + '-' + pad2(+dm[3]);
        pendingSender = null;
        continue;
      }
      /* 相对时间行（Sun 20:08 / 昨天 21:40） */
      const rtm = REL_TIME_RE.exec(text);
      if (rtm) {
        const tval = pad2(+rtm[1]) + ':' + pad2(+rtm[2]);
        const cmR = currentMsg();
        if (cmR) { cmR.time = tval; cmR.closed = true; } else pendingTime = tval;
        continue;
      }
      /* 时间短行：归属当前打开的消息（并标记其已闭合）；否则挂起待用 */
      if (TIME_RE.test(text) && text.length <= 5) {
        const cm = currentMsg();
        if (cm) { cm.time = text; cm.closed = true; }
        else pendingTime = text;
        continue;
      }
      /* 合并格式「昵称: 内容」 */
      const cm = detectSenders ? COMBINED_RE.exec(text) : null;
      if (cm && text.length > 4 && text.length <= 80) {
        const side = sideOf(row);
        const sender = cm[1].replace(/^[·•\s]+/, '').trim() || (side === 'me' ? meSideName : '对方');
        const m = newMsg(sender, side);
        m.lines.push(cm[2].trim());
        if (pendingTime) { m.time = pendingTime; pendingTime = ''; }
        if (side === 'me' && !firstMeSideName) firstMeSideName = sender;
        continue;
      }
      /* 昵称行：短行，下一行是正文气泡；但同侧已有打开的消息时优先视为续行（多行气泡） */
      const side = sideOf(row);
      const next = rows[i + 1];
      const nextSide = next ? sideOf(next) : null;
      const nextText = next ? next.text.trim() : '';
      const nextIsBubble = !!next && nextSide === side && !TIME_RE.test(nextText) && nextText.length >= 2;
      const openSameSide = !!(currentMsg() && currentMsg().side === side && !pendingSender && !currentMsg().closed);
      /* 昵称字号通常比正文小：行高明显小于下一行才认定为昵称 */
      const smallerThanNext = !next || !next.h || !row.h || row.h <= next.h * 0.85 + 1;
      const isNickname = detectSenders && text.length <= 12 && nextIsBubble && !TIME_RE.test(text) && !openSameSide && !pendingSender && smallerThanNext;
      if (isNickname) {
        pendingSender = { name: text.replace(/^[·•\s]+/, '').trim(), side: side };
        continue;
      }
      /* 气泡行 */
      let m;
      if (pendingSender) {
        m = newMsg(pendingSender.name || (pendingSender.side === 'me' ? meSideName : '对方'), pendingSender.side);
        if (pendingSender.side === 'me' && !firstMeSideName) firstMeSideName = pendingSender.name;
        pendingSender = null;
      } else {
        m = currentMsg();
        if (!m || m.side !== side || m.closed) {
          m = newMsg(side === 'me' ? meSideName : '对方', side);
          if (side === 'me' && !firstMeSideName) firstMeSideName = meSideName;
        }
      }
      m.lines.push(text);
      if (pendingTime) { m.time = pendingTime; pendingTime = ''; }
    }

    /* 3. 组装消息：时间兜底 + 排序
       缺时间的消息继承上一条真实时间（而不是统一 12:00），保证自然顺序不被排序打乱 */
    let lastTime = '';
    for (const m of msgs) {
      if (m.time && m.time !== '12:00') { m.realTime = true; lastTime = m.time; }
      else { m.realTime = false; m.time = lastTime || '12:00'; }
    }
    const rawMessages = msgs.map(function (m) {
      const d = m.date || defaultDate;
      const iso = d + 'T' + pad2(parseInt(m.time.split(':')[0], 10) || 12) + ':' +
        pad2(parseInt(m.time.split(':')[1], 10) || 0) + ':00+08:00';
      const content = m.lines.join('\n').trim();
      const cls = U.classifyText(null, content);
      return {
        time: iso,
        isoReal: m.realTime,
        sender: m.sender,
        side: m.side,
        type: cls,
        text: cls === 'text' ? content : cls === 'image' ? '[图片]' : cls === 'voice' ? '[语音]' : content,
        emojis: cls === 'text' ? U.extractEmojis(content) : []
      };
    }).filter(function (r) { return r.text; });
    /* 用前一条真实时间覆盖兜底值（同一天内），保持时序单调 */
    let lastRealIso = '';
    for (const r of rawMessages) {
      if (r.isoReal) lastRealIso = r.iso;
      else if (lastRealIso) r.time = lastRealIso;
    }

    /* 4. 分侧构建 peers（1v1 或群聊） */
    const myFinalName = meName || firstMeSideName || '我';
    const others = [];
    for (const r of rawMessages) {
      if (r.side !== 'me' && r.sender && others.indexOf(r.sender) === -1) others.push(r.sender);
    }
    const isGroup = others.length > 1;
    let peers, messageEntries;
    if (isGroup) {
      peers = [{ id: 'me', name: myFinalName, avatar: '🙂', color: '#5B8DEF' }];
      others.forEach(function (n, i) { peers.push({ id: 'p' + (i + 1), name: n, avatar: '💬', color: '#8A93A6' }); });
      messageEntries = rawMessages.map(function (r) {
        let pid = 'me';
        if (r.side !== 'me') {
          const idx = others.indexOf(r.sender);
          pid = idx >= 0 ? peers[idx + 1].id : 'p1';
        }
        return { time: r.time, peerId: pid, type: r.type, text: r.text, emojis: r.emojis };
      });
    } else {
      const otherName = others[0] || '对方';
      messageEntries = rawMessages.map(function (r) {
        return {
          time: r.time,
          peerId: r.side === 'me' ? 'me' : 'peer',
          type: r.type, text: r.text, emojis: r.emojis
        };
      });
      peers = null;
    }

    const meta = isGroup
      ? { title: '截图聊天记录', relation: 'group', group: true, groupName: '截图群聊', peers: peers }
      : {
          title: '与' + (others[0] || '对方') + '的截图聊天记录',
          relation: 'general',
          me: { id: 'me', name: myFinalName },
          other: { id: 'peer', name: others[0] || '对方', color: '#F279A6' }
        };
    const model = U.buildModel({
      meta: meta,
      source: { platform: 'screenshot', adapter: 'screenshot-ocr', originalFile: opts.originalFile || '' },
      messages: messageEntries
    });
    model.meta.speakers = isGroup ? peers.map(function (p) { return p.name; }) : [myFinalName].concat(others);
    return model;
  }

  function emptyModel(meName, reason) {
    return U.buildModel({
      meta: {
        title: '截图聊天记录',
        relation: 'general',
        me: { id: 'me', name: meName || '我' },
        other: { id: 'peer', name: '对方', color: '#F279A6' }
      },
      source: { platform: 'screenshot', adapter: 'screenshot-ocr', originalFile: '' },
      messages: []
    });
  }

  /** 把模型还原为「微信合并转发」规范文本（供记录列表复用解析/合并流程） */
  function screenshotToText(model) {
    const out = [];
    const peers = (model && model.peers) || [];
    const nameById = {};
    for (const p of peers) nameById[p.id] = p.name;
    for (const m of ((model && model.messages) || [])) {
      const t = U.parseTimeStr(m.time);
      if (!t) continue;
      const dateStr = t.slice(0, 10).split('-');
      const hh = t.slice(11, 13), mm = t.slice(14, 16);
      out.push('·' + (nameById[m.peerId] || (m.peerId === 'me' ? '我' : '对方')));
      out.push(dateStr[0] + '年' + parseInt(dateStr[1], 10) + '月' + parseInt(dateStr[2], 10) + '日 ' + hh + ':' + mm);
      out.push(m.text);
      out.push('');
    }
    return out.join('\n');
  }

  NS.parseScreenshotOcr = parseScreenshotOcr;
  NS.screenshotToText = screenshotToText;
})();


/* ===== index.js ===== */
/**
 * ChatImport · index.js
 * 对外公共 API 面（契约 §2.2）：detect / toModel / parseQQTxt / parseOneBot / parseWechatCsv / parseWechatTxt。
 * 必须最后拼接。
 */
(function () {
  'use strict';
  const NS = (globalThis.ChatImport = globalThis.ChatImport || {});

  /**
   * 合并多份模型（同一个人多批导出）。参数为模型数组，返回合并后的统一模型。
   */
  NS.mergeModels = function (models) {
    return NS.util.mergeModels(models);
  };

  /** 重叠截图/导出按上下文对齐合并（bigram 相似度找重叠区，逐条取更优版本） */
  NS.mergeByOverlap = function (models) {
    return NS.util.mergeByOverlap(models);
  };

  /** 按日期范围筛选（fromDate/toDate 为 'YYYY-MM-DD' 或 null） */
  NS.filterByRange = function (model, fromDate, toDate) {
    return NS.util.filterByRange(model, fromDate, toDate);
  };

  /* parseScreenshotOcr / screenshotToText 由 screenshot-ocr.js 直接挂载到本命名空间 */

  NS.toModel = function (raw, opts) {
    const d = NS.detect(raw);
    const o = opts || {};
    switch (d.adapter) {
      case 'qq-txt': return NS.parseQQTxt(String(raw), o);
      case 'onebot-json': return NS.parseOneBot(raw, o);
      case 'wechat-csv': return NS.parseWechatCsv(String(raw), o);
      case 'wechat-forward': return NS.parseWechatForwardTxt(String(raw), o);
      case 'wechat-txt': return NS.parseWechatTxt(String(raw), o);
      default: {
        /* 无法识别时返回空模型，避免下游崩溃 */
        const U = NS.util || {};
        return U.buildModel({
          meta: {
            title: o.title || '无法识别的聊天记录',
            relation: o.relation,
            me: { id: 'me', name: (o.me && o.me.name) || '我' },
            other: { id: 'peer', name: (o.other && o.other.name) || '对方' }
          },
          source: { platform: 'unknown', adapter: 'unknown', originalFile: o.originalFile || '' },
          messages: []
        });
      }
    }
  };
})();


})(typeof globalThis !== "undefined" ? globalThis : (typeof global !== "undefined" ? global : {}));
