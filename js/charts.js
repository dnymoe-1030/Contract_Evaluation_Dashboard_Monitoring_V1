/**
 * Service Management Contract Evaluation Monitor
 * Chart Renderers with Chart.js
 */

var ChartManager = (function () {
  'use strict';

  var charts = {};

  function initDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = "'Public Sans', system-ui, sans-serif";
    Chart.defaults.color = cssVar('--text-secondary');
    Chart.defaults.animation = false;
  }

  function destroy(name) {
    if (charts[name]) {
      charts[name].destroy();
      charts[name] = null;
    }
  }

  function baseGridOpts(axis) {
    return {
      grid: { color: cssVar('--grid'), drawTicks: false },
      border: { color: cssVar('--axis') },
      ticks: { color: cssVar('--text-muted'), font: { size: 11 } }
    };
  }

  function tooltipStyle() {
    return {
      backgroundColor: cssVar('--surface-raised'),
      titleColor: cssVar('--text-primary'),
      bodyColor: cssVar('--text-secondary'),
      borderColor: cssVar('--border-strong'),
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      titleFont: { weight: '700', size: 12 },
      bodyFont: { size: 11.5 },
      displayColors: true,
      boxPadding: 4
    };
  }

  // 1. Reminder Compliance by Priority
  function renderReminderChart(active, onDrill) {
    destroy('reminder');
    var elCanvas = document.getElementById('chartReminder');
    if (!elCanvas) return;

    var byPriority = {};
    PRIORITY_ORDER.forEach(function (p) { byPriority[p] = [0, 0, 0, 0]; });
    active.forEach(function (r) {
      if (!r.priority) return;
      var idx = Math.min(r.reminderCount, 3);
      byPriority[r.priority][idx] += 1;
    });

    var alphaSteps = [0.24, 0.52, 0.78, 1];
    var labels = ['0x', '1x', '2x', '3x'];
    var datasets = labels.map(function (lbl, i) {
      return {
        label: lbl + ' reminder',
        data: PRIORITY_ORDER.map(function (p) { return byPriority[p][i]; }),
        backgroundColor: function (ctx) {
          var p = PRIORITY_ORDER[ctx.dataIndex];
          return hexToRgba(cssVar(PRIORITY_COLOR_VAR[p]), alphaSteps[i]);
        },
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.62,
        categoryPercentage: 0.72
      };
    });

    var ctx = elCanvas.getContext('2d');
    charts.reminder = new Chart(ctx, {
      type: 'bar',
      data: { labels: PRIORITY_ORDER, datasets: datasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: Object.assign({ stacked: true, beginAtZero: true, ticks: { precision: 0 } }, baseGridOpts()),
          y: Object.assign({
            stacked: true,
            ticks: {
              color: function (ctx) { return cssVar(PRIORITY_COLOR_VAR[PRIORITY_ORDER[ctx.index]]); },
              font: { size: 11, weight: '700' }
            }
          }, baseGridOpts())
        },
        plugins: { legend: { display: false }, tooltip: tooltipStyle() },
        onClick: function (evt, elements) {
          if (!elements.length || typeof onDrill !== 'function') return;
          var el = elements[0];
          var priority = PRIORITY_ORDER[el.index];
          var bucketIdx = el.datasetIndex;
          var recs = active.filter(function (r) { return r.priority === priority && Math.min(r.reminderCount, 3) === bucketIdx; });
          onDrill('Priority ' + priority + ' · Reminder ' + labels[bucketIdx], recs, 'active');
        }
      }
    });

    var legendEl = document.getElementById('legendReminder');
    if (legendEl) {
      legendEl.innerHTML = '<span class="legend-item">Color = Priority (same as table) &middot; transparent = 0x reminders, solid = 3x reminders sent</span>';
    }
  }

  // 2. Contract Due Date Timeline
  function renderTimelineChart(active, onDrill) {
    destroy('timeline');
    var elCanvas = document.getElementById('chartTimeline');
    if (!elCanvas) return;

    var buckets = {};
    active.forEach(function (r) {
      if (r.daysRemaining === null || r.daysRemaining < 0) return;
      var b = weekBucketLabel(r.daysRemaining);
      buckets[b.idx] = buckets[b.idx] || { label: b.label, count: 0, urgent: 0 };
      buckets[b.idx].count += 1;
      if (r.priority === 'URGENT' || r.priority === 'HIGH') buckets[b.idx].urgent += 1;
    });

    var idxs = Object.keys(buckets).map(Number).sort(function (a, b) { return a - b; });
    var labels = idxs.map(function (i) { return buckets[i].label; });
    var data = idxs.map(function (i) { return buckets[i].count; });
    var barPriorities = idxs.map(function (bucketIdx) { return priorityForDays(bucketIdx * 7); });

    var ctx = elCanvas.getContext('2d');
    charts.timeline = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Contracts due',
          data: data,
          backgroundColor: function (ctx) { return cssVar(PRIORITY_COLOR_VAR[barPriorities[ctx.dataIndex]]); },
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: Object.assign({}, baseGridOpts(), { grid: { display: false } }),
          y: Object.assign({ beginAtZero: true, ticks: { precision: 0 } }, baseGridOpts())
        },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(tooltipStyle(), {
            callbacks: {
              label: function (c) { return c.parsed.y + ' contracts · zone ' + barPriorities[c.dataIndex]; }
            }
          })
        },
        onClick: function (evt, elements) {
          if (!elements.length || typeof onDrill !== 'function') return;
          var i = elements[0].index;
          var bucketIdx = idxs[i];
          var lo = bucketIdx * 7, hi = bucketIdx * 7 + 6;
          var recs = active.filter(function (r) { return r.daysRemaining !== null && r.daysRemaining >= lo && r.daysRemaining <= hi; });
          onDrill('Due ' + buckets[bucketIdx].label, recs, 'active');
        }
      }
    });

    var legendTimelineEl = document.getElementById('legendTimeline');
    if (legendTimelineEl) {
      legendTimelineEl.innerHTML = PRIORITY_ORDER.map(function (p) {
        return '<span class="legend-item"><span class="legend-dot" style="background:' + cssVar(PRIORITY_COLOR_VAR[p]) + '"></span>' + p + '</span>';
      }).join('');
    }
  }

  // 3. Evaluation Process Stage Funnel
  function renderFunnelChart(active, onDrill) {
    destroy('funnel');
    var elCanvas = document.getElementById('chartFunnel');
    if (!elCanvas) return;

    var counts = {};
    active.forEach(function (r) { counts[r.remarks] = (counts[r.remarks] || 0) + 1; });
    var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; }).sort(function (a, b) { return b[1] - a[1]; });

    var ctx = elCanvas.getContext('2d');
    charts.funnel = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map(function (e) { return e[0]; }),
        datasets: [{
          data: entries.map(function (e) { return e[1]; }),
          backgroundColor: cssVar('--accent'),
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.6,
          categoryPercentage: 0.72
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: Object.assign({ beginAtZero: true, ticks: { precision: 0 } }, baseGridOpts()),
          y: Object.assign({}, baseGridOpts(), { grid: { display: false } })
        },
        plugins: { legend: { display: false }, tooltip: tooltipStyle() },
        onClick: function (evt, elements) {
          if (!elements.length || typeof onDrill !== 'function') return;
          var label = entries[elements[0].index][0];
          var recs = active.filter(function (r) { return r.remarks === label; });
          onDrill('Process Stage · ' + label, recs, 'active');
        }
      }
    });
  }

  // 4. SLA Performance Chart
  function renderSlaChart(completedFiltered, onDrill) {
    destroy('sla');
    var elCanvas = document.getElementById('chartSla');
    if (!elCanvas) return;

    var counts = { 'Late': 0, '21 Up': 0, '7 - 20': 0, '0 - 7': 0 };
    completedFiltered.forEach(function (r) { if (r.sla && counts.hasOwnProperty(r.sla)) counts[r.sla] += 1; });
    var labels = SLA_ORDER.map(function (k) { return SLA_LABEL[k]; });
    var data = SLA_ORDER.map(function (k) { return counts[k]; });
    var colors = SLA_ORDER.map(function (k) { return cssVar(SLA_COLOR_VAR[k]); });

    var ctx = elCanvas.getContext('2d');
    charts.sla = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: Object.assign({}, baseGridOpts(), { grid: { display: false } }),
          y: Object.assign({ beginAtZero: true, ticks: { precision: 0 } }, baseGridOpts())
        },
        plugins: { legend: { display: false }, tooltip: tooltipStyle() },
        onClick: function (evt, elements) {
          if (!elements.length || typeof onDrill !== 'function') return;
          var key = SLA_ORDER[elements[0].index];
          var recs = completedFiltered.filter(function (r) { return r.sla === key; });
          onDrill('SLA · ' + SLA_LABEL[key], recs, 'completed');
        }
      }
    });
  }

  // 5. WeSign Status Chart
  function renderWesignChart(active, onDrill) {
    destroy('wesign');
    var elCanvas = document.getElementById('chartWesign');
    if (!elCanvas) return;

    var counts = {};
    active.forEach(function (r) { counts[r.wesign] = (counts[r.wesign] || 0) + 1; });
    var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; }).sort(function (a, b) { return b[1] - a[1]; });

    var ctx = elCanvas.getContext('2d');
    charts.wesign = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map(function (e) { return e[0]; }),
        datasets: [{
          data: entries.map(function (e) { return e[1]; }),
          backgroundColor: cssVar('--accent'),
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.5,
          categoryPercentage: 0.6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: Object.assign({ beginAtZero: true, ticks: { precision: 0 } }, baseGridOpts()),
          y: Object.assign({}, baseGridOpts(), { grid: { display: false } })
        },
        plugins: { legend: { display: false }, tooltip: tooltipStyle() },
        onClick: function (evt, elements) {
          if (!elements.length || typeof onDrill !== 'function') return;
          var label = entries[elements[0].index][0];
          var recs = active.filter(function (r) { return r.wesign === label; });
          onDrill('WeSign Status · ' + label, recs, 'active');
        }
      }
    });
  }

  // 6. Pillar Distribution Chart
  function renderPillarChart(active, onDrill) {
    destroy('pillar');
    var elCanvas = document.getElementById('chartPillar');
    if (!elCanvas) return;

    var pillars = uniqueSorted(active, 'pillar');
    var byPillar = {};
    pillars.forEach(function (p) { byPillar[p] = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }; });
    active.forEach(function (r) { if (r.priority && byPillar[r.pillar]) byPillar[r.pillar][r.priority] += 1; });
    var totals = pillars.map(function (p) {
      var v = byPillar[p]; return [p, v.URGENT + v.HIGH + v.MEDIUM + v.LOW];
    }).sort(function (a, b) { return b[1] - a[1]; }).map(function (e) { return e[0]; });

    var datasets = PRIORITY_ORDER.map(function (p) {
      return {
        label: p,
        data: totals.map(function (pl) { return byPillar[pl][p]; }),
        backgroundColor: cssVar(PRIORITY_COLOR_VAR[p]),
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.72
      };
    });

    var ctx = elCanvas.getContext('2d');
    charts.pillar = new Chart(ctx, {
      type: 'bar',
      data: { labels: totals, datasets: datasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: Object.assign({ stacked: true, beginAtZero: true, ticks: { precision: 0 } }, baseGridOpts()),
          y: Object.assign({ stacked: true }, baseGridOpts())
        },
        plugins: { legend: { display: false }, tooltip: tooltipStyle() },
        onClick: function (evt, elements) {
          if (!elements.length || typeof onDrill !== 'function') return;
          var el = elements[0];
          var priority = PRIORITY_ORDER[el.datasetIndex];
          var pillar = totals[el.index];
          var recs = active.filter(function (r) { return r.pillar === pillar && r.priority === priority; });
          onDrill(pillar + ' · Priority ' + priority, recs, 'active');
        }
      }
    });

    var legendEl = document.getElementById('legendPillar');
    if (legendEl) {
      legendEl.innerHTML = PRIORITY_ORDER.map(function (p) {
        return '<span class="legend-item"><span class="legend-dot" style="background:' + cssVar(PRIORITY_COLOR_VAR[p]) + '"></span>' + p + '</span>';
      }).join('');
    }
  }

  // 7. SM PIC Distribution Chart
  function renderPicChart(active, onDrill) {
    destroy('pic');
    var elCanvas = document.getElementById('chartPic');
    if (!elCanvas) return;

    var counts = {};
    active.forEach(function (r) { var k = r.smPic || 'Unassigned'; counts[k] = (counts[k] || 0) + 1; });
    var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; }).sort(function (a, b) { return b[1] - a[1]; });

    var ctx = elCanvas.getContext('2d');
    charts.pic = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map(function (e) { return e[0]; }),
        datasets: [{
          data: entries.map(function (e) { return e[1]; }),
          backgroundColor: cssVar('--accent'),
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.68
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: Object.assign({}, baseGridOpts(), { grid: { display: false } }),
          y: Object.assign({ beginAtZero: true, ticks: { precision: 0 } }, baseGridOpts())
        },
        plugins: { legend: { display: false }, tooltip: tooltipStyle() },
        onClick: function (evt, elements) {
          if (!elements.length || typeof onDrill !== 'function') return;
          var label = entries[elements[0].index][0];
          var recs = active.filter(function (r) { return (r.smPic || 'Unassigned') === label; });
          onDrill('SM PIC · ' + label, recs, 'active');
        }
      }
    });
  }

  return {
    initDefaults: initDefaults,
    renderReminderChart: renderReminderChart,
    renderTimelineChart: renderTimelineChart,
    renderFunnelChart: renderFunnelChart,
    renderSlaChart: renderSlaChart,
    renderWesignChart: renderWesignChart,
    renderPillarChart: renderPillarChart,
    renderPicChart: renderPicChart,
    destroyAll: function () {
      Object.keys(charts).forEach(destroy);
    }
  };
})();
