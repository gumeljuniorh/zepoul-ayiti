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

    function setFormStatus(message, success) {
      var statusEl = document.getElementById("form-status");
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = success ? "var(--primary)" : "#b42318";
    }

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
        volume_hebdomadaire_cartons: volume,
        email: email,
        details: details,
        _subject: "Nouvelle demande de cotation - Zepoul Ayiti",
        _captcha: "false"
      };

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
          openMailtoFallback(institution, volume, email, details);
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
