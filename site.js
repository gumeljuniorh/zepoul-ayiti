(function () {
  function emit(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  }

  window.trackEvent = emit;

  function bindMenu() {
    var items = [];

    function closeItem(item) {
      item.menu.classList.remove("open");
      item.btn.setAttribute("aria-expanded", "false");
    }

    function closeAll(exceptMenu) {
      items.forEach(function (item) {
        if (!exceptMenu || item.menu !== exceptMenu) {
          closeItem(item);
        }
      });
    }

    document.querySelectorAll("[data-menu-target]").forEach(function (btn) {
      var targetId = btn.getAttribute("data-menu-target");
      var menu = targetId ? document.getElementById(targetId) : null;
      if (!menu) return;

      var item = { btn: btn, menu: menu };
      items.push(item);

      btn.addEventListener("click", function (evt) {
        evt.preventDefault();
        var willOpen = !menu.classList.contains("open");
        closeAll(menu);

        if (willOpen) {
          menu.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        } else {
          closeItem(item);
        }
      });

      menu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          closeItem(item);
        });
      });
    });

    if (!items.length) return;

    document.addEventListener("click", function (evt) {
      items.forEach(function (item) {
        if (!item.menu.classList.contains("open")) return;
        if (item.menu.contains(evt.target) || item.btn.contains(evt.target)) return;
        closeItem(item);
      });
    });

    document.addEventListener("keydown", function (evt) {
      if (evt.key === "Escape") closeAll();
    });
  }

  function bindTracking() {
    var page = document.body.getAttribute("data-page") || "unknown";

    document.querySelectorAll("a[href*='wa.me']").forEach(function (link) {
      link.addEventListener("click", function () {
        emit("whatsapp_click", { page: page });
      });
    });

    document.querySelectorAll("a[href^='mailto:']").forEach(function (link) {
      link.addEventListener("click", function () {
        emit("email_click", { page: page });
      });
    });

    document.querySelectorAll("a[href^='tel:']").forEach(function (link) {
      link.addEventListener("click", function () {
        emit("phone_click", { page: page });
      });
    });

    document.querySelectorAll(".social-icons a").forEach(function (link) {
      link.addEventListener("click", function () {
        emit("social_click", { page: page, target: link.href });
      });
    });
  }

  function bindImageFallbacks() {
    var images = document.querySelectorAll("img[data-fallback]");
    if (!images.length) return;

    images.forEach(function (img) {
      img.addEventListener("error", function () {
        var fallback = img.getAttribute("data-fallback");
        if (!fallback) return;
        if (img.src.indexOf(fallback) !== -1) return;
        img.src = fallback;
      });
    });
  }

  function bindQuoteForm() {
    var form = document.getElementById("quote-form");
    if (!form) return;

    var QUOTE_ENDPOINT = "https://formsubmit.co/ajax/info@zepoulayiti.com";
    var QUOTE_DB_ENDPOINT = "https://script.google.com/macros/s/AKfycbydmYHgSLQj2LqKALpi2xYdNmckkOOuEANyI0ONIsGJ7H2cmM_6Wmtzeobmt7tAJ7Jk/exec";
    var SHEET_QUEUE_KEY = "zepoul_pending_sheet_leads_v1";
    var SHEET_SYNC_INTERVAL_MS = 60 * 60 * 1000;

    function setFormStatus(message, success) {
      var statusEl = document.getElementById("form-status");
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = success ? "var(--primary)" : "#b42318";
    }

    function readSheetQueue() {
      try {
        var raw = window.localStorage.getItem(SHEET_QUEUE_KEY);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }

    function writeSheetQueue(queue) {
      try {
        window.localStorage.setItem(SHEET_QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
      } catch (err) {
        // Ignore storage errors (private mode / quota exceeded)
      }
    }

    function queueLeadForRetry(payload) {
      var queue = readSheetQueue();
      var ref = payload && payload.reference_demande ? String(payload.reference_demande) : "";
      var alreadyQueued = ref && queue.some(function (item) {
        return item && item.reference_demande === ref;
      });
      if (alreadyQueued) return;

      var queuedPayload = Object.assign({}, payload || {}, {
        queued_at: new Date().toISOString()
      });
      queue.push(queuedPayload);
      writeSheetQueue(queue);
    }

    function buildRequestReference() {
      var now = new Date();
      var stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
      var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      return "ZP-" + stamp + "-" + rand;
    }

    function withTimeout(promise, timeoutMs) {
      return Promise.race([
        promise,
        new Promise(function (_, reject) {
          window.setTimeout(function () {
            reject(new Error("timeout"));
          }, timeoutMs);
        })
      ]);
    }

    function openMailtoFallback(institution, volume, email, details, requestRef) {
      var subject = "Demande de cotation - Zepoul Ayiti";
      var bodyLines = [
        "Bonjour Zepoul Ayiti,",
        "",
        requestRef ? "Référence: " + requestRef : "",
        "Institution: " + institution,
        "Volume hebdomadaire (cartons): " + volume,
        "Email de contact: " + email,
        details ? "Details: " + details : "",
        "",
        "Merci."
      ].filter(Boolean);

      window.location.href = "mailto:info@zepoulayiti.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(bodyLines.join("\n"));
    }

    function sendLeadToSheet(payload) {
      if (!QUOTE_DB_ENDPOINT) {
        return Promise.resolve({ ok: false, channel: "disabled" });
      }

      var params = new URLSearchParams();
      Object.keys(payload || {}).forEach(function (key) {
        var value = payload[key];
        if (value === undefined || value === null) return;
        params.append(key, String(value));
      });

      return withTimeout(fetch(QUOTE_DB_ENDPOINT, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: params.toString()
      }), 7000)
        .then(function (response) {
          if (!response || !response.ok) throw new Error("sheet-cors-failed");
          return { ok: true, channel: "cors" };
        })
        .catch(function () {
          try {
            if (navigator.sendBeacon) {
              var blob = new Blob([params.toString()], { type: "application/x-www-form-urlencoded" });
              var queued = navigator.sendBeacon(QUOTE_DB_ENDPOINT, blob);
              if (queued) return { ok: true, channel: "beacon" };
            }
          } catch (err) {
            // Ignore and fallback
          }

          return withTimeout(fetch(QUOTE_DB_ENDPOINT, {
            method: "POST",
            mode: "no-cors",
            body: params,
            keepalive: true
          }), 5000)
            .then(function () {
              return { ok: true, channel: "no-cors" };
            })
            .catch(function () {
              return { ok: false, channel: "failed" };
            });
        });
    }

    function flushSheetQueue() {
      var pending = readSheetQueue();
      if (!pending.length) {
        return Promise.resolve({ attempted: 0, sent: 0, failed: 0 });
      }

      var remaining = [];
      var sent = 0;

      return pending.reduce(function (chain, item) {
        return chain.then(function () {
          return sendLeadToSheet(item).then(function (result) {
            if (result && result.ok) {
              sent += 1;
            } else {
              remaining.push(item);
            }
          }).catch(function () {
            remaining.push(item);
          });
        });
      }, Promise.resolve()).then(function () {
        writeSheetQueue(remaining);
        return {
          attempted: pending.length,
          sent: sent,
          failed: remaining.length
        };
      });
    }

    function scheduleSheetSync() {
      // First retry immediately on page load.
      flushSheetQueue().then(function (stats) {
        if (stats.attempted > 0) {
          emit("quote_sheet_retry", {
            attempted: stats.attempted,
            sent: stats.sent,
            failed: stats.failed,
            mode: "initial"
          });
        }
      });

      // Retry unsent leads every hour while the site is open.
      window.setInterval(function () {
        flushSheetQueue().then(function (stats) {
          if (stats.attempted > 0) {
            emit("quote_sheet_retry", {
              attempted: stats.attempted,
              sent: stats.sent,
              failed: stats.failed,
              mode: "hourly"
            });
          }
        });
      }, SHEET_SYNC_INTERVAL_MS);

      // Retry once when connectivity returns.
      window.addEventListener("online", function () {
        flushSheetQueue().then(function (stats) {
          if (stats.attempted > 0) {
            emit("quote_sheet_retry", {
              attempted: stats.attempted,
              sent: stats.sent,
              failed: stats.failed,
              mode: "online"
            });
          }
        });
      });
    }

    scheduleSheetSync();

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector("button[type='submit']");
      var institution = document.getElementById("inst").value.trim();
      var volume = document.getElementById("vol").value.trim();
      var email = document.getElementById("email").value.trim();
      var details = document.getElementById("details").value.trim();
      var requestRef = buildRequestReference();
      var referenceInput = document.getElementById("reference_demande");

      if (referenceInput) referenceInput.value = requestRef;

      if (!institution || !volume || Number(volume) <= 0 || !email) {
        setFormStatus("Veuillez renseigner une institution, un volume valide et un e-mail.", false);
        return;
      }

      var payload = {
        institution: institution,
        volume: volume,
        volume_hebdomadaire_cartons: volume,
        email: email,
        details: details,
        reference_demande: requestRef,
        _replyto: email,
        _subject: "Nouvelle demande de cotation - Zepoul Ayiti",
        _captcha: "false"
      };

      var sheetPayload = {
        institution: institution,
        volume: volume,
        email: email,
        details: details,
        reference_demande: requestRef,
        source: "site-quote-fr",
        page: window.location.pathname,
        submitted_at: new Date().toISOString()
      };

      var sheetPromise = sendLeadToSheet(sheetPayload).then(function (result) {
        if (!result || !result.ok) {
          queueLeadForRetry(sheetPayload);
          return { ok: false, channel: result && result.channel ? result.channel : "failed" };
        }
        return result;
      }).catch(function () {
        queueLeadForRetry(sheetPayload);
        return { ok: false, channel: "failed" };
      });

      setFormStatus("Traitement de la demande en cours... Référence : " + requestRef + ".", true);
      if (submitBtn) submitBtn.disabled = true;

      fetch(QUOTE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Form endpoint error");
          emit("quote_form_submit", { institution: institution, volume: volume, channel: "server_form", reference: requestRef });
          sheetPromise.then(function (sheetResult) {
            emit("quote_sheet_capture", {
              reference: requestRef,
              status: sheetResult && sheetResult.ok ? "ok" : "failed",
              channel: sheetResult && sheetResult.channel ? sheetResult.channel : "unknown"
            });
          });
          setFormStatus("Demande envoyée avec succès. Référence : " + requestRef + ". Redirection en cours...", true);
          form.reset();
          window.setTimeout(function () {
            window.location.href = "merci.html?source=quote&ref=" + encodeURIComponent(requestRef);
          }, 500);
        })
        .catch(function () {
          emit("quote_form_fallback_mailto", { institution: institution, volume: volume, reference: requestRef });
          setFormStatus("Envoi direct indisponible. Référence : " + requestRef + ". Ouverture de votre e-mail en secours...", false);
          openMailtoFallback(institution, volume, email, details, requestRef);
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  function bindStockAvailability() {
    var panel = document.querySelector("[data-stock-endpoint]");
    if (!panel) return;

    var endpoint = (panel.getAttribute("data-stock-endpoint") || "").trim();
    var fallbackEndpoint = (panel.getAttribute("data-stock-fallback-endpoint") || "").trim();
    var sheetId = (panel.getAttribute("data-stock-sheet-id") || "").trim();
    var sheetGid = (panel.getAttribute("data-stock-sheet-gid") || "0").trim();

    if (!endpoint && sheetId) {
      endpoint = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) + "/gviz/tq?gid=" + encodeURIComponent(sheetGid) + "&tqx=out:json";
    }
    if (!endpoint && !fallbackEndpoint && !sheetId) return;

    var cartonsEl = panel.querySelector("[data-stock-cartons]");
    var updatedEl = panel.querySelector("[data-stock-updated]");
    var statusEl = panel.querySelector("[data-stock-status]");
    if (!cartonsEl || !updatedEl || !statusEl) return;

    var refreshMs = Number(panel.getAttribute("data-stock-refresh-ms"));
    var syncInProgress = false;

    if (!Number.isFinite(refreshMs) || refreshMs < 60000) {
      refreshMs = 60 * 60 * 1000;
    }

    function firstDefined(source, keys) {
      if (!source || typeof source !== "object" || !Array.isArray(keys)) return "";
      for (var i = 0; i < keys.length; i += 1) {
        var value = source[keys[i]];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          return value;
        }
      }
      return "";
    }

    function parseCartons(value) {
      if (value === undefined || value === null) return null;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      var text = String(value).trim();
      if (!text) return null;

      var numeric = text.replace(",", ".").match(/-?\d+(\.\d+)?/);
      if (!numeric) return null;

      var parsed = Number(numeric[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function parseGvizDateExpression(value) {
      if (value === undefined || value === null) return "";
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
      }
      var text = String(value).trim();
      var match = text.match(/^Date\(([^)]+)\)$/);
      if (!match) return "";

      var parts = match[1].split(",").map(function (part) {
        return Number(String(part).trim());
      });
      if (parts.length < 3 || parts.some(function (part) { return !Number.isFinite(part); })) {
        return "";
      }

      var date = new Date(
        parts[0],
        parts[1],
        parts[2] || 1,
        parts[3] || 0,
        parts[4] || 0,
        parts[5] || 0
      );
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    }

    function formatCartons(value) {
      var parsed = parseCartons(value);
      if (parsed === null) return "-- cartons";
      return Math.round(parsed) + " cartons";
    }

    function formatUpdated(value) {
      if (!value) return "Mise à jour non disponible";
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat("fr-FR", {
        year: "numeric",
        month: "long",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    }

    function isAuthOrHtmlResponse(text) {
      if (!text) return false;
      var lowered = String(text).toLowerCase();
      return lowered.indexOf("<!doctype html") !== -1 ||
        lowered.indexOf("<html") !== -1 ||
        lowered.indexOf("sign in to your google account") !== -1 ||
        lowered.indexOf("allow google sheets access to your necessary cookies") !== -1;
    }

    function parseGvizPayload(text) {
      if (!text) return null;
      var gvizMatch = String(text).match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?\s*$/);
      if (!gvizMatch) return null;
      try {
        return JSON.parse(gvizMatch[1]);
      } catch (err) {
        return null;
      }
    }

    function firstNonEmptyGvizRow(rows) {
      if (!Array.isArray(rows)) return null;
      for (var i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        var cells = row && Array.isArray(row.c) ? row.c : [];
        var hasValue = cells.some(function (cell) {
          if (!cell) return false;
          if (cell.v === 0) return true;
          if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== "") return true;
          if (cell.f && String(cell.f).trim() !== "") return true;
          return false;
        });
        if (hasValue) return row;
      }
      return null;
    }

    function snapshotFromGviz(payload) {
      if (!payload || typeof payload !== "object" || !payload.table) return null;
      var table = payload.table;
      var cols = Array.isArray(table.cols) ? table.cols : [];
      var row = firstNonEmptyGvizRow(table.rows);
      if (!row || !Array.isArray(row.c)) return null;

      var snapshot = { cartons: "", updated: "", status: "" };
      var firstNumeric = "";
      var firstDateLike = "";

      row.c.forEach(function (cell, index) {
        var col = cols[index] || {};
        var label = String(col.label || col.id || "").toLowerCase();
        var raw = cell ? cell.v : "";
        var formatted = cell && cell.f !== undefined && cell.f !== null ? cell.f : raw;
        var parsedDate = parseGvizDateExpression(raw) || parseGvizDateExpression(formatted);

        if (!firstNumeric && parseCartons(raw) !== null) firstNumeric = raw;
        if (!firstNumeric && parseCartons(formatted) !== null) firstNumeric = formatted;
        if (!firstDateLike && parsedDate) firstDateLike = parsedDate;

        if (!snapshot.cartons && /(carton|stock|volume|quantit|quantite|qte|qty)/.test(label)) {
          snapshot.cartons = raw !== undefined && raw !== null && String(raw).trim() !== "" ? raw : formatted;
        }
        if (!snapshot.updated && /(mise|update|date|maj|heure|time)/.test(label)) {
          snapshot.updated = parsedDate || formatted;
        }
        if (!snapshot.status && /(statut|status|etat|state|disponibil)/.test(label)) {
          snapshot.status = formatted;
        }
      });

      if (!snapshot.cartons && firstNumeric !== "") snapshot.cartons = firstNumeric;
      if (!snapshot.updated && firstDateLike) snapshot.updated = firstDateLike;
      if (!snapshot.status) snapshot.status = "Disponible";

      return snapshot.cartons || snapshot.updated || snapshot.status ? snapshot : null;
    }

    function snapshotFromCsv(text) {
      if (!text || isAuthOrHtmlResponse(text)) return null;
      var lines = String(text).split(/\r?\n/).filter(function (line) {
        return line.trim() !== "";
      });
      if (lines.length < 2) return null;

      var headerCells = lines[0].split(",").map(function (cell) {
        return cell.trim().toLowerCase();
      });
      var valueCells = lines[1].split(",").map(function (cell) {
        return cell.trim();
      });

      var snapshot = { cartons: "", updated: "", status: "" };
      headerCells.forEach(function (header, index) {
        var value = valueCells[index] || "";
        if (!snapshot.cartons && /(carton|stock|volume|quantit|quantite|qte|qty)/.test(header)) {
          snapshot.cartons = value;
        }
        if (!snapshot.updated && /(mise|update|date|maj|heure|time)/.test(header)) {
          snapshot.updated = value;
        }
        if (!snapshot.status && /(statut|status|etat|state|disponibil)/.test(header)) {
          snapshot.status = value;
        }
      });

      if (!snapshot.cartons) {
        var firstNumber = lines.join(" ").match(/-?\d+([.,]\d+)?/);
        if (firstNumber) snapshot.cartons = firstNumber[0];
      }
      if (!snapshot.status) snapshot.status = "Disponible";

      return snapshot.cartons || snapshot.updated || snapshot.status ? snapshot : null;
    }

    function normalizeSnapshot(payload) {
      if (!payload) return null;

      var raw = payload;
      if (raw && typeof raw === "object" && raw.data && typeof raw.data === "object") {
        raw = raw.data;
      }
      if (Array.isArray(raw)) {
        raw = raw[0] || null;
      }
      if (!raw || typeof raw !== "object") return null;

      var cartons = firstDefined(raw, [
        "cartons",
        "cartons_disponibles",
        "quantite_cartons",
        "quantity_cartons",
        "stock_cartons",
        "stock",
        "volume"
      ]);

      var updated = firstDefined(raw, [
        "updated_at",
        "last_update",
        "mise_a_jour",
        "updated",
        "date"
      ]);

      var status = firstDefined(raw, [
        "status",
        "statut",
        "etat",
        "state"
      ]);

      if (!cartons && !updated && !status) return null;

      return {
        cartons: cartons,
        updated: updated,
        status: status
      };
    }

    function setStatusTone(tone) {
      statusEl.classList.remove("is-warning", "is-error");
      if (tone === "warning") statusEl.classList.add("is-warning");
      if (tone === "error") statusEl.classList.add("is-error");
    }

    function applySnapshot(snapshot, source) {
      if (!snapshot) return;

      cartonsEl.textContent = formatCartons(snapshot.cartons);
      updatedEl.textContent = formatUpdated(snapshot.updated || new Date().toISOString());

      var liveStatus = snapshot.status ? String(snapshot.status) : "Disponible";
      if (source === "cache") {
        statusEl.textContent = "Valeur locale (dernière synchronisation)";
        setStatusTone("warning");
      } else {
        statusEl.textContent = liveStatus;
        setStatusTone("");
      }
    }

    function withTimeout(promise, timeoutMs) {
      return Promise.race([
        promise,
        new Promise(function (_, reject) {
          window.setTimeout(function () {
            reject(new Error("timeout"));
          }, timeoutMs);
        })
      ]);
    }

    function buildFreshEndpoint(url) {
      var joiner = url.indexOf("?") === -1 ? "?" : "&";
      return url + joiner + "_ts=" + Date.now();
    }

    function sheetGvizEndpoint() {
      if (!sheetId) return "";
      return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) + "/gviz/tq?gid=" + encodeURIComponent(sheetGid) + "&tqx=out:json";
    }

    function sheetCsvEndpoint() {
      if (!sheetId) return "";
      return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) + "/export?format=csv&gid=" + encodeURIComponent(sheetGid);
    }

    function parseSnapshotFromText(text) {
      if (!text) return null;
      if (text.indexOf("Script function not found: doGet") !== -1) return null;
      if (isAuthOrHtmlResponse(text)) return null;

      var payload = null;
      try {
        payload = JSON.parse(text);
      } catch (err) {
        // Continue with gviz/csv parsing.
      }

      var snapshot = normalizeSnapshot(payload);
      if (snapshot) return snapshot;

      var gvizPayload = parseGvizPayload(text);
      snapshot = snapshotFromGviz(gvizPayload);
      if (snapshot) return snapshot;

      snapshot = snapshotFromCsv(text);
      if (snapshot) return snapshot;

      var numeric = parseCartons(text);
      if (numeric !== null) {
        return {
          cartons: numeric,
          updated: new Date().toISOString(),
          status: "Disponible"
        };
      }

      return null;
    }

    function buildSourceList() {
      var sources = [];
      if (endpoint) sources.push(buildFreshEndpoint(endpoint));

      var gvizUrl = sheetGvizEndpoint();
      if (gvizUrl && gvizUrl !== endpoint) sources.push(buildFreshEndpoint(gvizUrl));

      var csvUrl = sheetCsvEndpoint();
      if (csvUrl) sources.push(buildFreshEndpoint(csvUrl));

      if (fallbackEndpoint) sources.push(buildFreshEndpoint(fallbackEndpoint));

      return sources.filter(function (url, index, arr) {
        return arr.indexOf(url) === index;
      });
    }

    function fetchFromSource(url) {
      return withTimeout(fetch(url, {
        method: "GET",
        cache: "no-store"
      }), 7000)
        .then(function (response) {
          if (!response || !response.ok) throw new Error("stock-http-failed");
          return response.text();
        })
        .then(function (text) {
          var snapshot = parseSnapshotFromText(text);
          if (!snapshot) throw new Error("stock-payload-invalid");
          return snapshot;
        });
    }

    function fetchStock() {
      if (syncInProgress) return Promise.resolve(false);
      syncInProgress = true;

      statusEl.textContent = "Mise à jour en cours...";
      setStatusTone("");

      var sources = buildSourceList();
      var attempts = sources.map(function (url) {
        return function () { return fetchFromSource(url); };
      });

      var chain = Promise.reject(new Error("stock-no-source"));
      attempts.forEach(function (attempt) {
        chain = chain.catch(function () {
          return attempt();
        });
      });

      return chain
        .then(function (snapshot) {
          applySnapshot(snapshot, "live");
          emit("stock_sync", { status: "ok", source: "live" });
          return true;
        })
        .catch(function () {
          statusEl.textContent = "Disponibilité à confirmer";
          setStatusTone("warning");
          emit("stock_sync", { status: "failed", source: "none" });
          return false;
        })
        .finally(function () {
          syncInProgress = false;
        });
    }

    fetchStock();
    window.setInterval(fetchStock, refreshMs);
    window.addEventListener("pageshow", fetchStock);
    window.addEventListener("online", fetchStock);
  }

  function bindBrandVideo() {
    var brandVideo = document.getElementById("brand-video");
    if (!brandVideo) return;

    brandVideo.muted = true;
    brandVideo.volume = 0;

    brandVideo.addEventListener("volumechange", function () {
      if (!brandVideo.muted || brandVideo.volume !== 0) {
        brandVideo.muted = true;
        brandVideo.volume = 0;
      }
    });

    var trackedPlay = false;
    brandVideo.addEventListener("play", function () {
      if (trackedPlay) return;
      trackedPlay = true;
      emit("brand_video_play", { page: "index", placement: "presentation_section" });
    });
  }

  function trackThankYou() {
    if (document.body.getAttribute("data-page") !== "merci") return;
    var params = new URLSearchParams(window.location.search);
    var source = params.get("source") || "direct";
    var requestRef = params.get("ref") || "";
    var requestRefEl = document.getElementById("request-ref-note");

    if (requestRefEl && requestRef) {
      requestRefEl.textContent = "Référence de suivi : " + requestRef;
      requestRefEl.hidden = false;
    }

    emit("thank_you_view", { page: "merci", source: source, reference: requestRef });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindMenu();
    bindTracking();
    bindImageFallbacks();
    bindQuoteForm();
    bindStockAvailability();
    bindBrandVideo();
    trackThankYou();
  });
})();
