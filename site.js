
(function () {
  /* ═══════════ الزمن يُقرَّر وقت القراءة لا وقت البناء ═══════════
     **العلّة:** «الحدث القادم» كان يُختار وقت البناء ويُخبَز في ثلاث صفحات،
     فيبقى حدثاً منقضياً معروضاً **بعدّادٍ صفريّ** حتى يُعاد النشر.

     والوقتُ كلُّه من `Date.now()` في موضعٍ واحد — فيُبدَّل في الاختبار
     بزمنٍ وهميّ قبل الحدث وبعده، ويُفحص الحكمُ لا الصياغة. */
  function nowMs() { return Date.now(); }

  /* عدّادٌ واحد: إمّا أرقامٌ حيّة، وإمّا **حالةُ «انقضى» صريحة** — ولا
     أربعةُ أصفارٍ تُقرأ عدّاً وقد مضى الموعد. */
  function paint(box, untilIso) {
    var grid = box.querySelector('.cd-grid'),
        past = box.querySelector('[data-ev="past"]');
    var t = Date.parse(untilIso || box.getAttribute('data-until') || '');
    if (isNaN(t)) return;
    var ms = t - nowMs();
    if (ms <= 0) {
      box.classList.add('is-past');
      if (grid) grid.hidden = true;
      if (past) past.hidden = false;
      return;
    }
    box.classList.remove('is-past');
    if (grid) grid.hidden = false;
    if (past) past.hidden = true;
    var s = Math.floor(ms / 1000);
    var d = box.querySelector('[data-cd="d"]'), h = box.querySelector('[data-cd="h"]'),
        m = box.querySelector('[data-cd="m"]'), sec = box.querySelector('[data-cd="s"]');
    if (d) d.textContent = Math.floor(s / 86400);
    if (h) h.textContent = Math.floor(s % 86400 / 3600);
    if (m) m.textContent = Math.floor(s % 3600 / 60);
    if (sec) sec.textContent = s % 60;
  }

  /* أقربُ حدثٍ لم يَمضِ — من الحمولة المشتركة، بساعة القارئ */
  function upcoming() {
    var evs = (SITE.data && SITE.data.events) || [];
    var t = nowMs();
    for (var i = 0; i < evs.length; i++) {
      if (Date.parse(evs[i].iso) > t) return evs[i];
    }
    return null;
  }

  /* صناديقُ «الحدث القادم»: `agenda` تختار من الجدول، و`self` مثبَّتةٌ على
     حدثِ صفحتها. وكلتاهما تُعلن الانقضاء ولا تعرض صفراً. */
  function renderNextBoxes() {
    document.querySelectorAll('[data-next-event]').forEach(function (box) {
      var mode = box.getAttribute('data-next-event');
      if (mode === 'self') { paint(box); return; }
      if (!SITE.data) { paint(box); return; }       /* لم تصل الحمولة بعد */
      var e = upcoming();
      var body = box.querySelector('[data-ev="body"]'),
          none = box.querySelector('[data-ev="none"]'),
          ttl = box.querySelector('[data-ev="title"]'),
          lnk = box.querySelector('[data-ev="link"]');
      if (!e) {
        box.classList.add('is-empty');
        if (body) body.hidden = true;
        if (none) none.hidden = false;
        return;
      }
      box.classList.remove('is-empty');
      if (body) body.hidden = false;
      if (none) none.hidden = true;
      box.setAttribute('data-until', e.iso);
      if (ttl) ttl.textContent = e.chip + ' — ' + e.title + ' · ' + e.hijri
                                 + ' · ' + e.time;
      if (lnk) { lnk.setAttribute('href', e.href); lnk.hidden = false; }
      paint(box, e.iso);
    });
  }

  function tick() {
    var t = nowMs();
    document.querySelectorAll('[data-until]').forEach(function (box) {
      if (box.hasAttribute('data-next-event')) return;   /* يتولّاها مُصيِّرُها */
      paint(box);
    });
    renderNextBoxes();
    var marked = false;
    document.querySelectorAll('.ev[data-when]').forEach(function (el) {
      var w = Date.parse(el.dataset.when), st = el.querySelector('.st');
      el.classList.remove('past', 'next');
      if (!st) return;
      if (w < t) { el.classList.add('past'); st.textContent = 'انقضى'; }
      else {
        st.textContent = 'قادم';
        if (!marked) { marked = true; el.classList.add('next'); st.textContent = 'التالي'; }
      }
    });
  }
  /* «اليوم» في شريط الأيام — يُحسب هنا لا وقت البناء، وإلا كذب غداً على
     صفحةٍ ساكنة. وبتوقيت الرياض لا بساعة الجهاز، فزائرٌ بساعةٍ على توقيت
     آخر لا يرى يوماً غير يومنا — نفس اصطلاح «الطقس الآن». */
  /* ═══ الحمولة المحليّة المشتركة — مصدرٌ واحد لكل ما يتغيّر بالزمن ═══
     أحداثُ الجدول بلحظاتها، وأفقُ الشمس والقمر أربعَ مئة يوم. **محسوبةٌ
     بمحرّكنا وقت البناء، ولا نداءَ خارجيّ ولا حسابَ فلكيّ في المتصفّح** —
     جدولٌ يُقرأ ويُنتقى منه يومُ القارئ. ونداءٌ واحد يُخزَّن. */
  var SITE = { data: null };
  var SITE_DATA_URL = './site-data.json';
  function loadSiteData() {
    if (!window.fetch) return Promise.resolve(null);
    return fetch(SITE_DATA_URL + '?t=' + Math.floor(Date.now() / 300000))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { SITE.data = d; return d; })
      .catch(function () { return null; });
  }

  function riyadhToday() {
    try {
      var o = {};
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh',
        year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date(Date.now())).forEach(function (p) { o[p.type] = p.value; });
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
     منه. فلا حساب فلكيّ هنا ولا قاعدة رسمٍ مُعادة: المسار `p` يأتي جاهزاً.

     **ومركَّبٌ على جذرٍ منذ المرحلة ٩** — كان مقيَّداً بأربعة معرّفات عامة،
     فلا يعمل على `sun-moon.html` ولا في ملخّص الرئيسية إلا بنسخةٍ ثانية.
     وعددُ البطاقات من الجذر نفسه (`data-sm-cards`)، فالرئيسية بطاقةٌ واحدة
     وحمولةُ سبعة أيام، والتفصيل سبعٌ وحمولةُ الأفق كلّه. */
  function mountSunMoon(root) {
    /* **المصدرُ الحمولةُ المشتركة** — وكانت نسخةً مضمَّنةً في كل صفحة،
       سبعةَ أيامٍ في الرئيسية فيخرج قارئُها من الأفق بعد أسبوع. وقبل
       وصولها يبقى ما بناه الخادم، ولا يُمحى بفراغ. */
    var rows = SITE.data && SITE.data.sun;
    if (!rows || !rows.length) return;
    var iso = riyadhToday();
    var i = -1;
    for (var j = 0; j < rows.length; j++) { if (rows[j].d === iso) { i = j; break; } }
    var stale = root.querySelector('[data-sm-stale]');
    var smBody = root.querySelector('[data-sm-body]');
    var cards = root.querySelectorAll('.sm-card');
    var need = +root.getAttribute('data-sm-cards') || cards.length || 1;
    /* ═══ انتهاءُ الأفق يفشل بأمان، ولا يكذب ═══
       خارج الأفق — أو أقربَ إلى آخره من أن يكتمل الشريط بعده — **يُحجب ما
       بناه الخادم** ويُصرَّح بأن الحساب يحتاج تجديداً. وكان يُترك معروضاً
       وعليه لفظُ «اليوم»، فيُقرأ يومُ آخر نشرٍ على أنه يومُ القارئ: **رقمٌ
       صحيحٌ في موضعٍ كاذب**. وبغير حدِّ `need` يُكرَّر آخرُ يومٍ في الشريط. */
    if (i < 0 || i > rows.length - need) {
      if (stale) stale.hidden = false;
      if (smBody) smBody.hidden = true;
      root.classList.add('sm-expired');
      return;
    }
    if (stale) stale.hidden = true;
    if (smBody) smBody.hidden = false;
    root.classList.remove('sm-expired');

    function fill(el, row, isToday) {
      el.querySelectorAll('[data-k]').forEach(function (n) {
        var k = n.dataset.k, v = row[k];
        if (v === undefined || v === null) return;
        if (k === 'p') n.setAttribute('d', v);
        else if (k === 'wd') n.textContent = isToday ? 'اليوم' : v;
        else n.textContent = v;
      });
    }
    var now = root.querySelector('[data-sm-now]');
    if (now) fill(now, rows[i], true);
    cards.forEach(function (card, k) {
      var row = rows[Math.min(i + k, rows.length - 1)];
      card.classList.toggle('today', k === 0);
      fill(card, row, k === 0);
    });
  }
  if (typeof window !== 'undefined') window.mountSunMoon = mountSunMoon;

  function smRender() {
    document.querySelectorAll('[data-sm-root]').forEach(mountSunMoon);
  }

  /* ═══ التنقّل: إغلاقٌ بالمفتاح وبالنقر خارجها ═══
     **والحصريّة ليست هنا** — سمة `name` على `<details>` تكفّلت بها أصليّاً،
     فلا تُفتح اثنتان معاً ولو عُطِّل الجافاسكربت. وهذان تحسينان فوقها:
     `Escape` يغلق ويعيد التركيز إلى الزرّ، والنقرُ خارجها يغلق. ولا شيء
     منهما شرطٌ للتنقّل — الروابط `<a href>` تعمل كما هي. */
  /* ═══ لوحةُ الهاتف تُطوى بالجافاسكربت، ولا تُظهرها هي ═══
     الترميزُ يخرج **مفتوحاً**، فالبنود ظاهرةٌ على سطح المكتب وظاهرةٌ لمن
     عطّل الجافاسكربت. وهذا يطوي على الشاشات الضيّقة وحدها — **تحسينٌ ينقص
     لا شرطٌ يُظهر**. وعند تجاوز الحدّ صعوداً تُفتح ثانيةً، فلا تختفي
     البنودُ بتكبير النافذة. */
  var navPanel = document.querySelector('.site-nav .nav-panel');
  var navNarrow = window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
  function navIsNarrow() { return !!(navNarrow && navNarrow.matches); }
  function navSync() {
    if (navPanel) navPanel.open = !navIsNarrow();
  }
  navSync();
  if (navNarrow && navNarrow.addEventListener) {
    navNarrow.addEventListener('change', navSync);   /* عند عبور الحدّ وحده */
  }

  /* الإغلاقُ بالمفتاح وبالنقر خارجها — **للمنسدلات دائماً، وللّوحة على
     الضيّق وحده**؛ فإغلاقُها على سطح المكتب يمحو الشريط كلَّه. */
  function navOpen() {
    var out = [].slice.call(document.querySelectorAll('.site-nav details.dd-wrap[open]'));
    if (navIsNarrow() && navPanel && navPanel.open) out.push(navPanel);
    return out;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = navOpen();
    if (!open.length) return;
    /* الأعمق أولاً: منسدلةٌ داخل لوحة الهاتف تُغلق قبل اللوحة نفسها */
    var d = open[0];
    d.open = false;
    var s = d.querySelector('summary');
    if (s) s.focus();
  });
  document.addEventListener('click', function (e) {
    navOpen().forEach(function (d) {
      if (!d.contains(e.target)) d.open = false;
    });
  });

  markToday(); smRender();
  setInterval(function () { markToday(); smRender(); }, 60000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { markToday(); smRender(); tick(); }
  });

  tick(); setInterval(tick, 1000);

  /* وحين تصل الحمولة يُعاد الحكمُ كلُّه بها — قبلها المعروضُ بناءُ الخادم */
  loadSiteData().then(function (d) { if (d) { smRender(); tick(); } });

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

  /* ═══ أكواد الرعد — مولَّدةٌ من `WMO_CODES` في بايثون ═══
     لا جدول ثانٍ، ولا استنتاجَ رعدٍ من كميةِ هطولٍ ولا من احتماله. */
  var THUNDER = [95, 96, 99];
  function isThunder(code) {
    for (var i = 0; i < THUNDER.length; i++) if (THUNDER[i] === code) return true;
    return false;
  }

  /* ═══ قواعدُ عرضٍ تحريريّة للموقع — لا تعريفاتٌ من المصدر ═══
     **`POP_MIN` عتبةُ «الفرصة المعتبَرة»: ٣٠٪ فأعلى.** اختيارُنا نحن، وتُعلَن
     على الصفحة كذلك — فـOpen-Meteo يرسل احتمالاً لا حكماً. و‎٢٩٪‎ دونها
     و‎٣٠٪‎ تبلغها، والحدّ مفحوصٌ عند الرقمين.

     **وتصنيف نوع الهطول قاعدةٌ مشتقّة للموقع**، حتميّة، ولا تُطبَّق تحت
     ملّيمترٍ واحد — فالنسبة عند الكميات الضئيلة ضجيجٌ لا دلالة. */
  var POP_MIN = 30;
  var TYPE_MIN_MM = 1, TYPE_SHOWERS = 0.70, TYPE_WIDE = 0.30;

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
    /* `prcp` هو **الإجمالي المنقول** عن المصدر (`precipitation`) — أُضيف في
       المرحلة ٨أ لصفحة الأمطار، **ولم يُستبدل به `rain`**: ذاك يحمل
       `rain + showers` ويقرؤه جدولُ فترات `weather.html` بلفظه «كمية المطر»،
       ودلالتُه لم تتغيّر. والصفحتان تقرآن حقلين مختلفين عن قصد. */
    var codes2 = codes, th = false;
    for (i = 0; i < codes2.length; i++) if (isThunder(codes2[i])) th = true;
    return {
      day: g.day, part: g.part, name: PARTS[g.part], hours: I.length,
      from: (H.time[I[0]] || '').slice(11, 16),
      to: (H.time[I[I.length - 1]] || '').slice(11, 16),
      code: (H.weather_code || [])[at],
      isDay: (H.is_day || [])[at],
      prcp: sum(col(H, 'precipitation', I)),
      thunder: th,
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

  /* ═══════════ نواةُ الأمطار (المرحلة ٨أ) ═══════════
     **والساعيّ لا يُخلط باليوميّ.** النوافذ هنا **متدحرجة من الساعة الحالية**
     (٢٤ و٤٨ ساعة)، و`daily[0]` يومٌ تقويميّ كامل مضى بعضُه — فمجموعُ ما بقي
     من الساعات **لا يساوي** `daily[0].precipitation_sum` ولا يُقارَن به.
     ولذلك تُعلن كلُّ نافذةٍ مداها الحقيقيّ (`from`–`to`) لا اسمَها فحسب. */

  /* خلاصةُ نافذةٍ ساعية. **والاحتمالُ والكميةُ قيمتان منفصلتان** لا تُشتقّ
     إحداهما من الأخرى: الأولى `precipitation_probability` بأقصاها في النافذة،
     والثانية `precipitation` — **الإجماليّ المنقول** عن المصدر، لا
     `rain + showers` (فذاك يُسقط الثلج، ومكافئُه المائيّ غيرُ وحدته). */
  function rainWindow(H, idx) {
    var empty = { hours: 0, from: '', to: '', pop: null, amount: null,
                  wetHours: 0, thunder: false };
    if (!H || !H.time || !idx || !idx.length) return empty;
    var pr = col(H, 'precipitation', idx), codes = col(H, 'weather_code', idx);
    var wet = 0, th = false, i;
    for (i = 0; i < pr.length; i++) if (ok(pr[i]) && pr[i] > 0) wet++;
    for (i = 0; i < codes.length; i++) if (isThunder(codes[i])) th = true;
    return {
      hours: idx.length,
      from: (H.time[idx[0]] || '').slice(0, 16),
      to: (H.time[idx[idx.length - 1]] || '').slice(0, 16),
      pop: maxOf(col(H, 'precipitation_probability', idx)),
      amount: sum(pr),
      wetHours: wet,
      thunder: th
    };
  }

  /* أقربُ فرصةٍ معتبَرة — **أولُ** ساعةٍ يبلغ احتمالُها العتبة، لا أعلاها.
     فالسؤال «متى» لا «كم أقصى ما يبلغ». و`null` تعني: لا فرصة في النافذة،
     وهي نتيجةٌ تُعرض صريحةً لا فراغاً. */
  function nearestChance(H, idx) {
    if (!H || !H.time || !idx) return null;
    var P = H.precipitation_probability || [];
    for (var k = 0; k < idx.length; k++) {
      var i = idx[k];
      if (ok(P[i]) && P[i] >= POP_MIN) {
        return { i: i, iso: H.time[i], pop: P[i],
                 amount: (H.precipitation || [])[i],
                 code: (H.weather_code || [])[i] };
      }
    }
    return null;
  }

  /* أقوى كميةٍ ساعية في النافذة — **وأولُ ساعةٍ بلغتها ممثّلتُها**، كقاعدة
     `summarize` نفسها، فلا يتأرجح الاختيار عند التساوي. */
  function strongestHour(H, idx) {
    if (!H || !H.time || !idx) return null;
    var A = H.precipitation || [], best = null;
    for (var k = 0; k < idx.length; k++) {
      var i = idx[k];
      if (!ok(A[i]) || A[i] <= 0) continue;
      if (best === null || A[i] > best.amount) {
        best = { i: i, iso: H.time[i], amount: A[i],
                 pop: (H.precipitation_probability || [])[i],
                 code: (H.weather_code || [])[i] };
      }
    }
    return best;
  }

  /* نوع الهطول — `showers` · `widespread` · `mixed` · و`null` دون العتبة.
     **قاعدةٌ للموقع لا نصٌّ من المصدر**، ومكتوبةٌ هنا في موضعٍ واحد. */
  function precipType(rainSum, showersSum) {
    var r = ok(rainSum) ? rainSum : 0, s = ok(showersSum) ? showersSum : 0;
    var q = r + s;
    if (q < TYPE_MIN_MM) return null;
    var f = s / q;
    if (f >= TYPE_SHOWERS) return 'showers';
    if (f <= TYPE_WIDE) return 'widespread';
    return 'mixed';
  }

  /* أفي الأفق كودٌ رعديّ؟ — يُسأل عن قائمة أكواد، مصدرُها `weather_code`. */
  function thunderIn(codes) {
    if (!codes) return false;
    for (var i = 0; i < codes.length; i++) if (isThunder(codes[i])) return true;
    return false;
  }

  return { SEV: SEV, PARTS: PARTS, sev: sev, mean: mean, sum: sum, maxOf: maxOf,
           circMean: circMean, summarize: summarize, dayparts: dayparts,
           nextHours: nextHours, fmtDur: fmtDur,
           POP_MIN: POP_MIN, TYPE_MIN_MM: TYPE_MIN_MM,
           TYPE_SHOWERS: TYPE_SHOWERS, TYPE_WIDE: TYPE_WIDE,
           THUNDER: THUNDER, isThunder: isThunder, thunderIn: thunderIn,
           rainWindow: rainWindow, nearestChance: nearestChance,
           strongestHour: strongestHour, precipType: precipType };
})();
if (typeof window !== 'undefined') window.WX = WX;

/* ═══════════ التعريب — مصدرُ حقيقةٍ واحد ═══════════
   جدولا WMO والاتجاهات **يُولَّدان من بايثون** (`WMO_CODES` و`DIRS`) عند
   البناء، ولا مرآةَ يدوية هنا تفترق عنهما. وكانا يُحقنان في سكربتٍ مضمَّن
   داخل صفحة الطقس وحدها (`window.WMO`/`window.WDIRS`) — فمكوّنٌ يُركَّب على
   صفحةٍ أخرى كان يخرج بلا تعريب. وصارا في هذا الملفّ، يقرؤهما كل مستهلك.

   **والقاعدة واحدة كذلك لا الجدول وحده:** قسمة الزاوية على ٤٥ وتقريبها —
   وكانت مكتوبةً هنا وفي `wind_dir_name` ببايثون، فوُحِّدت صياغتُها. */
var WXL = (function () {
  var WMO = {"0": "صحو", "1": "صحو غالباً", "2": "غائم جزئياً", "3": "غائم كلياً", "45": "ضباب", "48": "ضباب متجمّد", "51": "رذاذ خفيف", "53": "رذاذ متوسط", "55": "رذاذ كثيف", "61": "مطر خفيف", "63": "مطر متوسط", "65": "مطر غزير", "80": "زخّات مطر خفيفة", "81": "زخّات مطر متوسطة", "82": "زخّات مطر عنيفة", "95": "عاصفة رعدية", "96": "عاصفة رعدية مع برَد", "99": "عاصفة رعدية شديدة مع برَد"};
  var DIRS = ["شمال", "شمال شرق", "شرق", "جنوب شرق", "جنوب", "جنوب غرب", "غرب", "شمال غرب"];

  /* الحالة الجوية نصّاً. والمجهول يُسمّى مجهولاً ولا يُخمَّن. */
  function condition(code) {
    if (code === null || code === undefined) return 'غير معروفة';
    return WMO[String(code)] || 'غير معروفة';
  }

  /* الاتجاه من الزاوية — ثمانية قطاعات، كلٌّ ٤٥°، ومركزُ الأول شمالٌ تامّ.
     **والتطبيع يسبق القسمة**: الزاوية قد تأتي سالبة أو فوق ٣٦٠ من مصدرٍ
     أو من متوسّطٍ دائريّ، و`%` في جافاسكربت يُبقي إشارة السالب. */
  function windDir(deg) {
    if (deg === null || deg === undefined) return '';
    var d = Number(deg);
    if (!isFinite(d)) return '';
    d = ((d % 360) + 360) % 360;
    return DIRS[Math.round(d / 45) % 8] || '';
  }
  return { WMO: WMO, DIRS: DIRS, condition: condition, windDir: windDir };
})();
if (typeof window !== 'undefined') window.WXL = WXL;

/* ═══════════ أيقونات الحالة — بياناتُ عرضٍ، لا تعريب ═══════════
   **العطب الذي تعالجه:** كان `condSvg` يقرأ `window.CONDSVG` و`CONDKEY`
   و`CONDNIGHT` — **ولم تُعرَّف قطّ في أي مخرَج**، بينما `COND_ICONS` و
   `COND_KEY` و`NIGHT_SWAP` معرَّفةٌ في المولّد ولا تُرسَل. فكانت كل أيقونة
   `<svg>` فارغاً على الموقع المنشور.

   والعلاج **توليدُ البيانات من مصدرها في بايثون**، لا إعادةُ متغيّراتٍ
   عامة كما كانت. وهي منفصلة عن `WXL` عمداً: ذاك دلالةٌ ونصّ، وهذه شكل —
   فلا يولّد جدولٌ واحد النصَّ والترميزَ معاً. */
var WXI = (function () {
  var ICONS = {"sun": "<circle cx=\"12\" cy=\"12\" r=\"4.3\" fill=\"currentColor\" stroke=\"none\"/><line x1=\"18.6\" y1=\"12.0\" x2=\"21.2\" y2=\"12.0\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><line x1=\"16.7\" y1=\"16.7\" x2=\"18.5\" y2=\"18.5\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><line x1=\"12.0\" y1=\"18.6\" x2=\"12.0\" y2=\"21.2\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><line x1=\"7.3\" y1=\"16.7\" x2=\"5.5\" y2=\"18.5\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><line x1=\"5.4\" y1=\"12.0\" x2=\"2.8\" y2=\"12.0\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><line x1=\"7.3\" y1=\"7.3\" x2=\"5.5\" y2=\"5.5\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><line x1=\"12.0\" y1=\"5.4\" x2=\"12.0\" y2=\"2.8\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><line x1=\"16.7\" y1=\"7.3\" x2=\"18.5\" y2=\"5.5\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/>", "moon": "<path d=\"M20 14.2A8.2 8.2 0 0 1 9.8 4 8.6 8.6 0 1 0 20 14.2Z\" fill=\"currentColor\" stroke=\"none\"/>", "partsun": "<circle cx=\"9\" cy=\"9\" r=\"3.2\" fill=\"currentColor\" stroke=\"none\"/><line x1=\"14.1\" y1=\"9.0\" x2=\"16.1\" y2=\"9.0\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><line x1=\"12.6\" y1=\"12.6\" x2=\"14.0\" y2=\"14.0\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><line x1=\"9.0\" y1=\"14.1\" x2=\"9.0\" y2=\"16.1\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><line x1=\"5.4\" y1=\"12.6\" x2=\"4.0\" y2=\"14.0\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><line x1=\"3.9\" y1=\"9.0\" x2=\"1.9\" y2=\"9.0\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><line x1=\"5.4\" y1=\"5.4\" x2=\"4.0\" y2=\"4.0\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><line x1=\"9.0\" y1=\"3.9\" x2=\"9.0\" y2=\"1.9\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><line x1=\"12.6\" y1=\"5.4\" x2=\"14.0\" y2=\"4.0\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><path d=\"M8.4 19.6h9.2a3.3 3.3 0 0 0 .2-6.6 4.9 4.9 0 0 0-9.2-1.1 3.4 3.4 0 0 0-.2 7.7Z\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\" fill=\"var(--panel)\"/>", "partmoon": "<path d=\"M17.6 10.4A6 6 0 0 1 10 3a6.3 6.3 0 1 0 7.6 7.4Z\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M8.4 19.6h9.2a3.3 3.3 0 0 0 .2-6.6 4.9 4.9 0 0 0-9.2-1.1 3.4 3.4 0 0 0-.2 7.7Z\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\" fill=\"var(--panel)\"/>", "cloud": "<path d=\"M7 18.5h10.2a3.7 3.7 0 0 0 .2-7.4 5.5 5.5 0 0 0-10.4-1.2A3.8 3.8 0 0 0 7 18.5Z\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/>", "fog": "<path d=\"M7.5 14.5h9.2a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-9.8-1.1 3.6 3.6 0 0 0 .4 8.1Z\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/><path d=\"M4.5 18h15M6.5 21h11\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/>", "drizzle": "<path d=\"M7 14.5h10a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-9.8-1.1A3.6 3.6 0 0 0 7 14.5Z\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/><path d=\"M9.5 17.6v1.8M13 18v2.2M16.5 17.6v1.8\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/>", "rain": "<path d=\"M7 14.5h10a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-9.8-1.1A3.6 3.6 0 0 0 7 14.5Z\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/><path d=\"M9 17.4l-1 3.4M13 17.4l-1 3.4M17 17.4l-1 3.4\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/>", "storm": "<path d=\"M7 13.8h10a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-9.8-1.1A3.6 3.6 0 0 0 7 13.8Z\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/><path d=\"M13.2 16.2l-3.4 4.2h3l-1 3.1\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/>"};
  var KEY = {"0": "sun", "1": "sun", "2": "partsun", "3": "cloud", "45": "fog", "48": "fog", "51": "drizzle", "53": "drizzle", "55": "drizzle", "61": "rain", "63": "rain", "65": "rain", "80": "rain", "81": "rain", "82": "rain", "95": "storm", "96": "storm", "99": "storm"};
  var NIGHT = {"sun": "moon", "partsun": "partmoon"};

  /* المفتاح من كود WMO. **والمجهول غيمٌ** — وهو الاحتياط الذي كان في
     الكود، أُبقي بحرفه. والليل يُبدَّل حيث له نسخة (الصافي وقليل الغيم). */
  function iconKey(code, isDay) {
    var k = KEY[String(code)] || 'cloud';
    if (isDay === 0 && NIGHT[k]) k = NIGHT[k];
    return k;
  }
  function svg(code, isDay, cls) {
    return '<svg viewBox="0 0 24 24" class="' + cls + '" aria-hidden="true">' +
           (ICONS[iconKey(code, isDay)] || '') + '</svg>';
  }
  return { ICONS: ICONS, KEY: KEY, NIGHT: NIGHT, iconKey: iconKey, svg: svg };
})();
if (typeof window !== 'undefined') window.WXI = WXI;

/* ═══════════ العارض الحيّ — مكوّنٌ يُركَّب على جذرٍ يُمرَّر إليه ═══════════
   كان مقيَّداً بـ`#liveNow` وبأربعة معرّفات عامة، فلا يقبل نسختين في صفحة
   ولا يُركَّب على صفحةٍ أخرى. صار: **كل عنصرٍ يمسّه يُستخرج من جذره**
   بـ`[data-wx-part]` و`[data-wx-role]`، ولا `document.getElementById` فيه.
   والبحث عن نقطة التركيب وحده يعرف الصفحة — في المُهيّئ آخر الملفّ. */
function mountWeather(root) {
  if (!root || !window.fetch) return;
  function part(name) { return root.querySelector('[data-wx-part="' + name + '"]'); }
  /* **الأجزاء اختيارية.** كان الجذر يُشترط فيه جزءُ «الآن»، فصفحةٌ تحمل
     الأيام وحدها (`forecast.html`) لا تُركَّب. والشرط الآن: جزءٌ معروف واحد
     على الأقل — وكلُّ عرضٍ يفحص جزأه بنفسه. */
  var PARTS = ['now', 'next5', 'parts', 'days', 'days-summary', 'rain-forecast',
               'brief', 'rain-brief'];
  var nowBox = part('now');
  if (!PARTS.some(part)) return;
  var ready = false;             /* بلغت الصفحة قراءةً سليمة مرّةً */

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
  function dirName(deg) { return WXL.windDir(deg); }
  function condText(code) { return WXL.condition(code); }
  function condSvg(code, isDay, cls) { return WXI.svg(code, isDay, cls); }
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
  function fail(name, on) {
    var box = part(name);
    if (!box) return;
    var f = box.querySelector('.wx-fail');
    if (f) f.hidden = !on;
  }

  /* ═══ ١ · الحالة الآن ومعها اليوم ═══ */
  function renderCurrentToday(data) {
    if (!nowBox) return;
    var c = data.current, D = data.daily;
    if (!c) throw new Error('no current');
    nowBox.querySelector('.lv-when').textContent = whenText(c.time);
    /* وقت التحديث المركزيّ من `generated_at` لا من وقت القراءة — والفرق
       بينهما دقائق، وخلطُهما يوهم القارئ أن الرقم أحدثُ أو أقدمُ مما هو. */
    var up = nowBox.querySelector('.lv-upd');
    if (up) {
      var ut = riyadhTime(data.generated_at);
      up.textContent = ut ? ' · آخر تحديث ' + ut + ' بتوقيت سراة عبيدة' : '';
    }
    nowBox.querySelector('.lv-cond').textContent = condText(c.weather_code);
    nowBox.querySelector('.lv-icon').innerHTML = condSvg(c.weather_code, c.is_day, 'lv-bigsvg');
    nowBox.querySelector('.lv-temp').textContent = nf(c.temperature_2m, 1) + '°';

    /* العظمى والصغرى بجوار الحرارة الحالية — لا في قسمٍ أسفل الصفحة */
    var hasD = D && D.temperature_2m_max && D.temperature_2m_max.length;
    set(nowBox, 'tmax', hasD ? nf(D.temperature_2m_max[0], 0) + '°' : '—');
    set(nowBox, 'tmin', hasD ? nf(D.temperature_2m_min[0], 0) + '°' : '—');
    set(nowBox, 'fmax', hasD ? nf(D.apparent_temperature_max[0], 0) + '°' : '—');
    set(nowBox, 'fmin', hasD ? nf(D.apparent_temperature_min[0], 0) + '°' : '—');

    set(nowBox, 'feels', nf(c.apparent_temperature, 1) + '°');
    set(nowBox, 'hum', nf(c.relative_humidity_2m, 0) + '٪');
    set(nowBox, 'dew', nf(c.dew_point_2m, 1) + '°');
    set(nowBox, 'cloud', nf(c.cloud_cover, 0) + '٪');
    set(nowBox, 'vis', (c.visibility === null || c.visibility === undefined)
        ? '—' : nf(c.visibility / 1000, 1) + ' كم');
    set(nowBox, 'pop', nf(c.precipitation_probability, 0) + '٪');

    /* كمية الهطول: تظهر خانتها حين يكون هناك هطول فعلاً */
    var pr = nowBox.querySelector('[data-lv="prcp"]');
    if (pr) {
      var has = (c.precipitation !== null && c.precipitation !== undefined && c.precipitation > 0);
      pr.hidden = !has;
      if (has) set(nowBox, 'prcp', nf(c.precipitation, 1) + ' مم');
    }

    var ws = nowBox.querySelector('[data-lv="wind"] svg');
    if (ws && c.wind_direction_10m !== undefined && c.wind_direction_10m !== null) {
      ws.querySelector('.lv-needle').setAttribute('transform',
        'rotate(' + c.wind_direction_10m + ' ' + ws.dataset.cx + ' ' + ws.dataset.cy + ')');
      ws.querySelector('.lv-speed').textContent = nf(c.wind_speed_10m, 0);
      ws.setAttribute('aria-label', 'اتجاه الرياح ' + Math.round(c.wind_direction_10m) +
        ' درجة، السرعة ' + nf(c.wind_speed_10m, 0) + ' كم/س');
    }
    nowBox.querySelector('.lv-wind').textContent = 'الرياح ' + nf(c.wind_speed_10m, 1) +
      ' كم/س، من ' + dirName(c.wind_direction_10m) +
      (c.wind_gusts_10m ? ' · هبّات ' + nf(c.wind_gusts_10m, 0) : '');

    var ps = nowBox.querySelector('[data-lv="pres"] svg');
    if (ps && c.pressure_msl !== undefined && c.pressure_msl !== null) {
      var a0 = +ps.dataset.a0, a1 = +ps.dataset.a1,
          v0 = +ps.dataset.vmin, v1 = +ps.dataset.vmax;
      var fr = Math.max(0, Math.min(1, (c.pressure_msl - v0) / (v1 - v0)));
      ps.querySelector('.lv-needle').setAttribute('transform',
        'rotate(' + (fr * (a1 - a0)).toFixed(2) + ' ' + ps.dataset.cx + ' ' + ps.dataset.cy + ')');
      ps.querySelector('.lv-gval').textContent = nf(c.pressure_msl, 1);
      ps.setAttribute('aria-label', 'الضغط ' + nf(c.pressure_msl, 1) + ' هكتوباسكال');
    }
    nowBox.querySelector('.lv-pres').textContent = 'الضغط ' + nf(c.pressure_msl, 1) + ' هكتوباسكال';

    /* أقصى UV **اليوم** من daily[0] — لا من current، فالقيمة اللحظية ليلاً صفر */
    var us = nowBox.querySelector('[data-lv="uv"] svg');
    var uv = hasD && D.uv_index_max ? D.uv_index_max[0] : null;
    if (us && uv !== null && uv !== undefined) {
      var fu = Math.max(0, Math.min(1, uv / +us.dataset.vmax));
      var mk = us.querySelector('.lv-uv-mark');
      mk.setAttribute('cx', (+us.dataset.x0 + fu * +us.dataset.w).toFixed(1));
      mk.setAttribute('visibility', 'visible');
      us.setAttribute('aria-label', 'أقصى مؤشّر UV اليوم ' + nf(uv, 1));
    }
    nowBox.querySelector('.lv-uv-l').textContent = 'أقصى UV اليوم ' + nf(uv, 1);

    nowBox.classList.add('lv-ready');
    nowBox.classList.remove('lv-loading');
    fail('now', false);
  }

  /* ═══ ٢ · الساعات الخمس القادمة — نظرة سريعة، ثلاثة أرقام لا أكثر ═══ */
  function renderNext5(data) {
    var box = part('next5');
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
    fail('next5', false);
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
    var box = part('parts');
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
    fail('parts', false);
  }

  /* ═══ ٤ · أربعة عشر يوماً — daily[1..14]، واليوم عُرض أعلاه ═══ */
  /* ═══ الأفق المعروض: **أربعة عشر يوماً مستقبلية** ═══
     `daily[0]` هو اليوم وقد عُرض في «الطقس الآن»، فالعرض `daily[1..14]`.
     والقيمة هنا لا تُكرَّر في مكانين: التفصيل والملخّص يقرآن من `dayBase`
     نفسها — فلا ينفرد أحدهما بتاريخٍ أو حرارةٍ تخالف الآخر. */
  var DAY_FROM = 1, DAY_N = 14;

  function dayBase(D, i) {
    var iso = D.time[i];
    return { iso: iso, day: dayName(iso), date: dayShort(iso),
             code: D.weather_code[i],
             tmax: nf(D.temperature_2m_max[i], 0) + '°',
             tmin: nf(D.temperature_2m_min[i], 0) + '°',
             /* احتمال الهطول حقلٌ ثابت — يُعرض ولو كان صفراً، فالصفر خبرٌ
                لا فراغ، واختفاؤه يجعل الخانات غير متساوية فتُقرأ معطوبة. */
             pop: nf(D.precipitation_probability_max[i], 0) + '٪' };
  }

  /* ═══ ٤-ب · ملخّص الأيام: خمسة حقول لا أكثر ═══ */
  function renderDaysSummary(data) {
    var box = part('days-summary');
    if (!box) return;
    var D = data.daily;
    if (!D || !D.time) throw new Error('no daily');
    box.querySelectorAll('.ds-cell').forEach(function (cell, k) {
      var i = DAY_FROM + k;
      if (i >= D.time.length) { cell.hidden = true; return; }
      cell.hidden = false;
      var b = dayBase(D, i);
      set(cell, 'day', b.day);
      set(cell, 'date', b.date);
      var ie = cell.querySelector('[data-k="ico"]');
      if (ie) ie.innerHTML = condSvg(b.code, 1, 'ds-svg');
      set(cell, 'tmax', b.tmax);
      set(cell, 'tmin', b.tmin);
      set(cell, 'pop', b.pop);
    });
    box.classList.add('ds-ready');
    fail('days-summary', false);
  }

  function renderDays(data) {
    var box = part('days');
    if (!box) return;
    var D = data.daily;
    if (!D || !D.time) throw new Error('no daily');
    var cards = box.querySelectorAll('.dq-card');

    cards.forEach(function (card, k) {
      var i = DAY_FROM + k;
      if (i >= D.time.length) { card.hidden = true; return; }
      card.hidden = false;
      var b = dayBase(D, i);
      set(card, 'day', b.day);
      set(card, 'date', b.date);
      var ie = card.querySelector('[data-k="ico"]');
      if (ie) ie.innerHTML = condSvg(b.code, 1, 'dq-svg');
      set(card, 'cond', condText(b.code));
      set(card, 'tmax', b.tmax);
      set(card, 'tmin', b.tmin);
      set(card, 'pop', b.pop);
      set(card, 'fmax', nf(D.apparent_temperature_max[i], 0) + '°');
      set(card, 'fmin', nf(D.apparent_temperature_min[i], 0) + '°');
      set(card, 'hum', nf(D.relative_humidity_2m_mean[i], 0) + '٪');
      set(card, 'wind', nf(D.wind_speed_10m_max[i], 0) + ' كم/س');
      set(card, 'gust', nf(D.wind_gusts_10m_max[i], 0) + ' كم/س');
      var dd = D.wind_direction_10m_dominant[i];
      set(card, 'dir', dd === null || dd === undefined
          ? '—' : dirName(dd) + ' ' + nf(dd, 0) + '°');
      set(card, 'prcp', nf(D.precipitation_sum[i], 1) + ' مم');
      set(card, 'uv', nf(D.uv_index_max[i], 1));
      set(card, 'rise', (D.sunrise[i] || '').slice(11, 16) || '—');
      set(card, 'set', (D.sunset[i] || '').slice(11, 16) || '—');
      set(card, 'sun', WX.fmtDur(D.sunshine_duration[i]));
    });
    box.classList.add('dq-ready');
    fail('days', false);
  }

  /* ═══ ٥ · توقّعات الأمطار — متى يُتوقَّع الهطول؟ وكم؟ وما طبيعته؟ ═══
     تجيب هذه الصفحة سؤالاً غير سؤال `forecast.html`: تلك «كيف سيكون يوم
     الخميس؟» وهذه «متى تمطر وكم؟». فلا يُنسَخ جدولُها هنا. */
  var TYPE_AR = { showers: 'الغالب زخات',
                  widespread: 'الغالب مطر من نظم واسعة النطاق',
                  mixed: 'خليط' };

  function num(v) { return v !== null && v !== undefined && !isNaN(v); }

  /* **«رذاذ» لا تُقال للكمية الصغيرة**: هي نوعُ هطولٍ له كودُه في المصدر
     (٥١–٥٥)، لا وصفٌ لقلّة الملّيمترات. والقليل يُقال فيه «كمية ضئيلة». */
  function mmText(v) {
    if (!num(v)) return '—';
    if (v <= 0) return '0 مم';
    if (v < 1) return nf(v, 1) + ' مم · كمية ضئيلة';
    return nf(v, 1) + ' مم';
  }
  function popText(v) { return num(v) ? nf(v, 0) + '٪' : '—'; }
  function hourText(iso) {
    return iso ? dayName(iso) + ' ' + dayShort(iso) + ' · ' + iso.slice(11, 16) : '—';
  }
  /* المدى الحقيقيّ للنافذة يُعلَن — فاسمُها «٤٨ ساعة» وصفٌ، وهذا هو القياس */
  function spanText(a, b) {
    if (!a || !b) return '—';
    return dayShort(a) + ' ' + a.slice(11, 16) + ' ← ' + dayShort(b) + ' ' + b.slice(11, 16);
  }

  function renderRainForecast(data) {
    var box = part('rain-forecast');
    if (!box) return;
    var H = data.hourly, D = data.daily, c = data.current;
    if (!H || !H.time || !c) throw new Error('no hourly');
    if (!D || !D.time) throw new Error('no daily');
    var key = (c.time || '').slice(0, 13);
    var i24 = WX.nextHours(H, key, 24), i48 = WX.nextHours(H, key, 48);
    if (!i48.length) throw new Error('no future hours');
    var w24 = WX.rainWindow(H, i24), w48 = WX.rainWindow(H, i48);

    /* ١ · أقربُ فرصةٍ معتبَرة — أو إعلانُ غيابها صريحاً */
    var lead = box.querySelector('[data-rf="lead"]');
    var nc = WX.nearestChance(H, i48);
    var lico = lead.querySelector('[data-k="ico"]');
    if (nc) {
      set(lead, 'when', hourText(nc.iso));
      set(lead, 'pop', popText(nc.pop));
      set(lead, 'amt', mmText(nc.amount));
      set(lead, 'note', 'أولُ ساعةٍ يبلغ احتمالُها ' + WX.POP_MIN +
                        '٪ فأعلى، خلال النافذة كلّها.');
      if (lico) lico.innerHTML = condSvg(nc.code, 1, 'rf-svg');
      lead.classList.remove('rf-none');
    } else {
      set(lead, 'when', 'لا فرصةَ هطولٍ معتبَرة خلال النافذة');
      set(lead, 'pop', '—');
      set(lead, 'amt', '—');
      set(lead, 'note', 'لم يبلغ احتمالُ أيّ ساعةٍ ' + WX.POP_MIN +
                        '٪ — وهذه نتيجةٌ لا فراغ.');
      if (lico) lico.innerHTML = condSvg(0, 1, 'rf-svg');
      lead.classList.add('rf-none');
    }

    /* ٢ و٣ · نافذتان متدحرجتان من الساعة الحالية — لا يومان تقويميّان */
    [[24, w24], [48, w48]].forEach(function (p) {
      var el = box.querySelector('[data-w="' + p[0] + '"]');
      if (!el) return;
      var w = p[1];
      set(el, 'span', spanText(w.from, w.to) + ' · ' + w.hours + ' ساعة');
      set(el, 'pop', popText(w.pop));
      set(el, 'amt', mmText(w.amount));
      set(el, 'wet', String(w.wetHours));
    });

    /* ٤ · فترات اليوم داخل الـ٤٨ — بالتقسيم نفسه الذي في «الطقس» */
    var ps = WX.dayparts(H, key), rows = '';
    ps.forEach(function (p) {
      rows += '<tr><th scope="row"><b>' + dayName(p.day) + '</b>' +
              '<i>' + p.name + '</i><span>' + p.from + '–' + p.to + '</span></th>' +
              '<td class="rf-c">' + condSvg(p.code, p.isDay, 'rf-psvg') +
              '<span>' + condText(p.code) + '</span></td>' +
              '<td>' + popText(p.pop) + '</td>' +
              '<td>' + mmText(p.prcp) + '</td></tr>';
    });
    var tb = box.querySelector('.rf-parts tbody');
    if (tb) tb.innerHTML = rows;

    /* ٥ · أقوى كميةٍ ساعية داخل النافذة */
    var peak = box.querySelector('[data-rf="peak"]');
    var sh = WX.strongestHour(H, i48);
    if (peak) {
      if (sh) {
        set(peak, 'when', hourText(sh.iso));
        set(peak, 'amt', mmText(sh.amount));
        set(peak, 'pop', popText(sh.pop));
      } else {
        set(peak, 'when', 'لا ساعةَ فيها كميةٌ تُذكر');
        set(peak, 'amt', '0 مم');
        set(peak, 'pop', '—');
      }
    }

    /* ٧ و٨ · الأفق اليوميّ `daily[1..14]`، والنوع حيث يصحّ تصنيفُه */
    box.querySelectorAll('.rf-day').forEach(function (li, k) {
      var i = DAY_FROM + k;
      if (i >= D.time.length) { li.hidden = true; return; }
      li.hidden = false;
      var iso = D.time[i];
      set(li, 'day', dayName(iso));
      set(li, 'date', dayShort(iso));
      set(li, 'pop', popText((D.precipitation_probability_max || [])[i]));
      set(li, 'sum', mmText((D.precipitation_sum || [])[i]));
      var ph = (D.precipitation_hours || [])[i];
      set(li, 'hrs', num(ph) ? nf(ph, 0) : '—');
      var t = WX.precipType((D.rain_sum || [])[i], (D.showers_sum || [])[i]);
      var te = li.querySelector('[data-k="type"]');
      if (te) { te.textContent = t ? TYPE_AR[t] : ''; te.hidden = !t; }
    });

    /* ٩ · الرعد — من `weather_code` وحده، ولا يُستنتج من كميةٍ ولا احتمال */
    var dc = [];
    for (var j = DAY_FROM; j < D.time.length; j++) dc.push((D.weather_code || [])[j]);
    var thD = WX.thunderIn(dc);
    var tbx = box.querySelector('[data-rf="thunder"]');
    if (tbx) {
      var on = w48.thunder || thD;
      tbx.hidden = !on;
      if (on) {
        set(tbx, 'txt', w48.thunder
          ? ('في نافذة الساعات كودُ عاصفةٍ رعدية' +
             (thD ? '، وفي الأفق اليوميّ كذلك.' : '.'))
          : 'في الأفق اليوميّ كودُ عاصفةٍ رعدية.');
      }
    }

    box.classList.add('rf-ready');
    fail('rain-forecast', false);
  }

  /* ═══ ٦ · ملخّصا الرئيسية (المرحلة ٩) — بوّابتان لا لوحتا معلومات ═══
     **المعلومةُ نفسها هي البوابة**، فلا شبكةَ بطاقاتِ مجالات. وكلاهما يقرأ
     النسخةَ المركزية نفسها، ولا نداءَ ثالث. */
  function renderBrief(data) {
    var box = part('brief');
    if (!box) return;
    var c = data.current, D = data.daily;
    if (!c) throw new Error('no current');
    var ie = box.querySelector('[data-k="ico"]');
    if (ie) ie.innerHTML = condSvg(c.weather_code, c.is_day, 'brf-svg');
    set(box, 'temp', nf(c.temperature_2m, 0) + '°');
    set(box, 'cond', condText(c.weather_code));
    var hasD = D && D.temperature_2m_max && D.temperature_2m_max.length;
    set(box, 'tmax', hasD ? nf(D.temperature_2m_max[0], 0) + '°' : '—');
    set(box, 'tmin', hasD ? nf(D.temperature_2m_min[0], 0) + '°' : '—');
    box.classList.add('brf-ready');
    fail('brief', false);
  }

  /* **بطاقةُ الأمطار بترتيبٍ ملزم** (العقد، القسم ٥): إن كانت في الأفق فرصةٌ
     معتبَرة فالمعروضُ أقربُها ووجهتُها صفحةُ التوقّع؛ وإلا فسطرٌ موسميّ من
     السجلّ ووجهتُه السجلّ. **والافتراضُ المبنيّ هو الثاني** — فمن عطّل
     الجافاسكربت يرى رقماً تاريخياً صحيحاً ورابطاً حيّاً، لا فراغاً. */
  function renderRainBrief(data) {
    var box = part('rain-brief');
    if (!box) return;
    var H = data.hourly, c = data.current;
    if (!H || !H.time || !c) throw new Error('no hourly');
    var idx = WX.nextHours(H, (c.time || '').slice(0, 13), 48);
    var nc = WX.nearestChance(H, idx);
    var link = box.querySelector('[data-k="go"]');
    if (nc) {
      set(box, 'head', 'أقربُ فرصةِ هطول');
      set(box, 'when', hourText(nc.iso));
      set(box, 'pop', popText(nc.pop));
      set(box, 'amt', mmText(nc.amount));
      if (link) { link.setAttribute('href', 'rain-forecast.html');
                  link.textContent = 'توقعات الأمطار ←'; }
      box.classList.add('rb-live');
    } else {
      set(box, 'head', 'لا هطولَ معتبَراً في ثمانٍ وأربعين ساعة');
      set(box, 'when', 'والاحتمال دون ' + WX.POP_MIN + '٪ في النافذة كلّها');
      set(box, 'pop', '—');
      set(box, 'amt', '—');
      if (link) { link.setAttribute('href', 'rain.html');
                  link.textContent = 'سجلّ الأمطار ←'; }
      box.classList.remove('rb-live');
    }
    box.classList.add('rb-ready');
    fail('rain-brief', false);
  }

  /* ═══ التنسيق: كل قسم يفشل وحده، ولا ينتظر ما قبله ═══ */
  function safe(name, fn, data) {
    try { fn(data); return true; }
    catch (e) { fail(name, true); return false; }
  }
  /* حداثة النسخة المشتركة من ختمها هي، لا من وقت بناء الموقع ولا من آخر
     قراءةٍ ناجحة: القراءة قد تنجح على ملفٍ لم يُحدَّث مركزياً منذ ساعات. */
  var STALE = 45 * 60 * 1000;              /* ثلاث دورات فائتة */
  function showAge(data, note) {
    var el = root.querySelector('[data-wx-role="age"]');
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
    var a = safe('now', renderCurrentToday, data);
    var b = safe('next5', renderNext5, data);
    var cc = safe('parts', renderParts, data);
    var d = safe('days', renderDays, data);
    var e = safe('days-summary', renderDaysSummary, data);
    var f = safe('rain-forecast', renderRainForecast, data);
    var g = safe('brief', renderBrief, data);
    var h = safe('rain-brief', renderRainBrief, data);
    if (a || b || cc || d || e || f || g || h) {
      lastOk = Date.now(); lastData = data; ready = true;
    }
    showAge(data, false);
  }

  function load() {
    if (busy) return;
    busy = true;
    if (nowBox && !nowBox.classList.contains('lv-ready')) nowBox.classList.add('lv-loading');
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
    fetch(url(), ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { clearTimeout(to); renderWeather(d); })
      .catch(function () {
        clearTimeout(to);
        if (nowBox) nowBox.classList.remove('lv-loading');
        /* **فشل التحديث لا يمحو آخر بيانات ناجحة.** إن كانت الشاشة تحمل
           قراءةً سليمة تُترك ويُعلَن تعذّر التحديث؛ وإن لم تحمل شيئاً
           فشرطة صريحة — الفارغ يُقرأ «لم يكتمل الرسم» والشرطة «لا قيمة». */
        if (!ready) {
          if (nowBox) {
            nowBox.querySelector('.lv-when').textContent = '';
            var u0 = nowBox.querySelector('.lv-upd');
            if (u0) u0.textContent = '';
            nowBox.querySelector('.lv-cond').textContent = '';
            nowBox.querySelector('.lv-temp').textContent = '—';
            nowBox.querySelectorAll('.lv-v').forEach(function (e) { e.textContent = '—'; });
            nowBox.querySelector('.lv-wind').textContent = 'الرياح —';
            nowBox.querySelector('.lv-pres').textContent = 'الضغط —';
            nowBox.querySelector('.lv-uv-l').textContent = 'أقصى UV اليوم —';
          }
          PARTS.forEach(function (name) { fail(name, true); });
        } else {
          /* الشاشة تحمل قراءةً سليمة: تبقى كما هي، ويُعلَن تعذّر التحديث
             في سطرٍ صغير — لا رسالة فشل تحجب توقّعاً صالحاً. */
          showAge(lastData, true);
        }
      })
      .then(function () { busy = false; });
  }

  var rb = nowBox && nowBox.querySelector('.lv-retry');
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
  return { reload: load, root: root };
}
if (typeof window !== 'undefined') window.mountWeather = mountWeather;

/* المُهيّئ — **وهو وحده يعرف الصفحة.** يبحث عن نقاط التركيب ويسلّمها
   للمكوّن. ولو تعدّدت في صفحةٍ واحدة عمل كلٌّ مستقلاً عن أخيه. */
if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-wx-root]').forEach(function (el) {
    mountWeather(el);
  });
}
