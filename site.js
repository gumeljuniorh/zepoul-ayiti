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

    function setFormStatus(message, success) {
      var statusEl = document.getElementById("form-status");
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = success ? "var(--primary)" : "#b42318";
    }

    function openMailtoFallback(institution, volume, email, phone, details) {
      var subject = "Demande de cotation - Zepoul Ayiti";
      var bodyLines = [
        "Bonjour Zepoul Ayiti,",
        "",
        "Client: " + institution,
        "Volume hebdomadaire (cartons): " + volume,
        "Email de contact: " + email,
        "WhatsApp: " + phone,
        details ? "Précisions: " + details : "",
        "",
        "Merci."
      ].filter(Boolean);

      window.location.href = "mailto:info@zepoulayiti.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(bodyLines.join("\n"));
    }

    function sendLeadToSheet(payload) {
      if (!QUOTE_DB_ENDPOINT) return;

      var params = new URLSearchParams();
      Object.keys(payload || {}).forEach(function (key) {
        var value = payload[key];
        if (value === undefined || value === null) return;
        params.append(key, String(value));
      });

      try {
        if (navigator.sendBeacon) {
          var blob = new Blob([params.toString()], { type: "application/x-www-form-urlencoded" });
          var queued = navigator.sendBeacon(QUOTE_DB_ENDPOINT, blob);
          if (queued) return;
        }
      } catch (err) {
        // Ignore and fallback to fetch
      }

      fetch(QUOTE_DB_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: params,
        keepalive: true
      }).catch(function () {
        // Silent failure: sheet capture is best-effort
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector("button[type='submit']");
      var institution = document.getElementById("inst").value.trim();
      var volume = document.getElementById("vol").value.trim();
      var email = document.getElementById("email").value.trim();
      var phone = document.getElementById("phone").value.trim();
      var details = document.getElementById("details").value.trim();

      if (!institution || !volume || Number(volume) <= 0 || !email || !phone) {
        setFormStatus("Veuillez renseigner le client, un volume valide, un e-mail et un numéro WhatsApp.", false);
        return;
      }

      var payload = {
        institution: institution,
        volume: volume,
        volume_hebdomadaire_cartons: volume,
        email: email,
        phone: phone,
        whatsapp: phone,
        details: details,
        _replyto: email,
        _subject: "Nouvelle demande de cotation - Zepoul Ayiti",
        _captcha: "false"
      };

      sendLeadToSheet({
        institution: institution,
        volume: volume,
        email: email,
        phone: phone,
        whatsapp: phone,
        details: details,
        source: "site-quote"
      });

      setFormStatus("Envoi en cours...", true);
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
          openMailtoFallback(institution, volume, email, phone, details);
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

  function bindLightboxes() {
    var activeLightbox = null;

    function openLightbox(lightbox, trigger) {
      if (!lightbox) return;
      lightbox.__lastTrigger = trigger || null;
      lightbox.classList.add("open");
      lightbox.setAttribute("aria-hidden", "false");
      activeLightbox = lightbox;

      var closeButton = lightbox.querySelector("[data-lightbox-close]");
      if (closeButton && typeof closeButton.focus === "function") {
        closeButton.focus({ preventScroll: true });
      }
    }

    function closeLightbox(lightbox) {
      if (!lightbox) return;
      lightbox.classList.remove("open");
      lightbox.setAttribute("aria-hidden", "true");
      activeLightbox = null;

      if (lightbox.__lastTrigger && typeof lightbox.__lastTrigger.focus === "function") {
        lightbox.__lastTrigger.focus({ preventScroll: true });
      }
    }

    document.querySelectorAll("[data-lightbox-open]").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var targetId = trigger.getAttribute("data-lightbox-open");
        var lightbox = targetId ? document.getElementById(targetId) : null;
        openLightbox(lightbox, trigger);
      });
    });

    document.querySelectorAll("[data-lightbox-close]").forEach(function (closeButton) {
      closeButton.addEventListener("click", function () {
        closeLightbox(closeButton.closest(".lightbox"));
      });
    });

    document.addEventListener("keydown", function (evt) {
      if (evt.key === "Escape" && activeLightbox) {
        closeLightbox(activeLightbox);
      }
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
    bindLightboxes();
    trackThankYou();
  });
})();
