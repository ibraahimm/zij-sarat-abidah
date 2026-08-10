
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

/* ═══════════ الطقس الحيّ — أربع طبقات من نداء واحد ═══════════
   الحالة الآن واليوم · الساعات الخمس القادمة · ٤٨ ساعة بفترات اليوم · ١٤ يوماً.
   ولا نداء ثانٍ لأيٍّ منها، ولا توقّع مجمَّد في الصفحة.

   والنواة `WX` أدناه **دوالّ خالصة بلا DOM** — فتُختبر وحدها في
   `test_weather.py` بتحميل هذا الملف في node بجذع DOM. وقواعد التجميع
   (المتوسط، والمجموع، وأقصى احتمال، والمتوسط الدائري للاتجاه، واختيار أشدّ
   حالة) لا تصحّ مراجعتها بالعين على صفحة حيّة تتغيّر أرقامها كل ربع ساعة. */
var WX = (function () {
  /* ترتيب شدّة حالات WMO — **صريح لأن أرقام WMO ليست مرتّبة بالشدّة**:
     ٨٢ (زخّة عنيفة) أشدّ من ٦٥ (مطر غزير)، والرعد فوق الجميع. وبغير ترتيب
     معلَن يصير «حالة الفترة» ساعةً عشوائية منها. */
  var SEV = { 0: 0, 1: 1, 2: 2, 3: 3, 45: 4, 48: 5,
              51: 6, 53: 7, 55: 8,
              61: 9, 80: 10, 63: 11, 81: 12, 65: 13, 82: 14,
              95: 15, 96: 16, 99: 17 };
  var PARTS = ['الليل', 'الصباح', 'بعد الظهر', 'المساء'];

  function sev(code) { var v = SEV[code]; return v === undefined ? -1 : v; }
  function ok(v) { return v !== null && v !== undefined && !isNaN(v); }

  function mean(a) {
    var s = 0, n = 0;
    for (var i = 0; i < a.length; i++) if (ok(a[i])) { s += a[i]; n++; }
    return n ? s / n : null;
  }
  function sum(a) {
    var s = 0, n = 0;
    for (var i = 0; i < a.length; i++) if (ok(a[i])) { s += a[i]; n++; }
    return n ? s : null;
  }
  function maxOf(a) {
    var m = null;
    for (var i = 0; i < a.length; i++) {
      if (!ok(a[i])) continue;
      if (m === null || a[i] > m) m = a[i];
    }
    return m;
  }

  /* المتوسط الدائري موزوناً بالسرعة. والمتوسط الحسابي **يكسر عند حدّ ٣٦٠**:
     ٣٥٠° و١٠° متوسطهما الحسابي ١٨٠° — أي جنوبٌ، والصحيح شمال. */
  function circMean(dirs, spd) {
    var x = 0, y = 0, seen = false, i, r;
    for (i = 0; i < dirs.length; i++) {
      if (!ok(dirs[i])) continue;
      seen = true;
      var w = (spd && ok(spd[i])) ? spd[i] : 0;
      r = dirs[i] * Math.PI / 180;
      x += w * Math.sin(r); y += w * Math.cos(r);
    }
    if (!seen) return null;
    if (x === 0 && y === 0) {
      /* كل السرعات صفر (أو غائبة): يُرجَع إلى متوسط دائري غير موزون */
      for (i = 0; i < dirs.length; i++) {
        if (!ok(dirs[i])) continue;
        r = dirs[i] * Math.PI / 180;
        x += Math.sin(r); y += Math.cos(r);
      }
      if (x === 0 && y === 0) return null;
    }
    return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  }

  function col(H, key, idx) {
    var a = H[key] || [], out = [], i;
    for (i = 0; i < idx.length; i++) out.push(a[idx[i]]);
    return out;
  }

  /* حالة الفترة: أشدّ ساعاتها بترتيب SEV، **وأولُ ساعةٍ بلغت تلك الشدّة**
     هي ممثّلتها — فمنها يؤخذ `is_day` للأيقونة، فلا تُخلط ليلية بنهارية. */
  function summarize(H, g) {
    var I = g.idx, codes = col(H, 'weather_code', I);
    var best = -2, at = I[0], i;
    for (i = 0; i < codes.length; i++) {
      if (sev(codes[i]) > best) { best = sev(codes[i]); at = I[i]; }
    }
    var rain = sum(col(H, 'rain', I)), sh = sum(col(H, 'showers', I));
    var wet = (rain === null && sh === null) ? null : (rain || 0) + (sh || 0);
    return {
      day: g.day, part: g.part, name: PARTS[g.part], hours: I.length,
      from: (H.time[I[0]] || '').slice(11, 16),
      to: (H.time[I[I.length - 1]] || '').slice(11, 16),
      code: (H.weather_code || [])[at],
      isDay: (H.is_day || [])[at],
      temp: mean(col(H, 'temperature_2m', I)),
      feels: mean(col(H, 'apparent_temperature', I)),
      hum: mean(col(H, 'relative_humidity_2m', I)),
      dew: mean(col(H, 'dew_point_2m', I)),
      vis: mean(col(H, 'visibility', I)),
      wind: mean(col(H, 'wind_speed_10m', I)),
      dir: circMean(col(H, 'wind_direction_10m', I), col(H, 'wind_speed_10m', I)),
      pop: maxOf(col(H, 'precipitation_probability', I)),
      rain: wet,
      snow: sum(col(H, 'snowfall', I))
    };
  }

  /* فترات اليوم: ٠٠–٠٦ ليل · ٠٦–١٢ صباح · ١٢–١٨ بعد الظهر · ١٨–٢٤ مساء.
     تبدأ بعد الساعة الحالية (لا تُعاد «الآن» وقد عُرضت في قسمها)، فقد تكون
     الفترة الأولى ناقصة — وذاك صحيح. */
  function dayparts(H, afterKey) {
    if (!H || !H.time) return [];
    var groups = [], byKey = {}, i;
    for (i = 0; i < H.time.length; i++) {
      var t = H.time[i];
      if (t.slice(0, 13) <= afterKey) continue;
      var day = t.slice(0, 10), p = Math.floor(+t.slice(11, 13) / 6), k = day + '#' + p;
      if (!byKey[k]) { byKey[k] = { day: day, part: p, idx: [] }; groups.push(byKey[k]); }
      byKey[k].idx.push(i);
    }
    var out = [];
    for (i = 0; i < groups.length; i++) out.push(summarize(H, groups[i]));
    return out;
  }

  /* أول `n` ساعة **تلي** الساعة الحالية — لا تُعاد الساعة نفسها مرتين */
  function nextHours(H, afterKey, n) {
    var out = [];
    if (!H || !H.time) return out;
    for (var i = 0; i < H.time.length && out.length < n; i++) {
      if (H.time[i].slice(0, 13) > afterKey) out.push(i);
    }
    return out;
  }

  function fmtDur(s) {
    if (!ok(s)) return '—';
    var m = Math.round(s / 60);
    return Math.floor(m / 60) + ' س ' + ('0' + (m % 60)).slice(-2) + ' د';
  }

  return { SEV: SEV, PARTS: PARTS, sev: sev, mean: mean, sum: sum, maxOf: maxOf,
           circMean: circMean, summarize: summarize, dayparts: dayparts,
           nextHours: nextHours, fmtDur: fmtDur };
})();
if (typeof window !== 'undefined') window.WX = WX;

(function () {
  var root = document.getElementById('liveNow');
  if (!root || !window.fetch) return;

  var MON = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
             'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var DAY = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  var FRESH = 900000;              /* ربع ساعة — سياسة التحديث الواحدة */
  var lastOk = 0, busy = false, timer = null, lastData = null;

  function nf(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d)
           .replace(/\.0+$/, '');
  }
  function dirName(deg) {
    if (deg === null || deg === undefined) return '';
    return (window.WDIRS || [])[Math.round(deg / 45) % 8] || '';
  }
  function condText(code) { return (window.WMO || {})[String(code)] || 'غير معروفة'; }
  function condSvg(code, isDay, cls) {
    var key = (window.CONDKEY || {})[String(code)] || 'cloud';
    if (isDay === 0 && (window.CONDNIGHT || {})[key]) key = window.CONDNIGHT[key];
    return '<svg viewBox="0 0 24 24" class="' + cls + '" aria-hidden="true">' +
           ((window.CONDSVG || {})[key] || '') + '</svg>';
  }
  /* وقت جلبنا المركزيّ بتوقيت الرياض — وهو غير وقت القراءة نفسها:
     الأول متى حدّثنا، والثاني اللحظة التي يصفها الرقم. */
  function riyadhTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh',
        hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    } catch (e) { return ''; }
  }

  function dayName(iso) {
    var y = +iso.slice(0, 4), mo = +iso.slice(5, 7), d = +iso.slice(8, 10);
    return DAY[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  }
  function dayShort(iso) { return +iso.slice(8, 10) + ' ' + MON[+iso.slice(5, 7) - 1]; }

  /* **لا اتصال بـOpen-Meteo من متصفّح الزائر البتّة.**
     يُنادى المصدر مركزياً كل ربع ساعة (`fetch_weather.py` في دورة النشر)،
     وتُكتب نسخةٌ واحدة يقرؤها الزوّار كلّهم — فعددهم لا يزيد عدد الطلبات.

     والمَعلَم الزمنيّ `?t=` **دلوٌ من خمس دقائق لا ختمٌ لحظيّ**: الختم
     الفريد يُبطل تخزين الحافة لكل زائر، و`no-store` يُبطله للموقع كلّه.
     ودلو ربع الساعة لا يصلح هنا: الدورة المركزية تقع عند الدقائق ٧ و٢٢
     و٣٧ و٥٢، ودلوٌ يتغيّر عند ٠ و١٥ و٣٠ و٤٥ قد يحبس القارئ على نسخةٍ
     سابقة ثماني دقائق زيادة. ولا يُربَط الدلو بدقائق الـcron أيضاً —
     فجدولة Actions بأفضل جهد وقد تتأخر. فخمسُ دقائق تحدّ التقادم
     المضاف بخمس، وتُبقي الحافة تخدم كل من فتح الصفحة داخل الدلو. */
  var DATA_URL = './weather-live.json';
  function url() {
    return DATA_URL + '?t=' + Math.floor(Date.now() / 300000);
  }

  /* الوقت من الواجهة لا من ساعة الجهاز: زائر بساعة مضبوطة على توقيت
     آخر كان سيرى «الآن» خطأً. نقرأ current.time كنصّ محلّي جاهز. */
  function whenText(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
    if (!m) return '';
    return dayName(iso) + ' ' + (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] + 'م · ' +
           'قراءة ' + m[4] + ':' + m[5];
  }

  function set(box, key, text) {
    var el = box.querySelector('[data-k="' + key + '"]');
    if (el) el.textContent = text;
  }
  function fail(id, on) {
    var box = document.getElementById(id);
    if (!box) return;
    var f = box.querySelector('.wx-fail');
    if (f) f.hidden = !on;
  }

  /* ═══ ١ · الحالة الآن ومعها اليوم ═══ */
  function renderCurrentToday(data) {
    var c = data.current, D = data.daily;
    if (!c) throw new Error('no current');
    root.querySelector('.lv-when').textContent = whenText(c.time);
    /* وقت التحديث المركزيّ من `generated_at` لا من وقت القراءة — والفرق
       بينهما دقائق، وخلطُهما يوهم القارئ أن الرقم أحدثُ أو أقدمُ مما هو. */
    var up = root.querySelector('.lv-upd');
    if (up) {
      var ut = riyadhTime(data.generated_at);
      up.textContent = ut ? ' · آخر تحديث ' + ut + ' بتوقيت سراة عبيدة' : '';
    }
    root.querySelector('.lv-cond').textContent = condText(c.weather_code);
    root.querySelector('.lv-icon').innerHTML = condSvg(c.weather_code, c.is_day, 'lv-bigsvg');
    root.querySelector('.lv-temp').textContent = nf(c.temperature_2m, 1) + '°';

    /* العظمى والصغرى بجوار الحرارة الحالية — لا في قسمٍ أسفل الصفحة */
    var hasD = D && D.temperature_2m_max && D.temperature_2m_max.length;
    set(root, 'tmax', hasD ? nf(D.temperature_2m_max[0], 0) + '°' : '—');
    set(root, 'tmin', hasD ? nf(D.temperature_2m_min[0], 0) + '°' : '—');
    set(root, 'fmax', hasD ? nf(D.apparent_temperature_max[0], 0) + '°' : '—');
    set(root, 'fmin', hasD ? nf(D.apparent_temperature_min[0], 0) + '°' : '—');

    set(root, 'feels', nf(c.apparent_temperature, 1) + '°');
    set(root, 'hum', nf(c.relative_humidity_2m, 0) + '٪');
    set(root, 'dew', nf(c.dew_point_2m, 1) + '°');
    set(root, 'cloud', nf(c.cloud_cover, 0) + '٪');
    set(root, 'vis', (c.visibility === null || c.visibility === undefined)
        ? '—' : nf(c.visibility / 1000, 1) + ' كم');
    set(root, 'pop', nf(c.precipitation_probability, 0) + '٪');

    /* كمية الهطول: تظهر خانتها حين يكون هناك هطول فعلاً */
    var pr = root.querySelector('[data-lv="prcp"]');
    if (pr) {
      var has = (c.precipitation !== null && c.precipitation !== undefined && c.precipitation > 0);
      pr.hidden = !has;
      if (has) set(root, 'prcp', nf(c.precipitation, 1) + ' مم');
    }

    var ws = root.querySelector('[data-lv="wind"] svg');
    if (ws && c.wind_direction_10m !== undefined && c.wind_direction_10m !== null) {
      ws.querySelector('.lv-needle').setAttribute('transform',
        'rotate(' + c.wind_direction_10m + ' ' + ws.dataset.cx + ' ' + ws.dataset.cy + ')');
      ws.querySelector('.lv-speed').textContent = nf(c.wind_speed_10m, 0);
      ws.setAttribute('aria-label', 'اتجاه الرياح ' + Math.round(c.wind_direction_10m) +
        ' درجة، السرعة ' + nf(c.wind_speed_10m, 0) + ' كم/س');
    }
    root.querySelector('.lv-wind').textContent = 'الرياح ' + nf(c.wind_speed_10m, 1) +
      ' كم/س، من ' + dirName(c.wind_direction_10m) +
      (c.wind_gusts_10m ? ' · هبّات ' + nf(c.wind_gusts_10m, 0) : '');

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
    root.querySelector('.lv-pres').textContent = 'الضغط ' + nf(c.pressure_msl, 1) + ' هكتوباسكال';

    /* أقصى UV **اليوم** من daily[0] — لا من current، فالقيمة اللحظية ليلاً صفر */
    var us = root.querySelector('[data-lv="uv"] svg');
    var uv = hasD && D.uv_index_max ? D.uv_index_max[0] : null;
    if (us && uv !== null && uv !== undefined) {
      var fu = Math.max(0, Math.min(1, uv / +us.dataset.vmax));
      var mk = us.querySelector('.lv-uv-mark');
      mk.setAttribute('cx', (+us.dataset.x0 + fu * +us.dataset.w).toFixed(1));
      mk.setAttribute('visibility', 'visible');
      us.setAttribute('aria-label', 'أقصى مؤشّر UV اليوم ' + nf(uv, 1));
    }
    root.querySelector('.lv-uv-l').textContent = 'أقصى UV اليوم ' + nf(uv, 1);

    root.classList.add('lv-ready');
    root.classList.remove('lv-loading');
    fail('liveNow', false);
  }

  /* ═══ ٢ · الساعات الخمس القادمة — نظرة سريعة، ثلاثة أرقام لا أكثر ═══ */
  function renderNext5(data) {
    var box = document.getElementById('liveNext5');
    if (!box) return;
    var H = data.hourly, c = data.current;
    if (!H || !H.time || !c) throw new Error('no hourly');
    var key = (c.time || '').slice(0, 13);
    var idx = WX.nextHours(H, key, 5);
    var cells = box.querySelectorAll('.n5-cell');

    cells.forEach(function (cell, k) {
      if (k === 0) {
        cell.querySelector('.n5-t').textContent = 'الآن';
        cell.querySelector('.n5-i').innerHTML = condSvg(c.weather_code, c.is_day, 'n5-svg');
        cell.querySelector('.n5-v').textContent = nf(c.temperature_2m, 0) + '°';
        cell.hidden = false;
        return;
      }
      var i = idx[k - 1];
      if (i === undefined) { cell.hidden = true; return; }
      cell.hidden = false;
      cell.querySelector('.n5-t').textContent = H.time[i].slice(11, 16);
      cell.querySelector('.n5-i').innerHTML =
        condSvg(H.weather_code[i], H.is_day ? H.is_day[i] : 1, 'n5-svg');
      cell.querySelector('.n5-v').textContent = nf(H.temperature_2m[i], 0) + '°';
    });
    box.classList.add('n5-ready');
    fail('liveNext5', false);
  }

  /* ═══ ٣ · ٤٨ ساعة مجمَّعة إلى فترات اليوم ═══ */
  var ROWS = [
    ['الحالة',        function (p) { return condText(p.code); }],
    ['الحرارة',       function (p) { return nf(p.temp, 0) + '°'; }],
    ['المحسوسة',      function (p) { return nf(p.feels, 0) + '°'; }],
    ['الرياح',        function (p) { return nf(p.wind, 0) + ' كم/س'; }],
    ['اتجاهها',       function (p) { return p.dir === null ? '—'
                                       : dirName(p.dir) + ' ' + nf(p.dir, 0) + '°'; }],
    ['الرطوبة',       function (p) { return nf(p.hum, 0) + '٪'; }],
    ['نقطة الندى',    function (p) { return nf(p.dew, 0) + '°'; }],
    ['مدى الرؤية',    function (p) { return p.vis === null ? '—' : nf(p.vis / 1000, 0) + ' كم'; }],
    ['احتمال الهطول', function (p) { return nf(p.pop, 0) + '٪'; }],
    ['كمية المطر',    function (p) { return nf(p.rain, 1) + ' مم'; }],
    ['كمية الثلج',    function (p) { return nf(p.snow, 1) + ' سم'; }]
  ];

  function renderParts(data) {
    var box = document.getElementById('liveParts');
    if (!box) return;
    var H = data.hourly, c = data.current;
    if (!H || !H.time || !c) throw new Error('no hourly');
    var ps = WX.dayparts(H, (c.time || '').slice(0, 13));
    if (!ps.length) throw new Error('no parts');

    /* صفّ أسماء الأيام: كل يوم يمتدّ على فتراته بـcolspan */
    var days = [], last = null;
    ps.forEach(function (p) {
      if (p.day !== last) { days.push({ day: p.day, n: 1 }); last = p.day; }
      else days[days.length - 1].n++;
    });

    var h1 = '<tr><th class="pt-h" scope="row">اليوم</th>';
    days.forEach(function (d) {
      h1 += '<th class="pt-day" colspan="' + d.n + '" scope="colgroup">' +
            dayName(d.day) + ' <i>' + dayShort(d.day) + '</i></th>';
    });
    h1 += '</tr>';

    var h2 = '<tr><th class="pt-h" scope="row">الفترة</th>';
    ps.forEach(function (p) {
      h2 += '<th class="pt-part" scope="col">' + p.name +
            '<i>' + p.from + '–' + p.to + '</i></th>';
    });
    h2 += '</tr>';

    var ico = '<tr><th class="pt-h" scope="row">—</th>';
    ps.forEach(function (p) {
      ico += '<td class="pt-ico">' + condSvg(p.code, p.isDay, 'pt-svg') + '</td>';
    });
    ico += '</tr>';

    var body = '';
    ROWS.forEach(function (r) {
      body += '<tr><th class="pt-h" scope="row">' + r[0] + '</th>';
      ps.forEach(function (p) { body += '<td>' + r[1](p) + '</td>'; });
      body += '</tr>';
    });

    box.querySelector('.pt-table').innerHTML =
      '<thead>' + h1 + h2 + ico + '</thead><tbody>' + body + '</tbody>';
    box.classList.add('pt-ready');
    fail('liveParts', false);
  }

  /* ═══ ٤ · أربعة عشر يوماً — daily[1..14]، واليوم عُرض أعلاه ═══ */
  function renderDays(data) {
    var box = document.getElementById('liveDays');
    if (!box) return;
    var D = data.daily;
    if (!D || !D.time) throw new Error('no daily');
    var cards = box.querySelectorAll('.dq-card');

    cards.forEach(function (card, k) {
      var i = k + 1;                        /* daily[0] هو اليوم، وقد عُرض */
      if (i >= D.time.length) { card.hidden = true; return; }
      card.hidden = false;
      var iso = D.time[i];
      set(card, 'day', dayName(iso));
      set(card, 'date', dayShort(iso));
      var ie = card.querySelector('[data-k="ico"]');
      if (ie) ie.innerHTML = condSvg(D.weather_code[i], 1, 'dq-svg');
      set(card, 'cond', condText(D.weather_code[i]));
      set(card, 'tmax', nf(D.temperature_2m_max[i], 0) + '°');
      set(card, 'tmin', nf(D.temperature_2m_min[i], 0) + '°');
      set(card, 'fmax', nf(D.apparent_temperature_max[i], 0) + '°');
      set(card, 'fmin', nf(D.apparent_temperature_min[i], 0) + '°');
      set(card, 'hum', nf(D.relative_humidity_2m_mean[i], 0) + '٪');
      set(card, 'wind', nf(D.wind_speed_10m_max[i], 0) + ' كم/س');
      set(card, 'gust', nf(D.wind_gusts_10m_max[i], 0) + ' كم/س');
      var dd = D.wind_direction_10m_dominant[i];
      set(card, 'dir', dd === null || dd === undefined
          ? '—' : dirName(dd) + ' ' + nf(dd, 0) + '°');
      set(card, 'pop', nf(D.precipitation_probability_max[i], 0) + '٪');
      set(card, 'prcp', nf(D.precipitation_sum[i], 1) + ' مم');
      set(card, 'uv', nf(D.uv_index_max[i], 1));
      set(card, 'rise', (D.sunrise[i] || '').slice(11, 16) || '—');
      set(card, 'set', (D.sunset[i] || '').slice(11, 16) || '—');
      set(card, 'sun', WX.fmtDur(D.sunshine_duration[i]));
    });
    box.classList.add('dq-ready');
    fail('liveDays', false);
  }

  /* ═══ التنسيق: كل قسم يفشل وحده، ولا ينتظر ما قبله ═══ */
  function safe(id, fn, data) {
    try { fn(data); return true; }
    catch (e) { fail(id, true); return false; }
  }
  /* حداثة النسخة المشتركة من ختمها هي، لا من وقت بناء الموقع ولا من آخر
     قراءةٍ ناجحة: القراءة قد تنجح على ملفٍ لم يُحدَّث مركزياً منذ ساعات. */
  var STALE = 45 * 60 * 1000;              /* ثلاث دورات فائتة */
  function showAge(data, note) {
    var el = document.getElementById('wx-age');
    if (!el) return;
    var g = data && data.generated_at ? Date.parse(data.generated_at) : NaN;
    var age = isNaN(g) ? NaN : Date.now() - g;
    if (!note && (isNaN(age) || age <= STALE)) { el.hidden = true; return; }
    var mins = isNaN(age) ? null : Math.round(age / 60000);
    var when = mins === null ? '' :
      (mins < 90 ? 'منذ ' + mins + ' دقيقة' : 'منذ ' + Math.round(mins / 60) + ' ساعة');
    el.textContent = (note ? 'تعذّر تحديث القراءة الآن — والمعروض آخر نسخة سليمة'
                           : 'لم تُحدَّث النسخة المركزية مؤخراً') +
                     (when ? ' (' + when + ')' : '') + '.';
    el.hidden = false;
  }

  function renderWeather(data) {
    var a = safe('liveNow', renderCurrentToday, data);
    var b = safe('liveNext5', renderNext5, data);
    var cc = safe('liveParts', renderParts, data);
    var d = safe('liveDays', renderDays, data);
    if (a || b || cc || d) { lastOk = Date.now(); lastData = data; }
    showAge(data, false);
  }

  function load() {
    if (busy) return;
    busy = true;
    if (!root.classList.contains('lv-ready')) root.classList.add('lv-loading');
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
    fetch(url(), ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { clearTimeout(to); renderWeather(d); })
      .catch(function () {
        clearTimeout(to);
        root.classList.remove('lv-loading');
        /* **فشل التحديث لا يمحو آخر بيانات ناجحة.** إن كانت الشاشة تحمل
           قراءةً سليمة تُترك ويُعلَن تعذّر التحديث؛ وإن لم تحمل شيئاً
           فشرطة صريحة — الفارغ يُقرأ «لم يكتمل الرسم» والشرطة «لا قيمة». */
        if (!root.classList.contains('lv-ready')) {
          root.querySelector('.lv-when').textContent = '';
          var u0 = root.querySelector('.lv-upd');
          if (u0) u0.textContent = '';
          root.querySelector('.lv-cond').textContent = '';
          root.querySelector('.lv-temp').textContent = '—';
          root.querySelectorAll('.lv-v').forEach(function (e) { e.textContent = '—'; });
          root.querySelector('.lv-wind').textContent = 'الرياح —';
          root.querySelector('.lv-pres').textContent = 'الضغط —';
          root.querySelector('.lv-uv-l').textContent = 'أقصى UV اليوم —';
          ['liveNow', 'liveNext5', 'liveParts', 'liveDays'].forEach(function (id) {
            fail(id, true);
          });
        } else {
          /* الشاشة تحمل قراءةً سليمة: تبقى كما هي، ويُعلَن تعذّر التحديث
             في سطرٍ صغير — لا رسالة فشل تحجب توقّعاً صالحاً. */
          showAge(lastData, true);
        }
      })
      .then(function () { busy = false; });
  }

  var rb = root.querySelector('.lv-retry');
  if (rb) rb.addEventListener('click', load);

  /* التحديث: ربع ساعة مؤقّتاً، ومثلها شرطاً عند العودة إلى اللسان.
     والمؤقّت يُوقَف حين تختفي الصفحة فلا تُستهلك حصّة الواجهة في الخلفية. */
  function startTimer() {
    if (timer === null) timer = setInterval(load, FRESH);
  }
  function stopTimer() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopTimer(); return; }
    startTimer();
    if (Date.now() - lastOk > FRESH) load();
  });
  startTimer();
  load();
})();
