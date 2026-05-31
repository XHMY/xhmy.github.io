/*
 * publications.js
 * ---------------
 * Fetches publications.md, parses its lightweight markdown format into
 * structured records, and renders the publication list — in the SAME ORDER
 * as the file — using the site's existing .publication-item markup/CSS.
 *
 * No external dependencies. Your own name is highlighted by wrapping it in
 * **double asterisks** in the "Authors" field (rendered as
 * <span class="highlighted-author">), matching the hand-written markup.
 *
 * Format (see publications.md for the authored source + docs):
 *   ## Paper Title
 *   - Authors: A✧, **Yifan Zeng**✧, B
 *   - Venue: EMNLP 2025
 *   - Info: 973 (2), 163 | 2024-09        (pieces split on " | ")
 *   - Links: [arXiv](https://...) [Code](https://...)   (optional)
 */
(function () {
  "use strict";

  var KNOWN_FIELDS = {
    author: "authors",
    authors: "authors",
    venue: "venue",
    journal: "venue",
    info: "info",
    link: "links",
    links: "links",
    note: "note",
    year: "year",
    url: "url",
  };

  // --- Inline markdown helpers -------------------------------------------

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Allow only safe URL schemes; everything else collapses to "#".
  function sanitizeUrl(url) {
    var u = String(url).trim();
    if (/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return "https://" + u; // bare domain
    return "#";
  }

  // Render a constrained subset of inline markdown to safe HTML:
  // links [text](url), bold **x** (-> <strong> or a span when boldClass given),
  // italic *x* / _x_. Input is escaped first, so literal HTML is shown verbatim.
  // Emphasis is applied ONLY to non-link text segments, so it can never corrupt
  // generated <a> markup.
  function renderInline(text, boldClass) {
    if (text == null) return "";
    var openB = boldClass ? '<span class="' + boldClass + '">' : "<strong>";
    var closeB = boldClass ? "</span>" : "</strong>";

    function emphasize(s) {
      s = s.replace(/\*\*([^*]+)\*\*/g, openB + "$1" + closeB);
      s = s.replace(/__([^_]+)__/g, openB + "$1" + closeB);
      s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
      s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
      return s;
    }

    var escaped = escapeHtml(text);
    // link url may contain balanced parens, e.g. DOIs like .../S2405-8440(24)08709-7
    var linkRe = /\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)/g;
    var out = "";
    var last = 0;
    var m;
    while ((m = linkRe.exec(escaped)) !== null) {
      out += emphasize(escaped.slice(last, m.index)); // text before the link
      out += '<a href="' + sanitizeUrl(m[2]) + '" target="_blank" rel="noopener">' + m[1] + "</a>";
      last = m.index + m[0].length;
    }
    out += emphasize(escaped.slice(last)); // trailing text
    return out;
  }

  // Extract [label](url) pairs (url may contain balanced parens).
  function parseLinks(value) {
    var links = [];
    var re = /\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)/g;
    var m;
    while ((m = re.exec(value)) !== null) {
      links.push({ label: m[1].trim(), url: sanitizeUrl(m[2].trim()) });
    }
    if (links.length === 0) {
      var t = value.trim();
      if (/^https?:\/\/\S+$/i.test(t)) links.push({ label: "Link", url: sanitizeUrl(t) });
    }
    return links;
  }

  // --- Block parser ------------------------------------------------------

  function stripComments(text) {
    return text.replace(/<!--[\s\S]*?-->/g, "");
  }

  function parsePublications(markdown) {
    var text = stripComments(String(markdown)).replace(/\r\n?/g, "\n");
    var lines = text.split("\n");
    var entries = [];
    var current = null;

    var titleRe = /^\s*##\s+(.+?)\s*#*\s*$/;
    var fieldRe = /^\s*(?:[-*+]\s+)?([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/;

    function flush() {
      if (current && current.title) entries.push(current);
      current = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var t = titleRe.exec(line);
      if (t) {
        flush();
        current = { title: t[1].trim(), authors: "", venue: "", info: [], links: [], note: "", year: "", url: "" };
        continue;
      }
      if (!current) continue;
      var f = fieldRe.exec(line);
      if (!f) continue;
      var key = KNOWN_FIELDS[f[1].trim().toLowerCase()];
      var val = f[2].trim();
      if (!key) continue;
      if (key === "links") {
        current.links = current.links.concat(parseLinks(val));
      } else if (key === "info") {
        current.info = current.info.concat(
          val.split(/\s*\|\s*/).map(function (s) { return s.trim(); }).filter(Boolean)
        );
      } else {
        current[key] = val;
      }
    }
    flush();
    return entries;
  }

  // The paper's primary link, used to make the title clickable. An explicit
  // `URL:` field wins; otherwise it is auto-derived from an arXiv id in Info
  // (arXiv:2509.18575 -> https://arxiv.org/abs/2509.18575). Returns null when
  // there is nothing to link to.
  function primaryUrl(e) {
    if (e.url) {
      var u = sanitizeUrl(e.url.trim());
      return u === "#" ? null : u;
    }
    var hay = (e.info || []).join("  ");
    var m = hay.match(/arxiv:\s*(\d{4}\.\d{4,5})(?:v\d+)?/i);
    if (m) return "https://arxiv.org/abs/" + m[1];
    return null;
  }

  // --- Rendering (matches the site's existing .publication-item markup) --

  function renderEntry(e, idx) {
    var parts = [];
    parts.push('<div class="publication-item" style="--pi:' + (idx || 0) + '">');
    var titleInner = renderInline(e.title);
    var url = primaryUrl(e);
    if (url) {
      titleInner =
        '<a class="publication-title-link" href="' + escapeHtml(url) +
        '" target="_blank" rel="noopener">' + titleInner + "</a>";
    }
    parts.push('<h3 class="publication-title">' + titleInner + "</h3>");
    if (e.authors) parts.push('<div class="publication-authors">' + renderInline(e.authors, "highlighted-author") + "</div>");

    var pieces = [];
    if (e.venue) pieces.push('<span class="publication-venue">' + renderInline(e.venue) + "</span>");
    e.info.forEach(function (d) {
      pieces.push('<span class="publication-date">' + renderInline(d) + "</span>");
    });
    if (pieces.length) {
      parts.push('<div class="publication-info">' + pieces.join('<span class="publication-separator">•</span>') + "</div>");
    }

    if (e.note) parts.push('<div class="publication-note">' + renderInline(e.note) + "</div>");

    if (e.links.length) {
      var links = e.links
        .map(function (l) {
          return '<a class="publication-link" href="' + escapeHtml(l.url) + '" target="_blank" rel="noopener">' + escapeHtml(l.label) + "</a>";
        })
        .join("");
      parts.push('<div class="publication-links">' + links + "</div>");
    }

    parts.push("</div>");
    return parts.join("");
  }

  function renderList(entries) {
    var items = entries.map(renderEntry).join("");
    return '<div class="publications-container">' + items + "</div>";
  }

  // --- Timeline (group by year) ------------------------------------------

  // Derive a paper's year from the "completion date of the initial version":
  // an explicit `Year:` field wins, then the arXiv id (YYMM -> 20YY), then a
  // YYYY-MM date in Info, then any bare year in Info, then the venue year.
  // Returns a number, or null when nothing can be parsed.
  function deriveYear(e) {
    if (e.year) {
      var ey = String(e.year).match(/(?:19|20)\d{2}/);
      if (ey) return parseInt(ey[0], 10);
    }
    var hay = (e.info || []).join("  ");
    var m = hay.match(/arxiv:\s*(\d{2})\d{2}/i); // arXiv:YYMM.xxxxx -> 20YY
    if (m) return 2000 + parseInt(m[1], 10);
    m = hay.match(/\b(20\d{2})[-/.]\d{1,2}\b/); // 2024-09
    if (m) return parseInt(m[1], 10);
    m = hay.match(/\b(?:19|20)\d{2}\b/); // a bare year somewhere in Info
    if (m) return parseInt(m[0], 10);
    if (e.venue) {
      m = e.venue.match(/\b(20\d{2})\b/); // fall back to the venue year
      if (m) return parseInt(m[1], 10);
    }
    return null;
  }

  // Group entries by derived year (file order preserved within a year), then
  // order the groups newest-first; undated entries go last.
  function groupByYear(entries) {
    var map = {};
    var order = [];
    entries.forEach(function (e) {
      var y = deriveYear(e);
      var key = y == null ? "other" : String(y);
      if (!map[key]) {
        map[key] = { year: y, items: [] };
        order.push(key);
      }
      map[key].items.push(e);
    });
    var groups = order.map(function (k) { return map[k]; });
    groups.sort(function (a, b) {
      if (a.year == null) return 1;
      if (b.year == null) return -1;
      return b.year - a.year;
    });
    return groups;
  }

  function renderTimeline(entries) {
    var groups = groupByYear(entries);
    var gi = 0; // global index -> drives the staggered fade-in across the list
    var out = '<div class="publications-container pub-timeline">';
    groups.forEach(function (g) {
      out += '<div class="pub-year-group">';
      out += '<div class="pub-year-marker">';
      if (g.year != null) out += '<span class="pub-year">' + g.year + "</span>";
      out += "</div>";
      out += '<div class="pub-year-items">';
      g.items.forEach(function (e) {
        out += renderEntry(e, gi++);
      });
      out += "</div></div>";
    });
    out += "</div>";
    return out;
  }

  function renderInto(container, markdown) {
    var entries = parsePublications(markdown);
    if (!entries.length) {
      container.innerHTML = '<p class="publications-empty">No publications found.</p>';
      return 0;
    }
    container.innerHTML = renderTimeline(entries);
    container.classList.add("is-ready");
    return entries.length;
  }

  // --- DOM bootstrap (browser only) --------------------------------------

  function init() {
    var container = document.getElementById("publications");
    if (!container) return;
    var src = container.getAttribute("data-src") || "publications.md";
    fetch(src, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (md) {
        renderInto(container, md);
      })
      .catch(function (err) {
        container.innerHTML =
          '<p class="publications-empty">Could not load publications. ' +
          'See <a href="' + escapeHtml(src) + '">the source list</a>.</p>';
        if (window.console) console.error("publications.js:", err);
      });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  // Node export for unit testing.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      escapeHtml: escapeHtml,
      sanitizeUrl: sanitizeUrl,
      renderInline: renderInline,
      parseLinks: parseLinks,
      stripComments: stripComments,
      parsePublications: parsePublications,
      renderEntry: renderEntry,
      renderList: renderList,
      primaryUrl: primaryUrl,
      deriveYear: deriveYear,
      groupByYear: groupByYear,
      renderTimeline: renderTimeline,
    };
  }
})();
