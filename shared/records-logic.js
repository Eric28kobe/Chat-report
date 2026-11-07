/* shared/records-logic.js — popup 记录列表的纯逻辑（可 node 测试）：合并 + 预览汇总。
 * 挂 globalThis.CRRecords。依赖以参数注入（deps），popup 传入 ChatImport/ChatReport，测试传入桩。
 */
(function () {
  'use strict';

  var R = (globalThis.CRRecords = globalThis.CRRecords || {});

  /**
   * 计算勾选记录合并结果。
   * models: 解析后的统一模型数组；range: { from, to }（'YYYY-MM-DD' 或 null）；
   * deps: { mergeModels(models), filterByRange(model, from, to) }
   */
  R.computeMerged = function (models, range, deps) {
    var merged = models.length === 1 ? models[0] : deps.mergeModels(models);
    return deps.filterByRange(merged, range.from, range.to);
  };

  /**
   * 生成合并预览摘要。
   * filtered: 合并+筛选后的模型；analyzeFn: 可选的 ChatReport.analyze
   * 返回 { count, first, last, months, activeDays, stickers }
   */
  R.summarize = function (filtered, analyzeFn) {
    var sum = { count: 0, first: '', last: '', months: 0, activeDays: 0, stickers: 0 };
    if (!filtered || !filtered.messages || !filtered.messages.length) return sum;
    sum.count = filtered.messages.length;
    sum.first = filtered.messages[0].time.slice(0, 10);
    sum.last = filtered.messages[filtered.messages.length - 1].time.slice(0, 10);
    if (analyzeFn) {
      try {
        var s = analyzeFn(filtered);
        if (s) {
          sum.months = s.monthly ? s.monthly.length : 0;
          sum.activeDays = s.span ? s.span.activeDays : 0;
          if (s.stickers && s.stickers.length) {
            sum.stickers = s.stickers.reduce(function (a, b) { return a + (b.count || 0); }, 0);
          }
        }
      } catch (e) { /* analyze 失败不影响主流程 */ }
    }
    return sum;
  };

  /** 判断记录是否需要用户选择「我是谁」：有 ≥2 位发言人且 myName 未指定或不在列表中 */
  R.needsSpeakerPick = function (speakers, myName) {
    if (!Array.isArray(speakers) || speakers.length < 2) return false;
    const mine = String(myName || '').replace(/^[·•\s]+/, '').trim();
    if (!mine) return true;
    for (const s of speakers) {
      if (String(s).replace(/^[·•\s]+/, '').trim() === mine) return false;
    }
    return true;
  };

  /** 生成预览文本（popup 显示用） */
  R.previewText = function (sum, extra) {
    var text = '合并预览：<b>' + sum.count + '</b> 条';
    if (sum.first) text += ' · ' + sum.first + ' → ' + sum.last;
    if (extra && extra.months) text += ' · 月度趋势 ' + extra.months + ' 个月';
    if (extra && extra.activeDays) text += ' · 活跃 ' + extra.activeDays + ' 天';
    if (extra && extra.stickers) text += ' · 表情包 ' + extra.stickers + ' 个';
    return text;
  };
})();
