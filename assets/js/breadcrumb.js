(function () {
  function normalizePath(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return path.startsWith("/") ? path : "/" + path;
  }

  function ensureTrailingSlash(path) {
    if (!path) return "";
    if (path.includes("?") || path.includes("#")) return path;

    const clean = path.split("#")[0].split("?")[0];
    const lastSegment = clean.split("/").pop() || "";

    if (lastSegment.includes(".")) return path;
    return path.endsWith("/") ? path : path + "/";
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getOrigin() {
    return window.location.origin || "";
  }

  function absoluteUrl(url) {
    const u = normalizePath(url);
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    return getOrigin() + u;
  }

  function defaultHome() {
    return { name: "Home", url: "/" };
  }

  function buildCrumbs(config) {
    const crumbs = [];
    const home = config && config.home ? config.home : defaultHome();

    crumbs.push({
      name: home.name || "Home",
      url: home.url || "/"
    });

    const categoryName = config && config.categoryName ? String(config.categoryName).trim() : "";
    const categoryUrl = config && config.categoryUrl ? String(config.categoryUrl).trim() : "";
    const toolName = config && config.toolName ? String(config.toolName).trim() : "";
    const toolUrl = config && config.toolUrl ? String(config.toolUrl).trim() : "";

    if (categoryName) {
      crumbs.push({
        name: categoryName,
        url: categoryUrl || ""
      });
    }

    if (toolName) {
      crumbs.push({
        name: toolName,
        url: toolUrl || ""
      });
    }

    const cleaned = [];
    const seen = new Set();

    for (const c of crumbs) {
      const name = c && c.name ? String(c.name).trim() : "";
      if (!name) continue;

      const url = c && c.url ? String(c.url).trim() : "";
      const normUrl = url ? ensureTrailingSlash(normalizePath(url)) : "";
      const key = name + "|" + normUrl;

      if (seen.has(key)) continue;
      seen.add(key);

      cleaned.push({ name, url: normUrl });
    }

    return cleaned;
  }

  function renderHtml(crumbs) {
    const items = crumbs
      .map(function (c, idx) {
        const isLast = idx === crumbs.length - 1;
        const name = escapeHtml(c.name);

        if (!isLast && c.url) {
          const href = escapeHtml(c.url);
          return (
            '<li class="bc__item">' +
              '<a class="bc__link" href="' + href + '">' + name + "</a>" +
              '<span class="bc__sep" aria-hidden="true">&gt;</span>' +
            "</li>"
          );
        }

        if (!isLast && !c.url) {
          return (
            '<li class="bc__item">' +
              '<span class="bc__text">' + name + "</span>" +
              '<span class="bc__sep" aria-hidden="true">&gt;</span>' +
            "</li>"
          );
        }

        return (
          '<li class="bc__item bc__item--current" aria-current="page">' +
            '<span class="bc__current">' + name + "</span>" +
          "</li>"
        );
      })
      .join("");

    return (
      '<nav class="bc" aria-label="breadcrumb">' +
        '<ol class="bc__list">' + items + "</ol>" +
      "</nav>"
    );
  }

  function renderJsonLd(crumbs, explicitBaseUrl) {
    const baseUrl =
      explicitBaseUrl && String(explicitBaseUrl).trim()
        ? String(explicitBaseUrl).trim()
        : getOrigin();

    const itemListElement = [];

    for (let i = 0; i < crumbs.length; i++) {
      const c = crumbs[i];
      const position = i + 1;

      let itemUrl = "";
      if (c.url) {
        if (c.url.startsWith("http://") || c.url.startsWith("https://")) {
          itemUrl = c.url;
        } else if (baseUrl) {
          itemUrl = baseUrl + c.url;
        } else {
          itemUrl = c.url;
        }
      } else {
        itemUrl = absoluteUrl(window.location.pathname || "/");
      }

      itemListElement.push({
        "@type": "ListItem",
        position: position,
        name: c.name,
        item: itemUrl
      });
    }

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: itemListElement
    };
  }

  function upsertJsonLd(id, json) {
    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      head.appendChild(el);
    }
    el.textContent = JSON.stringify(json);
  }

  function renderInto(container, config) {
    const crumbs = buildCrumbs(config || {});
    if (!crumbs.length) return;

    container.innerHTML = renderHtml(crumbs);

    const jsonLd = renderJsonLd(
      crumbs,
      config && config.baseUrl ? config.baseUrl : ""
    );

    upsertJsonLd("breadcrumb-jsonld", jsonLd);
  }

  window.Breadcrumb = {
    render: function (options) {
      const config =
        options && options.config
          ? options.config
          : window.__BREADCRUMB__ || {};

      const selector =
        options && options.selector ? options.selector : ".breadcrumb";

      const container = document.querySelector(selector);
      if (!container) return;

      renderInto(container, config);
    }
  };
})();