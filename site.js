
(function () {
  function tick() {
    var now = new Date();
    document.querySelectorAll('[data-until]').forEach(function (box) {
      var ms = new Date(box.dataset.until) - now;
      if (ms < 0) ms = 0;
      var s = Math.floor(ms / 1000);
      var d = box.querySelector('[data-cd="d"]'), h = box.querySelector('[data-cd="h"]'),
          m = box.querySelector('[data-cd="m"]'), sec = box.querySelector('[data-cd="s"]');
      if (d) d.textContent = Math.floor(s / 86400);
      if (h) h.textContent = Math.floor(s % 86400 / 3600);
      if (m) m.textContent = Math.floor(s % 3600 / 60);
      if (sec) sec.textContent = s % 60;
    });
    var evs = document.querySelectorAll('.ev[data-when]');
    var marked = false;
    evs.forEach(function (el) {
      var t = new Date(el.dataset.when), st = el.querySelector('.st');
      el.classList.remove('past', 'next');
      if (!st) return;
      if (t < now) { el.classList.add('past'); st.textContent = 'انقضى'; }
      else {
        st.textContent = 'قادم';
        if (!marked) { marked = true; el.classList.add('next'); st.textContent = 'التالي'; }
      }
    });
  }
  /* «اليوم» في شريط الأيام — يُحسب هنا لا وقت البناء، وإلا كذب غداً على
     صفحةٍ ساكنة. وبتوقيت الرياض لا بساعة الجهاز، فزائرٌ بساعةٍ على توقيت
     آخر لا يرى يوماً غير يومنا — نفس اصطلاح «الطقس الآن». */
  function riyadhToday() {
    try {
      var o = {};
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh',
        year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
      return o.year + '-' + o.month + '-' + o.day;
    } catch (e) { return null; }
  }

  function markToday() {
    var iso = riyadhToday();
    document.querySelectorAll('.mstrip').forEach(function (strip) {
      var hit = null;
      strip.querySelectorAll('.mday').forEach(function (c) {
        c.classList.remove('today');
        if (iso && c.dataset.d === iso) { c.classList.add('today'); hit = c; }
      });
      var lbl = strip.parentNode.querySelector('[data-today]');
      /* لا يُترك شرطةً صامتة: إمّا يومٌ في المدى، أو تصريحٌ بأنه خارجه */
      if (lbl) lbl.textContent = hit ? hit.dataset.h : 'خارج هذا المدى';
    });
  }
  /* الشمس والقمر — الأفق محسوبٌ بمحرّكنا وقت البناء، والمتصفّح يختار يومه
     منه. فلا حساب فلكيّ هنا ولا قاعدة رسمٍ مُعادة: المسار `p` يأتي جاهزاً. */
  function smRender() {
    var tag = document.getElementById('sm-data');
    if (!tag) return;
    var rows;
    try { rows = JSON.parse(tag.textContent); } catch (e) { return; }
    var iso = riyadhToday();
    var i = -1;
    for (var j = 0; j < rows.length; j++) { if (rows[j].d === iso) { i = j; break; } }
    var stale = document.getElementById('sm-stale');
    /* خارج الأفق — أو في آخر ستّة أيام منه فلا يكتمل الأسبوع بعده: يُترك ما
       بناه الخادم ويُصرَّح بأنه يوم النشر لا يوم القارئ. وبغير هذا الحدّ
       يُكرَّر آخرُ يومٍ سبع مرّات في صفّ الأسبوع. */
    if (i < 0 || i > rows.length - 7) {
      if (stale) stale.hidden = false;
      return;
    }
    if (stale) stale.hidden = true;

    function fill(el, row, isToday) {
      el.querySelectorAll('[data-k]').forEach(function (n) {
        var k = n.dataset.k, v = row[k];
        if (v === undefined || v === null) return;
        if (k === 'p') n.setAttribute('d', v);
        else if (k === 'wd') n.textContent = isToday ? 'اليوم' : v;
        else n.textContent = v;
      });
    }
    var now = document.getElementById('sm-now');
    if (now) fill(now, rows[i], true);
    document.querySelectorAll('#sm-week .sm-card').forEach(function (card, k) {
      var row = rows[Math.min(i + k, rows.length - 1)];
      card.classList.toggle('today', k === 0);
      fill(card, row, k === 0);
    });
  }

  markToday(); smRender();
  setInterval(function () { markToday(); smRender(); }, 60000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { markToday(); smRender(); }
  });

  tick(); setInterval(tick, 1000);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: .12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  document.querySelectorAll('.copy[data-copy]').forEach(function (btn) {
    var base = btn.textContent;
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(btn.dataset.copy).then(function () {
        btn.textContent = 'نُسخ ✓';
        btn.classList.add('done');
        setTimeout(function () { btn.textContent = base; btn.classList.remove('done'); }, 1800);
      });
    });
  });
})();

/* ═══════════ الطقس الآن — جلب حيّ في متصفّح القارئ ═══════════
   يعمل في صفحة الطقس وحدها (يخرج فوراً إن لم يجد #liveNow).
   نداء واحد يجلب current+hourly+daily معاً، فلا تتكرّر الرحلة حين
   تُبنى الأقسام اللاحقة (الساعي والسبعة أيام). */
(function () {
  var root = document.getElementById('liveNow');
  if (!root || !window.fetch) return;

  var AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  var MON = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
             'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var DAY = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  var lastOk = 0, busy = false;

  function q(sel) { return root.querySelector(sel); }
  function nf(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d)
           .replace(/\.0+$/, '');
  }
  function dirName(deg) {
    if (deg === null || deg === undefined) return '';
    return (window.WDIRS || [])[Math.round(deg / 45) % 8] || '';
  }
  function url() {
    var p = new URLSearchParams({
      latitude: root.dataset.lat, longitude: root.dataset.lon,
      elevation: root.dataset.elev,
      timezone: root.dataset.tz,          /* صريح — وإلا رجع بتوقيت UTC */
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,' +
               'weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,' +
               'pressure_msl,uv_index,visibility,precipitation',
      hourly: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,' +
              'precipitation,precipitation_probability,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      forecast_days: '7'
    });
    return 'https://api.open-meteo.com/v1/forecast?' + p.toString();
  }

  /* الوقت من الواجهة لا من ساعة الجهاز: زائر بساعة مضبوطة على توقيت
     آخر كان سيرى «الآن» خطأً. نقرأ current.time كنصّ محلّي جاهز. */
  function whenText(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
    if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3];
    var wd = DAY[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
    return wd + ' ' + d + ' ' + MON[mo - 1] + ' ' + y + 'م · ' +
           m[4] + ':' + m[5] + ' بتوقيت سراة عبيدة';
  }

  function fill(data) {
    var c = data.current || {};
    var cond = (window.WMO || {})[String(c.weather_code)] || 'غير معروفة';
    q('.lv-when').textContent = whenText(c.time);
    q('.lv-cond').innerHTML = '— <strong>' + cond + '</strong>';

    var vis = (c.visibility === null || c.visibility === undefined)
      ? '—' : nf(c.visibility / 1000, 1) + ' كم';
    var vals = {
      temp: nf(c.temperature_2m, 1) + '°',
      feels: nf(c.apparent_temperature, 1) + '°',
      hum: nf(c.relative_humidity_2m, 0) + '٪',
      vis: vis
    };
    Object.keys(vals).forEach(function (k) {
      var el = root.querySelector('[data-lv="' + k + '"] .lv-v');
      if (el) el.textContent = vals[k];
    });

    /* البوصلة: تدوير الإبرة المرسومة مسبقاً نحو الاتجاه الفعلي */
    var ws = root.querySelector('[data-lv="wind"] svg');
    if (ws && c.wind_direction_10m !== undefined && c.wind_direction_10m !== null) {
      ws.querySelector('.lv-needle').setAttribute('transform',
        'rotate(' + c.wind_direction_10m + ' ' + ws.dataset.cx + ' ' + ws.dataset.cy + ')');
      ws.querySelector('.lv-speed').textContent = nf(c.wind_speed_10m, 0);
      ws.setAttribute('aria-label', 'اتجاه الرياح ' + Math.round(c.wind_direction_10m) +
        ' درجة، السرعة ' + nf(c.wind_speed_10m, 0) + ' كم/س');
    }
    q('.lv-wind').textContent = 'الرياح ' + nf(c.wind_speed_10m, 1) + ' كم/س، من ' +
      dirName(c.wind_direction_10m) +
      (c.wind_gusts_10m ? ' · هبّات ' + nf(c.wind_gusts_10m, 0) : '');

    /* الضغط: زاوية الإبرة من نسبة القيمة داخل المدى المُعلَن في data */
    var ps = root.querySelector('[data-lv="pres"] svg');
    if (ps && c.pressure_msl !== undefined && c.pressure_msl !== null) {
      var a0 = +ps.dataset.a0, a1 = +ps.dataset.a1,
          v0 = +ps.dataset.vmin, v1 = +ps.dataset.vmax;
      var fr = Math.max(0, Math.min(1, (c.pressure_msl - v0) / (v1 - v0)));
      ps.querySelector('.lv-needle').setAttribute('transform',
        'rotate(' + (fr * (a1 - a0)).toFixed(2) + ' ' + ps.dataset.cx + ' ' + ps.dataset.cy + ')');
      ps.querySelector('.lv-gval').textContent = nf(c.pressure_msl, 1);
      ps.setAttribute('aria-label', 'الضغط ' + nf(c.pressure_msl, 1) + ' هكتوباسكال');
    }
    q('.lv-pres').textContent = 'الضغط ' + nf(c.pressure_msl, 1) + ' هكتوباسكال';

    /* UV: نقل العلامة وحدها على الشريط */
    var us = root.querySelector('[data-lv="uv"] svg');
    if (us && c.uv_index !== undefined && c.uv_index !== null) {
      var fu = Math.max(0, Math.min(1, c.uv_index / +us.dataset.vmax));
      var mk = us.querySelector('.lv-uv-mark');
      mk.setAttribute('cx', (+us.dataset.x0 + fu * +us.dataset.w).toFixed(1));
      mk.setAttribute('visibility', 'visible');
      us.setAttribute('aria-label', 'مؤشّر الأشعة فوق البنفسجية ' + nf(c.uv_index, 1));
    }
    q('.lv-uv-l').textContent = 'مؤشّر UV ' + nf(c.uv_index, 1);

    root.classList.add('lv-ready');
    root.classList.remove('lv-loading');
    q('.lv-fail').hidden = true;
    lastOk = Date.now();
    fillHourly(data);
  }

  /* ═══ الشريط الساعي — من نفس الردّ، بلا نداء ثانٍ ═══ */
  function fillHourly(data) {
    var box = document.getElementById('liveHourly');
    if (!box || !data.hourly || !data.hourly.time) return;
    var H = data.hourly, cells = box.querySelectorAll('.hr-cell');

    /* «الآن» من الواجهة لا من ساعة الجهاز: أول ساعة لا تسبق current.time */
    var nowKey = (data.current && data.current.time || '').slice(0, 13);
    var start = 0;
    for (var i = 0; i < H.time.length; i++) {
      if (H.time[i].slice(0, 13) >= nowKey) { start = i; break; }
    }

    var maxW = 0;
    for (var j = start; j < Math.min(start + cells.length, H.time.length); j++) {
      if (H.wind_speed_10m && H.wind_speed_10m[j] > maxW) maxW = H.wind_speed_10m[j];
    }

    cells.forEach(function (cell, k) {
      var idx = start + k;
      if (idx >= H.time.length) { cell.hidden = true; return; }
      cell.hidden = false;
      var t = H.time[idx], hh = t.slice(11, 16);
      var code = H.weather_code ? H.weather_code[idx] : null;
      var day = H.is_day ? H.is_day[idx] : 1;
      var key = (window.CONDKEY || {})[String(code)] || 'cloud';
      if (!day && (window.CONDNIGHT || {})[key]) key = window.CONDNIGHT[key];

      cell.querySelector('.hr-t').textContent = (k === 0) ? 'الآن' : hh;
      cell.classList.toggle('now', k === 0);
      /* حدّ اليوم: أول خانة بعد منتصف الليل تحمل تاريخها */
      cell.classList.toggle('daybreak', k > 0 && hh === '00:00');
      if (k > 0 && hh === '00:00') cell.dataset.day = t.slice(8, 10) + '/' + t.slice(5, 7);
      else cell.removeAttribute('data-day');

      cell.querySelector('.hr-i').innerHTML =
        '<svg viewBox="0 0 24 24" class="hr-svg" aria-hidden="true">' +
        ((window.CONDSVG || {})[key] || '') + '</svg>';
      var temp = H.temperature_2m ? H.temperature_2m[idx] : null;
      cell.querySelector('.hr-v').textContent = (temp === null ? '—' : Math.round(temp) + '°');

      /* الهطول: يظهر حين يتوقّعه النموذج فقط — لا صفر مكرّر ٤٨ مرة */
      var mm = H.precipitation ? H.precipitation[idx] : 0;
      var pp = H.precipitation_probability ? H.precipitation_probability[idx] : null;
      var pe = cell.querySelector('.hr-p');
      pe.classList.remove('prob');
      if (mm && mm > 0.04) {
        pe.textContent = (mm < 1 ? mm.toFixed(1) : Math.round(mm)) + ' مم';
      } else if (pp !== null && pp >= 30) {
        pe.textContent = pp + '٪';
        pe.classList.add('prob');
      } else {
        pe.textContent = '';   /* يبقى في التدفّق بارتفاعه، وإلا انكمشت الخانة */
      }

      /* الرياح: سهم مُدار نحو مصدر الهبوب، وشدّة اللون بالسرعة — بلا رقم */
      var wd = H.wind_direction_10m ? H.wind_direction_10m[idx] : null;
      var ws = H.wind_speed_10m ? H.wind_speed_10m[idx] : null;
      var we = cell.querySelector('.hr-w');
      if (wd === null || wd === undefined) { we.innerHTML = ''; }
      else {
        var op = maxW > 0 ? (0.28 + 0.72 * Math.min(1, ws / maxW)) : 0.5;
        we.innerHTML = '<svg viewBox="0 0 16 16" class="hr-arrow" aria-hidden="true" ' +
          'style="opacity:' + op.toFixed(2) + '"><g transform="rotate(' + wd + ' 8 8)">' +
          '<path d="M8 2.4 L8 13.6 M8 2.4 L5.2 6 M8 2.4 L10.8 6" fill="none" ' +
          'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
          'stroke-linejoin="round"/></g></svg>';
        we.setAttribute('title', 'الرياح من ' + dirName(wd) + '، نحو ' +
          nf(ws, 0) + ' كم/س (مؤشّر تقريبي)');
      }
    });

    box.classList.add('hr-ready');
    box.querySelector('.hr-fail').hidden = true;
    fillDaily(data);
  }

  /* ═══ سبعة أيام — dumbbell على محور مشترك، من نفس الردّ ═══ */
  function fillDaily(data) {
    var box = document.getElementById('liveDaily');
    if (!box || !data.daily || !data.daily.time) return;
    var D = data.daily, rows = box.querySelectorAll('.d7-row');
    var n = Math.min(rows.length, D.time.length);

    /* محور واحد لكل الأيام: بدونه يُقارَن يومٌ بمقياس ويومٌ بآخر */
    var los = [], his = [];
    for (var i = 0; i < n; i++) {
      if (D.temperature_2m_min[i] !== null) los.push(D.temperature_2m_min[i]);
      if (D.temperature_2m_max[i] !== null) his.push(D.temperature_2m_max[i]);
    }
    if (!los.length || !his.length) return;
    var A = Math.floor(Math.min.apply(null, los)) - 1;
    var B = Math.ceil(Math.max.apply(null, his)) + 1;
    var pos = function (v) { return ((v - A) / (B - A)) * 100; };

    /* علامات المحور بخطوة 5° داخل المدى */
    var ticks = '';
    for (var t = Math.ceil(A / 5) * 5; t <= B; t += 5) {
      ticks += '<span class="num" style="inset-inline-start:' + pos(t).toFixed(1) + '%">' +
               t + '°</span>';
    }
    box.querySelector('.d7-axis-in').innerHTML = ticks;

    var todayKey = (data.current && data.current.time || '').slice(0, 10);

    rows.forEach(function (row, i) {
      if (i >= n) { row.hidden = true; return; }
      row.hidden = false;
      var iso = D.time[i], lo = D.temperature_2m_min[i], hi = D.temperature_2m_max[i];
      var code = D.weather_code ? D.weather_code[i] : null;

      /* اسم اليوم من التاريخ العائد، لا من ساعة الجهاز */
      var y = +iso.slice(0, 4), mo = +iso.slice(5, 7), dd = +iso.slice(8, 10);
      var wd = DAY[new Date(Date.UTC(y, mo - 1, dd)).getUTCDay()];
      var isToday = (iso === todayKey);
      row.classList.toggle('today', isToday);
      row.querySelector('.d7-day b').textContent = isToday ? 'اليوم' : wd;
      row.querySelector('.d7-day i').textContent = dd + ' ' + MON[mo - 1];

      /* أيقونة النهار دائماً — اليوم وحدة كاملة، لا لحظة ليل */
      var key = (window.CONDKEY || {})[String(code)] || 'cloud';
      row.querySelector('.d7-ico').innerHTML =
        '<svg viewBox="0 0 24 24" class="d7-svg" aria-hidden="true">' +
        ((window.CONDSVG || {})[key] || '') + '</svg>';
      row.querySelector('.d7-cond em').textContent =
        (window.WMO || {})[String(code)] || '';

      if (lo === null || hi === null) return;
      var pl = pos(lo), ph = pos(hi), w = Math.abs(ph - pl), left = Math.min(pl, ph);

      /* عدم اليقين: يتّسع **ويشتدّ** مع بُعد اليوم. التمويه وحده يُخفت
         الأبعد فينعكس المعنى — فتُرفع العتامة معه. كيفيّ لا كمّيّ. */
      var u = (n > 1) ? i / (n - 1) : 0;
      var haze = row.querySelector('.d7-haze');
      haze.style.insetInlineStart = (left - 1.2).toFixed(1) + '%';
      haze.style.width = (w + 2.4).toFixed(1) + '%';
      haze.style.filter = 'blur(' + (2 + u * 8).toFixed(1) + 'px)';
      haze.style.opacity = (0.10 + u * 0.30).toFixed(2);

      var line = row.querySelector('.d7-line');
      line.style.insetInlineStart = left.toFixed(1) + '%';
      line.style.width = w.toFixed(1) + '%';
      row.querySelector('.d7-dot.lo').style.insetInlineStart = pl.toFixed(1) + '%';
      row.querySelector('.d7-dot.hi').style.insetInlineStart = ph.toFixed(1) + '%';
      var lov = row.querySelector('.d7-v.lov'), hiv = row.querySelector('.d7-v.hiv');
      lov.style.insetInlineStart = pl.toFixed(1) + '%';
      hiv.style.insetInlineStart = ph.toFixed(1) + '%';
      lov.textContent = Math.round(lo) + '°';
      hiv.textContent = Math.round(hi) + '°';
      row.querySelector('.d7-track').setAttribute('aria-label',
        'الدنيا ' + Math.round(lo) + ' والعليا ' + Math.round(hi) + ' درجة');
    });

    box.classList.add('d7-ready');
    box.querySelector('.d7-fail').hidden = true;
  }

  function load() {
    if (busy) return;
    busy = true;
    root.classList.add('lv-loading');
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
    fetch(url(), ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { clearTimeout(to); fill(d); })
      .catch(function () {
        clearTimeout(to);
        root.classList.remove('lv-loading');
        /* الفشل لا يُخفي شيئاً ولا يعرض رقماً قديماً بلا ختم — يقولها صراحة */
        if (!root.classList.contains('lv-ready')) {
          q('.lv-when').textContent = '';
          q('.lv-cond').textContent = '';
          /* شرطة صريحة بدل خانة فارغة: الفارغ يُقرأ «لم يكتمل الرسم»،
             والشرطة تقول «لا قيمة» — ولا نعرض رقماً قديماً بلا ختم. */
          root.querySelectorAll('.lv-v').forEach(function (e) { e.textContent = '—'; });
          q('.lv-wind').textContent = 'الرياح —';
          q('.lv-pres').textContent = 'الضغط —';
          q('.lv-uv-l').textContent = 'مؤشّر UV —';
        }
        q('.lv-fail').hidden = false;
        var hb = document.getElementById('liveHourly');
        if (hb && !hb.classList.contains('hr-ready')) hb.querySelector('.hr-fail').hidden = false;
        var db = document.getElementById('liveDaily');
        if (db && !db.classList.contains('d7-ready')) db.querySelector('.d7-fail').hidden = false;
      })
      .then(function () { busy = false; });
  }

  q('.lv-retry').addEventListener('click', load);
  document.addEventListener('visibilitychange', function () {
    /* عودة الرؤية تُجدّد الرقم إن مضى عليه ١٠ دقائق — الصفحة المفتوحة
       ساعاتٍ لا تبقى على رقم بائت. */
    if (!document.hidden && Date.now() - lastOk > 600000) load();
  });
  load();
})();
