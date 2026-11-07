/* app/app.js —— PWA 主逻辑：导入（粘贴/文件/文件夹/截图 OCR）、记录列表、发言人选择、
 * 合并预览、9 模板、报告渲染与导出。数据仅存本地 IndexedDB。 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORAGE_KEY = 'cr_records';
  var records = [];
  var lastModel = null;
  var lastHtml = '';
  var lastMd = '';
  var previewCacheKey = '';
  var previewCache = null;
  var parseCache = {};

  function libReady() {
    return typeof globalThis.ChatImport !== 'undefined' && typeof globalThis.ChatReport !== 'undefined';
  }
  function ocrReady() { return typeof globalThis.Tesseract !== 'undefined'; }
  function normName(s) { return String(s || '').replace(/^[·•\s]+/, '').trim(); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function truncate(s, n) {
    var t = String(s || '').replace(/\s+/g, ' ');
    return t.length > n ? t.slice(0, n) + '…' : t;
  }
  function selectedTemplate() {
    var nodes = document.querySelectorAll('input[name="tpl"]');
    for (var i = 0; i < nodes.length; i++) if (nodes[i].checked) return nodes[i].value;
    return 'general';
  }

  /* ---------- Service Worker（离线） ---------- */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(function () {
        var tag = $('offlineTag');
        if (tag) tag.hidden = false;
      }).catch(function () { /* 本地 file:// 或非 https 环境注册失败属正常 */ });
    }
  }

  /* ---------- IndexedDB 记录存储 ---------- */
  var dbPromise = null;
  function openDB() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = indexedDB.open('cr_app_records', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('records', { keyPath: 'id' }); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    }
    return dbPromise;
  }
  function dbGetAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var r = db.transaction('records').objectStore('records').getAll();
        r.onsuccess = function () { resolve(r.result || []); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function dbPut(rec) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var r = db.transaction('records', 'readwrite').objectStore('records').put(rec);
        r.onsuccess = function () { resolve(true); };
        r.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }
  function dbDelete(id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var r = db.transaction('records', 'readwrite').objectStore('records').delete(id);
        r.onsuccess = function () { resolve(true); };
        r.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }
  function dbClear() {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var r = db.transaction('records', 'readwrite').objectStore('records').clear();
        r.onsuccess = function () { resolve(true); };
        r.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  function parseRecord(rec) {
    try {
      if (!libReady()) return null;
      var key = rec.id + '|' + (rec.myName || '');
      if (parseCache[key]) return parseCache[key];
      var opts = rec.myName ? { me: { name: rec.myName } } : {};
      var model = globalThis.ChatImport.toModel(rec.raw, opts);
      if (rec.images) {
        model.messages.forEach(function (m) {
          if (m.media && m.media.fileName && rec.images[m.media.fileName]) m.media.dataUrl = rec.images[m.media.fileName];
          if (m.sticker && m.sticker.imageFileName && rec.images[m.sticker.imageFileName]) m.sticker.img = rec.images[m.sticker.imageFileName];
        });
      }
      if (Object.keys(parseCache).length > 80) parseCache = {};
      parseCache[key] = model;
      return model;
    } catch (e) { return null; }
  }
  function fmtSpan(model) {
    if (!model || !model.messages.length) return '';
    return model.messages[0].time.slice(0, 10) + ' → ' + model.messages[model.messages.length - 1].time.slice(0, 10);
  }
  function getRange() {
    return { from: $('rangeFrom').value || null, to: $('rangeTo').value || null };
  }

  /* ---------- 记录列表 ---------- */
  function addRecord(item) {
    var my = ($('myName').value || '').trim();
    var rec = {
      id: 'r' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      name: item.name, adapter: item.adapter || '', raw: item.raw,
      images: item.images || null, myName: my, checked: true
    };
    records.push(rec);
    dbPut(rec);
    renderRecords();
  }
  function removeRecord(id) {
    records = records.filter(function (r) { return r.id !== id; });
    dbDelete(id);
    renderRecords();
  }

  function renderRecords() {
    var list = $('recordList');
    list.innerHTML = '';
    if (!records.length) {
      $('recordsInfo').textContent = '还没有导入记录。用上方按钮导入，或「载入演示数据集」体验。';
      $('btnGenerate').disabled = true;
      return;
    }
    records.forEach(function (rec) {
      var model = parseRecord(rec);
      var count = model ? model.messages.length : 0;
      var speakers = model ? (model.meta && model.meta.speakers) || [] : [];
      var needPick = (globalThis.CRRecords && globalThis.CRRecords.needsSpeakerPick)
        ? globalThis.CRRecords.needsSpeakerPick(speakers, rec.myName) : false;
      var row = document.createElement('div');
      row.className = 'record-row';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = rec.checked !== false;
      cb.title = '勾选后参与合并';
      cb.addEventListener('change', function () { rec.checked = cb.checked; dbPut(rec); refreshInfo(); });
      var label = document.createElement('div');
      label.className = 'record-label';
      label.innerHTML = '<span class="record-name">' + escapeHtml(rec.name) + '</span>' +
        '<span class="record-meta">' + count + ' 条 · ' + escapeHtml(fmtSpan(model)) + '</span>';
      var btnPrev = document.createElement('button');
      btnPrev.className = 'mini';
      btnPrev.textContent = '预览';
      btnPrev.addEventListener('click', function () { showPreview(rec); });
      var btnDel = document.createElement('button');
      btnDel.className = 'mini danger';
      btnDel.textContent = '×';
      btnDel.title = '删除这条记录';
      btnDel.addEventListener('click', function () { removeRecord(rec.id); });
      row.appendChild(cb); row.appendChild(label); row.appendChild(btnPrev); row.appendChild(btnDel);
      list.appendChild(row);
      if (needPick && speakers.length) {
        var srow = document.createElement('div');
        srow.className = 'speaker-row';
        var tip = document.createElement('span');
        tip.textContent = '我是：';
        srow.appendChild(tip);
        speakers.forEach(function (name) {
          var b = document.createElement('button');
          b.className = 'speaker-btn';
          b.textContent = name;
          b.addEventListener('click', function () { rec.myName = name; dbPut(rec); renderRecords(); });
          srow.appendChild(b);
        });
        list.appendChild(srow);
      }
    });
    refreshInfo();
  }

  function speakerHint(model) {
    var speakers = model && model.meta ? (model.meta.speakers || []) : [];
    if (speakers.length < 2) return '';
    var mine = normName($('myName').value || '');
    if (mine && speakers.some(function (s) { return normName(s) === mine; })) return '';
    return '<br>识别到发信人：' + speakers.map(escapeHtml).join('、') +
      ' —— 请在下方记录列表点「我是 xxx」选择自己（未选择时消息会全部算给对方）';
  }

  function refreshInfo() {
    var sel = records.filter(function (r) { return r.checked !== false; });
    if (!sel.length) {
      $('recordsInfo').textContent = '已导入 ' + records.length + ' 份，未勾选任何记录。';
      $('btnGenerate').disabled = true;
      return;
    }
    var models = sel.map(parseRecord).filter(Boolean);
    if (!models.length) {
      $('recordsInfo').textContent = '勾选的记录没有可用数据';
      $('btnGenerate').disabled = true;
      return;
    }
    var range = getRange();
    var cacheKey = sel.map(function (r) { return r.id + ':' + (r.myName || ''); }).sort().join(';') +
      '|' + (range.from || '') + '|' + (range.to || '');
    var sum;
    if (cacheKey === previewCacheKey && previewCache) {
      sum = previewCache;
    } else {
      var deps = { mergeModels: globalThis.ChatImport.mergeModels, filterByRange: globalThis.ChatImport.filterByRange };
      var filtered = (globalThis.CRRecords && globalThis.CRRecords.computeMerged)
        ? globalThis.CRRecords.computeMerged(models, range, deps)
        : globalThis.ChatImport.filterByRange(models.length === 1 ? models[0] : globalThis.ChatImport.mergeModels(models), range.from, range.to);
      sum = (globalThis.CRRecords && globalThis.CRRecords.summarize)
        ? globalThis.CRRecords.summarize(filtered, globalThis.ChatReport.analyze)
        : { count: filtered.messages.length };
      previewCacheKey = cacheKey;
      previewCache = sum;
    }
    var text = '已导入 ' + records.length + ' 份，勾选 ' + sel.length + ' 份；';
    if (range.from || range.to) text += '按日期筛选后 ';
    text += (globalThis.CRRecords && globalThis.CRRecords.previewText)
      ? globalThis.CRRecords.previewText(sum, sum)
      : ('合并预览：<b>' + sum.count + '</b> 条');
    $('recordsInfo').innerHTML = text;
    $('btnGenerate').disabled = sum.count === 0;
  }

  /* ---------- 预览弹窗 ---------- */
  function closeModal() {
    var old = document.querySelector('.modal-overlay');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }
  function showPreview(rec) {
    closeModal();
    var model = parseRecord(rec);
    if (!model) return;
    var speakers = model.meta.speakers || [];
    var msgs = model.messages;
    function lineHtml(m) {
      return '<div class="msg-line">' +
        '<span class="msg-time">' + escapeHtml(m.time.slice(5, 16).replace('T', ' ')) + '</span>' +
        '<span class="msg-sender">' + escapeHtml(m.peerId === 'me' ? model.meta.me.name : model.meta.other.name) + '</span>' +
        '<span class="msg-text">' + escapeHtml(truncate(m.text, 40) || '[' + m.type + ']') + '</span></div>';
    }
    var lines = [];
    if (msgs.length <= 8) msgs.forEach(function (m) { lines.push(lineHtml(m)); });
    else {
      msgs.slice(0, 4).forEach(function (m) { lines.push(lineHtml(m)); });
      lines.push('<div class="msg-line muted">…… 中间 ' + (msgs.length - 8) + ' 条 ……</div>');
      msgs.slice(-4).forEach(function (m) { lines.push(lineHtml(m)); });
    }
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal">' +
      '<div class="modal-head"><b>' + escapeHtml(rec.name) + '</b><button class="mini">×</button></div>' +
      '<div class="modal-meta">' + msgs.length + ' 条 · ' + escapeHtml(fmtSpan(model)) +
      ' · 对方：' + escapeHtml(model.meta.other.name) + '</div>' +
      (speakers.length >= 2
        ? '<div class="modal-pick"><span>我是：</span>' + speakers.map(function (s) {
            return '<button class="speaker-btn" data-name="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
          }).join('') + '</div>'
        : '') +
      '<div class="modal-msgs">' + lines.join('') + '</div>' +
      '<div class="modal-foot"><button id="modalClose">关闭</button></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    overlay.querySelector('.modal-head .mini').addEventListener('click', closeModal);
    overlay.querySelector('#modalClose').addEventListener('click', closeModal);
    overlay.querySelectorAll('.speaker-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        rec.myName = btn.getAttribute('data-name');
        dbPut(rec);
        renderRecords();
        showPreview(rec);
      });
    });
  }

  /* ---------- 导入：粘贴 / 文件 / 文件夹 / 截图 ---------- */
  function importOne(raw, label) {
    if (!libReady()) { $('detectInfo').textContent = '⚠ 缺少核心脚本（vendor 未注入）'; $('detectInfo').className = 'hint'; return; }
    var d = globalThis.ChatImport.detect(raw);
    if (!d || !d.adapter) {
      $('detectInfo').textContent = '无法识别格式。支持：QQ 消息管理器 txt / OneBot·NapCat JSON / 微信 CSV / 微信 txt / 微信合并转发 txt';
      $('detectInfo').className = 'hint';
      return;
    }
    addRecord({ name: label, adapter: d.adapter, raw: raw });
    var model = parseRecord(records[records.length - 1]);
    $('detectInfo').innerHTML = '✓ 已导入 <b>' + (model ? model.messages.length : 0) + '</b> 条消息（' + d.adapter + '）' + speakerHint(model);
    $('detectInfo').className = 'hint ok';
  }
  function readAllFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    return Promise.all(files.map(function (f) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () { resolve({ name: f.name, text: String(reader.result || '') }); };
        reader.onerror = function () { resolve({ name: f.name, text: '', error: true }); };
        reader.readAsText(f);
      });
    }));
  }
  function importFiles(items) {
    var ok = 0, failed = [], lastModel = null;
    items.forEach(function (it) {
      if (it.error || !String(it.text || '').trim()) { failed.push(it.name + '（读取失败）'); return; }
      var d = globalThis.ChatImport.detect(it.text);
      if (!d || !d.adapter) { failed.push(it.name + '（无法识别）'); return; }
      addRecord({ name: it.name, adapter: d.adapter, raw: it.text });
      lastModel = parseRecord(records[records.length - 1]);
      ok++;
    });
    var msg = '✓ 已导入 ' + ok + ' 个文件' + speakerHint(lastModel);
    if (failed.length) msg += '；⚠ 未导入：' + failed.join('、');
    $('detectInfo').innerHTML = msg;
    $('detectInfo').className = 'hint ' + (failed.length ? '' : 'ok');
  }
  function importFolder(files) {
    var txts = files.filter(function (f) { return /\.txt$/i.test(f.name); });
    if (!txts.length) { $('detectInfo').textContent = '文件夹里没有找到 .txt 聊天记录文件'; $('detectInfo').className = 'hint'; return; }
    var main = txts.filter(function (f) { return f.name === '聊天记录.txt'; })[0];
    if (!main) main = txts.slice().sort(function (a, b) { return b.size - a.size; })[0];
    var reader = new FileReader();
    reader.onload = function () {
      var raw = String(reader.result || '');
      var d = globalThis.ChatImport.detect(raw);
      if (!d || !d.adapter) { $('detectInfo').textContent = '无法识别 TXT 格式：' + main.name; $('detectInfo').className = 'hint'; return; }
      var model = globalThis.ChatImport.toModel(raw, { me: { name: ($('myName').value || '').trim() } });
      var byName = {};
      files.forEach(function (f) {
        if (/\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i.test(f.name)) byName[f.name] = f;
      });
      var targets = [];
      model.messages.forEach(function (m) {
        if (m.type === 'image' && m.media && m.media.fileName && byName[m.media.fileName] && targets.length < 24) {
          targets.push({ m: m, key: m.media.fileName, kind: 'media' });
        }
      });
      model.messages.forEach(function (m) {
        if (m.sticker && m.sticker.imageFileName && byName[m.sticker.imageFileName] && targets.length < 24) {
          targets.push({ m: m, key: m.sticker.imageFileName, kind: 'sticker' });
        }
      });
      Promise.all(targets.map(function (t) {
        return new Promise(function (res) {
          var r = new FileReader();
          r.onload = function () {
            var url = String(r.result || '');
            if (t.kind === 'sticker') t.m.sticker.img = url; else t.m.media.dataUrl = url;
            res(true);
          };
          r.onerror = function () { res(false); };
          r.readAsDataURL(byName[t.key]);
        });
      })).then(function () {
        var images = {};
        model.messages.forEach(function (m) {
          if (m.media && m.media.dataUrl && m.media.fileName) images[m.media.fileName] = m.media.dataUrl;
          if (m.sticker && m.sticker.img && m.sticker.imageFileName) images[m.sticker.imageFileName] = m.sticker.img;
        });
        var n = Object.keys(images).length;
        addRecord({ name: main.name + (n ? '（含图片/表情包 ' + n + ' 个）' : ''), adapter: d.adapter, raw: raw, images: images });
        $('detectInfo').innerHTML = '✓ 已导入 ' + model.messages.length + ' 条消息' +
          (n ? '，内嵌图片/表情包 ' + n + ' 个' : '（文件夹中没有匹配到图片或表情包文件）') + speakerHint(model);
        $('detectInfo').className = 'hint ok';
      });
    };
    reader.readAsText(main);
  }

  /* ---- 截图 OCR ---- */
  /** 预处理：放大 + 灰度 + 对比度增强（提升深色/复杂壁纸截图的识别率） */
  function preprocessImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = Math.min(2, Math.max(1, 1400 / Math.max(1, w)));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          var data = ctx.getImageData(0, 0, cw, ch);
          var px = data.data;
          var min = 255, max = 0;
          for (var i = 0; i < px.length; i += 4) {
            var g = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) | 0;
            px[i] = px[i + 1] = px[i + 2] = g;
            if (g < min) min = g;
            if (g > max) max = g;
          }
          var range = Math.max(1, max - min);
          for (var j = 0; j < px.length; j += 4) {
            /* 归一化 + 对比度增强 */
            var v = ((px[j] - min) * 255) / range;
            v = (v - 128) * 1.35 + 128;
            v = v < 0 ? 0 : v > 255 ? 255 : v;
            px[j] = px[j + 1] = px[j + 2] = v | 0;
          }
          ctx.putImageData(data, 0, 0);
          resolve({ canvas: canvas, w: cw, h: ch });
        } catch (e) { reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
      img.src = url;
    });
  }
  function ocrRecognize(input, onProgress) {
    return globalThis.Tesseract.createWorker('chi_sim', 1, {
      logger: function (m) {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') onProgress(Math.round(m.progress * 100));
      }
    }).then(function (worker) {
      return worker.recognize(input).then(function (ret) {
        return worker.terminate().then(function () { return ret; });
      }, function (err) {
        return worker.terminate().then(function () { throw err; });
      });
    });
  }
  function handleImages(files) {
    if (!ocrReady()) {
      $('detectInfo').textContent = '⚠ OCR 组件未加载（vendor/ocr/tesseract.min.js 缺失）';
      $('detectInfo').className = 'hint';
      return;
    }
    var items = Array.prototype.slice.call(files || []);
    var idx = 0;
    var models = [];
    function finish() {
      if (models.length > 1) {
        var merged = globalThis.ChatImport.mergeByOverlap(models);
        addRecord({ name: models.length + ' 张截图（OCR 对齐合并 ' + merged.messages.length + ' 条）', adapter: 'screenshot-ocr', raw: globalThis.ChatImport.screenshotToText(merged) });
        $('detectInfo').innerHTML = '✓ 识别完成：' + models.length + ' 张截图对齐合并去重后共 <b>' + merged.messages.length + '</b> 条消息' + speakerHint(merged);
        $('detectInfo').className = 'hint ok';
      } else if (models.length === 1) {
        addRecord({ name: items[0].name + '（OCR ' + models[0].messages.length + ' 条）', adapter: 'screenshot-ocr', raw: globalThis.ChatImport.screenshotToText(models[0]) });
        $('detectInfo').innerHTML = '✓ 识别完成：' + models[0].messages.length + ' 条消息已加入记录列表' + speakerHint(models[0]);
        $('detectInfo').className = 'hint ok';
      } else {
        $('detectInfo').textContent = '没有从截图中识别出文字（图片可能不清晰）';
        $('detectInfo').className = 'hint';
      }
    }
    function next() {
      if (idx >= items.length) { finish(); return; }
      var f = items[idx];
      idx++;
      $('detectInfo').innerHTML = '正在识别截图 ' + idx + '/' + items.length + '：' + f.name +
        '<br>首次使用需联网下载中文语言模型（约 5MB，仅一次，之后离线可用）…';
      $('detectInfo').className = 'hint';
      Promise.all([
        preprocessImage(f),
        null
      ]).then(function (r) {
        var prep = r[0];
        return ocrRecognize(prep.canvas, function (p) {
          $('detectInfo').innerHTML = '正在识别 ' + f.name + ' … ' + p + '%';
        }).then(function (ret) {
          var lines = (ret && ret.data && Array.isArray(ret.data.lines))
            ? ret.data.lines.map(function (l) { return { text: l.text, bbox: l.bbox }; }) : [];
          var model = globalThis.ChatImport.parseScreenshotOcr(lines, {
            width: prep.w, height: prep.h,
            me: { name: ($('myName').value || '').trim() },
            dateHint: ($('ocrDate').value || '').trim(),
            originalFile: f.name
          });
          if (model && model.messages.length) models.push(model);
          next();
        });
      }).catch(function (e) {
        $('detectInfo').textContent = '识别失败：' + (e && e.message ? e.message : e) + '（首次使用需联网下载语言模型）';
        $('detectInfo').className = 'hint';
        next();
      });
    }
    next();
  }

  /* ---------- 生成报告与导出 ---------- */
  function generate() {
    var sel = records.filter(function (r) { return r.checked !== false; });
    var models = sel.map(parseRecord).filter(Boolean);
    if (!models.length) { $('recordsInfo').textContent = '勾选的记录没有可用数据'; return; }
    var range = getRange();
    var deps = { mergeModels: globalThis.ChatImport.mergeModels, filterByRange: globalThis.ChatImport.filterByRange };
    var filtered = globalThis.CRRecords.computeMerged(models, range, deps);
    if (!filtered.messages.length) { $('recordsInfo').textContent = '当前日期范围内没有消息，请调整范围或点「全部」'; return; }
    var tpl = selectedTemplate();
    var opts = {
      template: tpl,
      title: $('titleInput').value || filtered.meta.title || '聊天记录报告',
      generatedAt: new Date().toISOString()
    };
    lastModel = filtered;
    lastHtml = globalThis.ChatReport.generateHtml(filtered, opts);
    lastMd = globalThis.ChatReport.generateMarkdown(filtered, opts);
    $('frame').srcdoc = lastHtml;
    $('mdView').textContent = lastMd;
    $('emptyHint').style.display = 'none';
    showTab('html');
    $('recordsInfo').textContent = '✓ 报告已生成：' + filtered.messages.length + ' 条消息 · 模板「' + tpl + '」';
  }
  function showTab(which) {
    var html = which === 'html';
    $('frame').style.display = html ? 'block' : 'none';
    $('mdView').style.display = html ? 'none' : 'block';
    $('tabHtml').className = html ? 'active' : '';
    $('tabMd').className = html ? '' : 'active';
  }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  }

  /* ---------- 事件绑定 ---------- */
  $('btnDetect').addEventListener('click', function () {
    var raw = $('importText').value;
    if (!raw.trim()) { $('detectInfo').textContent = '请先粘贴导出内容'; $('detectInfo').className = 'hint'; return; }
    importOne(raw, '粘贴内容');
  });
  $('btnPickFile').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function () {
    var list = this.files;
    if (!list || !list.length) return;
    readAllFiles(list).then(importFiles);
    this.value = '';
  });
  $('btnPickFolder').addEventListener('click', function () { $('folderInput').click(); });
  $('folderInput').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []);
    if (!files.length) return;
    importFolder(files);
    this.value = '';
  });
  $('btnPickImages').addEventListener('click', function () { $('imgInput').click(); });
  $('imgInput').addEventListener('change', function () {
    var list = this.files;
    if (!list || !list.length) return;
    handleImages(list);
    this.value = '';
  });
  /** 统一模型 → 微信合并转发规范文本（含 peers 名称回退） */
  function modelToText(model) {
    var out = [];
    var nameById = {};
    (model.peers || []).forEach(function (p) { nameById[p.id] = p.name; });
    var meta = model.meta || {};
    if (meta.me) nameById[meta.me.id] = meta.me.name || '我';
    if (meta.other) nameById[meta.other.id] = meta.other.name || '对方';
    (model.messages || []).forEach(function (m) {
      var t = String(m.time || '');
      var d = t.slice(0, 10).split('-');
      if (!d[0] || d.length < 3) return;
      out.push('·' + (nameById[m.peerId] || '对方'));
      out.push(d[0] + '年' + parseInt(d[1], 10) + '月' + parseInt(d[2], 10) + '日 ' + t.slice(11, 16));
      out.push(m.text || '[' + m.type + ']');
      out.push('');
    });
    return out.join('\n');
  }

  $('btnLoadDemo').addEventListener('click', function () {
    var ds = globalThis.DEMO_DATASETS;
    if (!ds) { $('detectInfo').textContent = '演示数据集缺失（data.js 未生成，请运行总构建）'; $('detectInfo').className = 'hint'; return; }
    Object.keys(ds).forEach(function (k) {
      var m = ds[k];
      addRecord({ name: '演示·' + (m.meta.title || k), adapter: 'demo', raw: modelToText(m) });
    });
    $('detectInfo').innerHTML = '✓ 已载入 3 套演示数据集（恋爱/亲情/友情），勾选即可生成报告';
    $('detectInfo').className = 'hint ok';
  });
  $('btnGenerate').addEventListener('click', generate);
  $('btnClearRecords').addEventListener('click', function () { records = []; dbClear(); renderRecords(); });
  $('tabHtml').addEventListener('click', function () { showTab('html'); });
  $('tabMd').addEventListener('click', function () { showTab('md'); });
  $('rangeFrom').addEventListener('change', refreshInfo);
  $('rangeTo').addEventListener('change', refreshInfo);
  $('btnRangeClear').addEventListener('click', function () {
    $('rangeFrom').value = ''; $('rangeTo').value = ''; refreshInfo();
  });
  document.querySelectorAll('input[name="tpl"]').forEach(function (n) { n.addEventListener('change', function () { if (lastModel) generate(); }); });
  $('btnDownloadHtml').addEventListener('click', function () {
    if (!lastHtml) return;
    download(($('titleInput').value || 'chat-report') + '.html', lastHtml, 'text/html;charset=utf-8');
  });
  $('btnDownloadMd').addEventListener('click', function () {
    if (!lastMd) return;
    download(($('titleInput').value || 'chat-report') + '.md', lastMd, 'text/markdown;charset=utf-8');
  });
  $('btnCopyHtml').addEventListener('click', function () {
    if (!lastHtml) return;
    function done(ok) {
      var btn = $('btnCopyHtml');
      var old = btn.textContent;
      btn.textContent = ok ? '✓ 已复制' : '复制失败';
      setTimeout(function () { btn.textContent = old; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastHtml).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = lastHtml;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
      done(ok);
    }
  });
  $('btnPrint').addEventListener('click', function () {
    if (!lastHtml) return;
    var w = window.open('', '_blank');
    if (!w) { alert('请允许弹出窗口后重试'); return; }
    w.document.open();
    w.document.write(lastHtml);
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 400);
  });

  /* ---------- 启动 ---------- */
  registerSW();
  dbGetAll().then(function (list) {
    records = list || [];
    renderRecords();
  }).catch(function () { renderRecords(); });
})();
