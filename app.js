/* Nile Meridian app layer. Progressive enhancement only: every page works without this file.
   Features: service worker, offline banner, privacy-first page counts, Wire filters + search,
   "new since your last visit", live relative times, share, tracker deep links. No dependencies. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  root.classList.remove("no-js"); root.classList.add("js");
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function $(s, el) { return (el || doc).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); }
  function meta(n) { var m = $('meta[name="' + n + '"]'); return m ? m.content : ""; }

  /* Service worker: network first, cached copy when offline. */
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  /* Offline banner, with the time this copy was built. */
  var net = $("#netstatus");
  function stamp() {
    var g = meta("generated"); if (!g) return "";
    var d = new Date(g);
    return " Showing the copy from " + d.toUTCString().slice(5, 22) + " UTC.";
  }
  function netState() {
    if (!net) return;
    if (navigator.onLine === false) { net.textContent = "You're offline." + stamp(); net.hidden = false; }
    else { net.hidden = true; }
  }
  addEventListener("online", netState); addEventListener("offline", netState); netState();

  /* Privacy-first page counts (GoatCounter pixel): no cookies, no third-party script.
     Skipped when the browser signals Do Not Track or Global Privacy Control. */
  var counter = meta("nm-counter");
  var optOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
  if (counter && !optOut && navigator.onLine !== false && !/^(localhost|127\.|file)/.test(location.hostname || "file")) {
    var img = new Image();
    img.src = counter + "?p=" + encodeURIComponent(location.pathname) + "&t=" + encodeURIComponent(doc.title) +
      "&r=" + encodeURIComponent(doc.referrer) + "&s=" + screen.width + "&rnd=" + Math.random().toString(36).slice(2);
  }

  /* Toast */
  var toastTimer;
  function toast(msg) {
    var t = $(".toast") || doc.body.appendChild(Object.assign(doc.createElement("div"), { className: "toast" }));
    t.setAttribute("role", "status"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* Share buttons: native share sheet where available, otherwise copy the link. */
  doc.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("button.share"); if (!b) return;
    var data = { title: b.getAttribute("data-title"), url: b.getAttribute("data-url") };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(data.url).then(function () { toast("Link copied"); });
  });

  /* Relative times ("12 min ago"); the absolute UTC time stays in the title and as the no-JS text. */
  var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
  function rel() {
    if (!rtf) return;
    var now = Date.now();
    $$("time[data-rel]").forEach(function (t) {
      var d = new Date(t.getAttribute("datetime")), mins = Math.round((d - now) / 60000);
      if (!t.title) t.title = t.textContent;
      if (Math.abs(mins) < 60) t.textContent = mins === 0 ? "just now" : rtf.format(mins, "minute");
      else if (Math.abs(mins) < 1440) t.textContent = rtf.format(Math.round(mins / 60), "hour");
      else t.textContent = rtf.format(Math.round(mins / 1440), "day");
    });
  }
  rel(); setInterval(rel, 60000);

  /* Tracker: open the case named in the URL. */
  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var el = doc.getElementById(id); if (!el) return;
    var d = el.tagName === "DETAILS" ? el : el.querySelector("details"); if (d) d.open = true;
  }
  addEventListener("hashchange", openHash); openHash();

  /* Wire: filters, search, new-since-last-visit. */
  var feed = $(".feed"); if (!feed) return;
  var items = $$("[data-cat]", feed);
  var bar = $(".filters"), status = $("#filter-status"), search = $("#wire-search");
  var state = { cat: "all", lang: "all", q: "" };
  items.forEach(function (el) { el._text = el.textContent.toLowerCase(); });
  function apply() {
    var shown = 0;
    items.forEach(function (el) {
      var ok = (state.cat === "all" || el.getAttribute("data-cat") === state.cat) &&
        (state.lang === "all" || el.getAttribute("data-lang") === state.lang) &&
        (!state.q || el._text.indexOf(state.q) !== -1);
      el.hidden = !ok; if (ok) shown++;
    });
    $$(".band, .stories, .splash", feed).forEach(function (sec) {
      if (sec.matches("[data-cat]")) return;
      sec.hidden = !$$("[data-cat]", sec).some(function (el) { return !el.hidden; });
    });
    var filtered = state.cat !== "all" || state.lang !== "all" || state.q;
    if (status) status.textContent = filtered ? "Showing " + shown + " of " + items.length + " stories" : "";
  }
  if (bar) {
    bar.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-f]"); if (!b) return;
      var group = b.getAttribute("data-f");
      $$('button[data-f="' + group + '"]', bar).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      state[group] = b.getAttribute("data-v"); apply();
    });
  }
  if (search) {
    var timer;
    search.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = search.value.trim().toLowerCase(); apply(); }, 150);
    });
  }

  /* New since your last visit (stored only on this device). */
  var last = parseInt(store.get("nm.wire.lastVisit") || "0", 10), fresh = 0;
  if (last) {
    items.forEach(function (el) {
      var ts = Date.parse(el.getAttribute("data-ts") || "");
      if (ts > last) { el.classList.add("is-new"); fresh++; }
    });
    var pill = $("#since-last");
    if (pill && fresh) { pill.textContent = fresh + " new since your last visit"; pill.hidden = false; }
  }
  function remember() { store.set("nm.wire.lastVisit", String(Date.now())); }
  addEventListener("pagehide", remember);
  doc.addEventListener("visibilitychange", function () { if (doc.visibilityState === "hidden") remember(); });
})();
