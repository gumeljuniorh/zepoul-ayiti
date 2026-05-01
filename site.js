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
    bindBrandVideo();
    trackThankYou();
  });
})();
