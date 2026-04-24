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
    var QUOTE_QUEUE_KEY = "zepoulQuoteQueue";

    function setFormStatus(message, success) {
      var statusEl = document.getElementById("form-status");
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = success ? "var(--primary)" : "#b42318";
    }

    function getBackupNote() {
      return document.getElementById("form-backup-note");
    }

    function getQueuedLeads() {
      try {
        var raw = window.localStorage.getItem(QUOTE_QUEUE_KEY);
        var parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }

    function setQueuedLeads(items) {
      try {
        if (!items || !items.length) {
          window.localStorage.removeItem(QUOTE_QUEUE_KEY);
          return;
        }
        window.localStorage.setItem(QUOTE_QUEUE_KEY, JSON.stringify(items));
      } catch (err) {
        // Ignore storage issues on restricted browsers.
      }
    }

    function queueLead(payload) {
      var queue = getQueuedLeads();
      queue.push({ payload: payload, savedAt: new Date().toISOString() });
      setQueuedLeads(queue);
      var backupNote = getBackupNote();
      if (backupNote) backupNote.hidden = false;
    }

    function clearQueuedLead(payload) {
      var queue = getQueuedLeads().filter(function (item) {
        return JSON.stringify(item.payload) !== JSON.stringify(payload);
      });
      setQueuedLeads(queue);
      var backupNote = getBackupNote();
      if (backupNote && !queue.length) backupNote.hidden = true;
    }

    function postToSheet(payload) {
      var params = new URLSearchParams();
      Object.keys(payload || {}).forEach(function (key) {
        var value = payload[key];
        if (value === undefined || value === null) return;
        params.append(key, String(value));
      });

      return fetch(QUOTE_DB_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: params,
        keepalive: true
      });
    }

    function flushQueuedLeads() {
      var queue = getQueuedLeads();
      if (!queue.length) return;

      queue.forEach(function (item) {
        postToSheet(item.payload)
          .then(function () {
            clearQueuedLead(item.payload);
          })
          .catch(function () {
            // Keep queued for another attempt on next page load.
          });
      });
    }

    window.flushQueuedLeads = flushQueuedLeads;
    flushQueuedLeads();

    function openMailtoFallback(institution, volume, email, details) {
      var subject = "Demande de cotation - Zepoul Ayiti";
      var bodyLines = [
        "Bonjour Zepoul Ayiti,",
        "",
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
      if (!QUOTE_DB_ENDPOINT) return Promise.resolve();

      queueLead(payload);

      try {
        if (navigator.sendBeacon) {
          var params = new URLSearchParams();
          Object.keys(payload || {}).forEach(function (key) {
            var value = payload[key];
            if (value === undefined || value === null) return;
            params.append(key, String(value));
          });
          var blob = new Blob([params.toString()], { type: "application/x-www-form-urlencoded" });
          navigator.sendBeacon(QUOTE_DB_ENDPOINT, blob);
        }
      } catch (err) {
        // Ignore and continue with fetch-based attempt.
      }

      return postToSheet(payload)
        .then(function () {
          clearQueuedLead(payload);
        })
        .catch(function () {
          // Keep queued locally for retry on next load.
        });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector("button[type='submit']");
      var institution = document.getElementById("inst").value.trim();
      var volume = document.getElementById("vol").value.trim();
      var email = document.getElementById("email").value.trim();
      var details = document.getElementById("details").value.trim();

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
        _replyto: email,
        _subject: "Nouvelle demande de cotation - Zepoul Ayiti",
        _captcha: "false"
      };

      var leadPayload = {
        institution: institution,
        volume: volume,
        email: email,
        details: details,
        source: "site-quote"
      };

      sendLeadToSheet(leadPayload);

      setFormStatus("Envoi en cours...", true);
      if (submitBtn) submitBtn.disabled = true;

      var requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      };

      var timeoutId;
      if (typeof AbortController !== "undefined") {
        var controller = new AbortController();
        requestOptions.signal = controller.signal;
        timeoutId = window.setTimeout(function () {
          controller.abort();
        }, 12000);
      }

      fetch(QUOTE_ENDPOINT, requestOptions)
        .then(function (response) {
          if (!response.ok) throw new Error("Form endpoint error");
          emit("quote_form_submit", { institution: institution, volume: volume, channel: "server_form" });
          setFormStatus("Demande envoyée avec succès. Redirection en cours...", true);
          form.reset();
          window.setTimeout(function () {
            window.location.href = "merci.html?source=quote";
          }, 500);
        })
        .catch(function () {
          emit("quote_form_fallback_mailto", { institution: institution, volume: volume });
          setFormStatus("Envoi direct indisponible. Ouverture de votre e-mail en secours...", false);
          openMailtoFallback(institution, volume, email, details);
        })
        .finally(function () {
          if (timeoutId) window.clearTimeout(timeoutId);
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
    emit("thank_you_view", { page: "merci", source: source });
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
