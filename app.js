(() => {
  const STORAGE_KEY = "waija-docs-overrides-v1";
  const state = {
    pageId: "getting-started",
    editing: false,
    data: structuredClone(window.DOCS_DEFAULT)
  };
  const $ = (sel) => document.querySelector(sel);
  function loadOverrides() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const ov = JSON.parse(raw);
      if (ov && ov.pages) {
        for (const [id, page] of Object.entries(ov.pages)) {
          if (state.data.pages[id]) state.data.pages[id] = { ...state.data.pages[id], ...page };
          else state.data.pages[id] = page;
        }
      }
    } catch (_) {}
  }
  function saveOverrides() {
    const defaults = window.DOCS_DEFAULT.pages;
    const pages = {};
    for (const [id, page] of Object.entries(state.data.pages)) {
      const base = defaults[id];
      if (!base || base.title !== page.title || base.lede !== page.lede || base.body !== page.body || base.crumb !== page.crumb) {
        pages[id] = page;
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pages }));
  }
  function slugify(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
  }
  function inline(s) {
    let out = escapeHtml(s);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      if (href.startsWith("#")) return `<a href="${href}" data-page="${href.slice(1)}">${label}</a>`;
      return `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
    });
    return out;
  }
  function renderMarkdown(src) {
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let i = 0;
    let inList = null;
    const closeList = () => { if (inList) { html += inList === "ol" ? "</ol>" : "</ul>"; inList = null; } };
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("```")) {
        closeList();
        const lang = line.slice(3).trim();
        const buf = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i += 1; }
        html += `<pre data-lang="${escapeHtml(lang)}"><button class="copy-btn" type="button">Copy</button><code>${escapeHtml(buf.join("\n"))}</code></pre>`;
        i += 1; continue;
      }
      if (line.trim() === "!!!") {
        closeList();
        const buf = [];
        i += 1;
        while (i < lines.length && lines[i].trim() !== "!!!") { buf.push(lines[i]); i += 1; }
        html += `<div class="callout">${renderMarkdown(buf.join("\n"))}</div>`;
        i += 1; continue;
      }
      if (line.startsWith("> ")) {
        closeList();
        const buf = [line.slice(2)];
        i += 1;
        while (i < lines.length && lines[i].startsWith("> ")) { buf.push(lines[i].slice(2)); i += 1; }
        html += `<div class="callout">${buf.map((b) => `<p>${inline(b)}</p>`).join("")}</div>`;
        continue;
      }
      if (line.startsWith("| ")) {
        closeList();
        const rows = [];
        while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i += 1; }
        const parseRow = (r) => r.split("|").slice(1, -1).map((c) => c.trim());
        const head = parseRow(rows[0]);
        const bodyRows = rows.slice(2).map(parseRow);
        html += `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${bodyRows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        continue;
      }
      const ol = line.match(/^(\d+)\.\s+(.*)$/);
      const ul = line.match(/^[-*]\s+(.*)$/);
      if (ol || ul) {
        const kind = ol ? "ol" : "ul";
        if (inList !== kind) { closeList(); html += kind === "ol" ? `<ol class="step-list">` : "<ul>"; inList = kind; }
        const text = ol ? ol[2] : ul[1];
        html += kind === "ol" ? `<li><span class="step-num">${ol[1]}</span><div>${inline(text)}</div></li>` : `<li>${inline(text)}</li>`;
        i += 1; continue;
      }
      if (/^### /.test(line)) { closeList(); html += `<h3 id="${slugify(line.slice(4))}">${inline(line.slice(4))}</h3>`; i += 1; continue; }
      if (/^## /.test(line)) { closeList(); html += `<h2 id="${slugify(line.slice(3))}">${inline(line.slice(3))}</h2>`; i += 1; continue; }
      if (/^# /.test(line)) { closeList(); html += `<h1 id="${slugify(line.slice(2))}">${inline(line.slice(2))}</h1>`; i += 1; continue; }
      if (!line.trim()) { closeList(); i += 1; continue; }
      closeList();
      html += `<p>${inline(line)}</p>`;
      i += 1;
    }
    closeList();
    return html;
  }
  function headingsFrom(md) {
    return (md.match(/^#{2,3} .+$/gm) || []).map((h) => {
      const level = h.startsWith("###") ? 3 : 2;
      const text = h.replace(/^#{2,3} /,
 "");
      return { level, text, id: slugify(text) };
    });
  }
  function renderNav() {
    $("#sidebar-nav").innerHTML = state.data.nav.map((group) => `
      <div class="nav-group">
        <div class="nav-label">${escapeHtml(group.group)}</div>
        ${group.items.map((item) => `<button class="nav-item ${item.id === state.pageId ? "active" : ""}" data-page="${item.id}">${escapeHtml(item.title)}</button>`).join("")}
      </div>`).join("");
  }
  function currentPage() {
    return state.data.pages[state.pageId] || { title: "Missing page", lede: "", body: "_This page does not exist._", crumb: "" };
  }
  function isEdited(id) {
    const a = window.DOCS_DEFAULT.pages[id];
    const b = state.data.pages[id];
    if (!a || !b) return !!b;
    return a.title !== b.title || a.lede !== b.lede || a.body !== b.body;
  }
  function renderPage() {
    const page = currentPage();
    $("#crumb").textContent = page.crumb || "Documentation";
    $("#page-title").innerHTML = inline(page.title);
    $("#lede").innerHTML = inline(page.lede || "");
    $("#doc").innerHTML = renderMarkdown(page.body || "");
    $("#editor-title").value = page.title;
    $("#editor-lede").value = page.lede || "";
    $("#editor-body").value = page.body || "";
    $("#edited-badge").style.display = isEdited(state.pageId) ? "inline-flex" : "none";
    $("#editor").classList.toggle("open", state.editing);
    $("#edit-toggle").textContent = state.editing ? "Close editor" : "Edit this page";
    const toc = headingsFrom(page.body || "");
    $("#toc-list").innerHTML = toc.length
      ? toc.map((h) => `<a href="#${h.id}" style="padding-left:${h.level === 3 ? 12 : 0}px">${escapeHtml(h.text)}</a>`).join("")
      : `<span style="color:var(--color-faint);font-size:13px">No sections</span>`;
    document.title = `${page.title.replace(/`/g, "")} – Waija Casino API`;
    renderNav();
    history.replaceState(null, "", `#${state.pageId}`);
  }
  function go(id) {
    if (!state.data.pages[id] && !window.DOCS_DEFAULT.pages[id]) return;
    state.pageId = id;
    state.editing = false;
    renderPage();
    window.scrollTo({ top: 0, behavior: "instant" });
    $("#sidebar").classList.remove("open");
  }
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const hits = [];
    for (const [id, page] of Object.entries(state.data.pages)) {
      const hay = `${page.title}\n${page.lede}\n${page.body}`.toLowerCase();
      if (hay.includes(q)) {
        const idx = hay.indexOf(q);
        const snippet = `${page.title}\n${page.lede}\n${page.body}`.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, " ");
        hits.push({ id, title: page.title.replace(/`/g, ""), snippet });
      }
    }
    return hits.slice(0, 12);
  }
  function bind() {
    document.body.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-page]");
      if (nav) { e.preventDefault(); go(nav.getAttribute("data-page")); return; }
      const copy = e.target.closest(".copy-btn");
      if (copy) {
        const code = copy.parentElement.querySelector("code")?.innerText || "";
        navigator.clipboard.writeText(code).then(() => {
          copy.textContent = "Copied";
          setTimeout(() => { copy.textContent = "Copy"; }, 1200);
        });
      }
    });
    $("#edit-toggle").addEventListener("click", () => {
      state.editing = !state.editing;
      renderPage();
      if (state.editing) $("#editor-body").focus();
    });
    $("#save-page").addEventListener("click", () => {
      const page = currentPage();
      page.title = $("#editor-title").value;
      page.lede = $("#editor-lede").value;
      page.body = $("#editor-body").value;
      saveOverrides();
      state.editing = false;
      renderPage();
    });
    $("#reset-page").addEventListener("click", () => {
      const base = window.DOCS_DEFAULT.pages[state.pageId];
      if (base) state.data.pages[state.pageId] = { ...base };
      saveOverrides();
      renderPage();
    });
    $("#export-json").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "waija-docs.json";
      a.click();
    });
    $("#import-json").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (parsed.pages) {
            state.data = { ...window.DOCS_DEFAULT, ...parsed, nav: parsed.nav || window.DOCS_DEFAULT.nav, pages: { ...window.DOCS_DEFAULT.pages, ...parsed.pages } };
            saveOverrides();
            renderPage();
          }
        } catch (err) { alert("Could not import that JSON file."); }
      };
      reader.readAsText(file);
    });
    const input = $("#search");
    const results = $("#search-results");
    input.addEventListener("input", () => {
      const hits = search(input.value);
      results.classList.toggle("open", hits.length > 0);
      results.innerHTML = hits.map((h) => `<button class="search-hit" data-page="${h.id}">${escapeHtml(h.title)}<small>${escapeHtml(h.snippet)}</small></button>`).join("");
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { results.classList.remove("open"); input.blur(); }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); input.focus(); input.select();
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrap")) results.classList.remove("open");
    });
    $("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  }
  loadOverrides();
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (hash && state.data.pages[hash]) state.pageId = hash;
  bind();
  renderPage();
})();
