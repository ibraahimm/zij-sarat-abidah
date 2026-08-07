
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
