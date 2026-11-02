// Reng: запись "работа -> день -> время" в готовое сообщение для мессенджера и фото крупно с лупой.
// Кнопки [data-msg]: data-mode="wa" - ссылка WhatsApp с текстом через ?text=; data-mode="copy" - текст копируется, ссылка открывает чат.
// Собрано из общих templates/_styles/style.js (запись) и nogti-198880646478-demo/sliva.js (лайтбокс).
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- запись: работа, день, время -> сообщение ----------
  const form = $("[data-booking]");
  const bubble = $("[data-bubble]");
  const greet = (form && form.dataset.greet) || "Здравствуйте! Пишу с сайта. Хочу записаться в сервис.";
  let touched = false;
  let message = greet;

  if (form) {
    const daysBox = $("[data-days]", form), timesBox = $("[data-times]", form), car = $("input[name=car]", form);
    const closed = (daysBox.dataset.closed || "").split(",").filter(Boolean).map(Number);
    const slotsFor = (wdN) => ((wdN != null && timesBox.dataset["slots-" + wdN] !== undefined ? timesBox.dataset["slots-" + wdN] : timesBox.dataset.slots) || "").split(",").filter(Boolean);
    const wd = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"], mon = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const today = new Date();
    const days = [];
    for (let i = 0; days.length < (+daysBox.dataset.n || 6) && i < 21; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      if (closed.includes(d.getDay())) continue;
      const short = wd[d.getDay()] + ", " + d.getDate() + " " + mon[d.getMonth()];
      const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : short;
      const msg = (i === 0 ? "сегодня, " : i === 1 ? "завтра, " : "") + short;
      days.push({ i, label, msg, wd: d.getDay() });
    }
    daysBox.innerHTML = days.map((x, n) => `<label class="opt"><input type="radio" name="day" value="${n}"${n === 0 ? " checked" : ""}><span>${x.label}</span></label>`).join("");

    const drawTimes = () => {
      const di = +(($("input[name=day]:checked", form) || {}).value || 0);
      const isToday = days[di] && days[di].i === 0;
      const nowH = today.getHours() + today.getMinutes() / 60;
      const prev = ($("input[name=time]:checked", form) || {}).value;
      let html = "", picked = false;
      slotsFor(days[di] && days[di].wd).forEach((t) => {
        const [h, m] = t.split(":").map(Number);
        const past = isToday && h + m / 60 <= nowH + 1;
        const on = !past && !picked && (!prev || prev === t);
        if (on) picked = true;
        html += `<label class="opt"><input type="radio" name="time" value="${t}"${past ? " disabled" : ""}${on ? " checked" : ""}><span>${t}</span></label>`;
      });
      timesBox.innerHTML = html;
      if (!$("input[name=time]:checked", form)) { const f = $("input[name=time]:not([disabled])", form); if (f) f.checked = true; }
    };

    const update = () => {
      const s = $("input[name=svc]:checked", form), d = $("input[name=day]:checked", form), t = $("input[name=time]:checked", form);
      let txt = form.dataset.message
        .replace("{услуга}", s ? s.dataset.name : "")
        .replace("{день}", d ? days[+d.value].msg : "")
        .replace("{время}", t ? t.value : "удобное время");
      const c = car && car.value.trim();
      if (c) txt += " Машина и что беспокоит: " + c.replace(/[.\s]+$/, "") + ".";
      message = txt;
      if (bubble) bubble.textContent = txt;
      syncLinks();
    };

    form.addEventListener("change", (e) => { touched = true; if (e.target.name === "day") drawTimes(); update(); });
    form.addEventListener("input", (e) => { if (e.target.name === "car") { touched = true; update(); } });
    drawTimes();
    // на сегодня окна закончились - выбираем следующий день
    if (!$("input[name=time]:not([disabled])", form)) { const next = $$("input[name=day]", form)[1]; if (next) { next.checked = true; drawTimes(); } }
    update();
  }

  // WhatsApp: готовый текст прямо в ссылке (?text=). Остальные каналы (Telegram, ВКонтакте) текст по ссылке не принимают: копируем, ссылка открывает чат.
  function syncLinks() {
    $$("[data-msg][data-mode=wa]").forEach((a) => {
      const text = a.closest("[data-booking]") || touched ? message : greet;
      a.href = a.dataset.base + "?text=" + encodeURIComponent(text);
    });
  }
  const copy = (text) => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((ok, fail) => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? ok() : fail(); } catch (e) { fail(e); }
      ta.remove();
    });
  };
  syncLinks();
  $$("[data-msg]").forEach((a) => a.addEventListener("click", () => {
    // кнопка в панели внизу до выбора в форме берёт просто приветствие, а не чужой выбор по умолчанию
    const text = a.closest("[data-booking]") || touched ? message : greet;
    window.__lastCopied = text;
    if (a.dataset.mode === "wa") { a.href = a.dataset.base + "?text=" + encodeURIComponent(text); return; }
    copy(text).then(() => { const n = $("[data-copied]"); if (n) { n.hidden = false; clearTimeout(n._t); n._t = setTimeout(() => (n.hidden = true), 6000); } }).catch(() => {});
  }));

  // ---------- фото крупно: нажатие - открыть, ещё нажатие на фото - приблизить, стрелки листают ----------
  const figs = $$(".work"), lb = $(".lb");
  if (figs.length && lb && lb.showModal) {
    const fr = $(".lb__frame", lb), im = $(".lb__img", lb), cap = $(".lb__cap", lb);
    const touch = matchMedia("(hover: none)").matches;
    let i = 0;
    const unzoom = () => fr.classList.remove("is-zoom");
    const aim = (x, y) => { const r = fr.getBoundingClientRect(); im.style.transformOrigin = Math.min(100, Math.max(0, (x - r.left) / r.width * 100)) + "% " + Math.min(100, Math.max(0, (y - r.top) / r.height * 100)) + "%"; };
    const show = (n) => {
      unzoom(); i = (n + figs.length) % figs.length;
      const src = $("img", figs[i]);
      im.src = figs[i].dataset.full || src.src; im.alt = src.alt;
      cap.textContent = $("figcaption", figs[i]).textContent;
      const hint = document.createElement("small");
      hint.textContent = touch ? "Нажмите на фото, чтобы приблизить" : "Нажмите на фото, чтобы приблизить, и ведите мышкой";
      cap.append(hint);
    };
    figs.forEach((f, n) => {
      const open = () => { show(n); lb.showModal(); };
      f.addEventListener("click", open);
      f.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    fr.addEventListener("click", (e) => { e.stopPropagation(); aim(e.clientX, e.clientY); fr.classList.toggle("is-zoom"); });
    fr.addEventListener("mousemove", (e) => { if (fr.classList.contains("is-zoom")) aim(e.clientX, e.clientY); });
    $(".lb__x", lb).onclick = () => lb.close();
    $(".lb__prev", lb).onclick = () => show(i - 1);
    $(".lb__next", lb).onclick = () => show(i + 1);
    lb.addEventListener("close", unzoom);
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb__in")) lb.close(); });
    lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
    let x0 = null;
    lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchmove", (e) => { if (fr.classList.contains("is-zoom")) { e.preventDefault(); aim(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    lb.addEventListener("touchend", (e) => { if (x0 === null || fr.classList.contains("is-zoom")) { x0 = null; return; } const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
  }
})();

// Липкая панель на телефоне прячется, пока на экране схема "Просвет" или форма записи (там свои кнопки)
(() => {
  const dock = document.querySelector(".dock");
  const zones = [...document.querySelectorAll("[data-dock-hide]")];
  if (!dock || !zones.length || !("IntersectionObserver" in window)) return;
  const seen = new Set();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
    dock.classList.toggle("is-off", seen.size > 0);
  }, { rootMargin: "-20% 0px -20% 0px" });
  zones.forEach((z) => io.observe(z));
})();
