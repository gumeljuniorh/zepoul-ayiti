(function () {
  function emit(name, params) {
    var payload = params || {};

    if (typeof window.gtag === "function") {
      window.gtag("event", name, payload);
    }

    if (window.zaraz && typeof window.zaraz.track === "function") {
      window.zaraz.track(name, payload);
    }
  }

  window.trackEvent = emit;

  function ensureSkipLink() {
    if (document.querySelector(".skip-link")) return;

    var target = document.querySelector("main");
    if (!target) return;

    if (!target.id) {
      target.id = "contenu-principal";
    }

    var skipLink = document.createElement("a");
    skipLink.className = "skip-link";
    skipLink.href = "#" + target.id;
    skipLink.textContent = "Aller au contenu principal";
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

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

    document.querySelectorAll("a[href*='#commande']").forEach(function (link) {
      link.addEventListener("click", function () {
        emit("quote_cta_click", { page: page, target: link.href });
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

  function bindFloatingContacts() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".float-btn"));
    if (!buttons.length) return;

    var compactViewport = window.matchMedia("(max-width: 720px)");
    var zones = Array.prototype.slice.call(document.querySelectorAll(".hero, #commande, .site-footer"));
    if (!zones.length || !("IntersectionObserver" in window)) return;

    var visibleZones = new Set();

    function updateButtons() {
      var shouldSuppress = compactViewport.matches && visibleZones.size > 0;
      buttons.forEach(function (button) {
        button.classList.toggle("is-suppressed", shouldSuppress);
        button.setAttribute("aria-hidden", shouldSuppress ? "true" : "false");
        button.tabIndex = shouldSuppress ? -1 : 0;
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          visibleZones.add(entry.target);
        } else {
          visibleZones.delete(entry.target);
        }
      });
      updateButtons();
    }, { threshold: 0.08 });

    zones.forEach(function (zone) {
      observer.observe(zone);
    });

    if (typeof compactViewport.addEventListener === "function") {
      compactViewport.addEventListener("change", updateButtons);
    } else if (typeof compactViewport.addListener === "function") {
      compactViewport.addListener(updateButtons);
    }
  }

  function bindQuoteForm() {
    var form = document.getElementById("quote-form");
    if (!form) return;

    var QUOTE_ENDPOINT = "/api/quote";
    var formReadyAt = Date.now();
    var honeyInput = form.querySelector("input[name='_honey']");

    function setFormStatus(message, success) {
      var statusEl = document.getElementById("form-status");
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = success ? "var(--primary)" : "#b42318";
    }

    function openWhatsAppFallback(institution, volume, email, phone, details) {
      var messageLines = [
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

      window.location.href = "https://wa.me/50944975668?text=" + encodeURIComponent(messageLines.join("\n"));
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (honeyInput && honeyInput.value.trim()) {
        setFormStatus("La demande n’a pas pu être transmise. Veuillez réessayer.", false);
        return;
      }

      if (Date.now() - formReadyAt < 1500) {
        setFormStatus("Veuillez patienter un instant avant de transmettre la demande.", false);
        return;
      }

      var submitBtn = form.querySelector("button[type='submit']");
      var originalSubmitText = submitBtn ? submitBtn.textContent.trim() : "";
      var institution = document.getElementById("inst").value.trim();
      var volume = document.getElementById("vol").value.trim();
      var email = document.getElementById("email").value.trim();
      var phone = document.getElementById("phone").value.trim();
      var details = document.getElementById("details").value.trim();
      var turnstileInput = form.querySelector("input[name='cf-turnstile-response']");
      var turnstileToken = turnstileInput ? turnstileInput.value.trim() : "";

      if (!institution || !volume || Number(volume) <= 0 || !email || !phone) {
        setFormStatus("Veuillez renseigner le client, un volume valide, un e-mail et un numéro WhatsApp.", false);
        return;
      }

      if (!turnstileToken) {
        setFormStatus("Veuillez compléter la vérification de sécurité avant de transmettre la demande.", false);
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
        "cf-turnstile-response": turnstileToken
      };

      setFormStatus("Envoi en cours...", true);
      form.classList.add("is-submitting");
      form.setAttribute("aria-busy", "true");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.textContent = "Transmission en cours...";
      }

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
          emit("quote_form_fallback_whatsapp", { institution: institution, volume: volume });
          setFormStatus("Envoi direct indisponible. Ouverture de WhatsApp en secours...", false);
          openWhatsAppFallback(institution, volume, email, phone, details);
        })
        .finally(function () {
          form.classList.remove("is-submitting");
          form.removeAttribute("aria-busy");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute("aria-busy");
            submitBtn.textContent = originalSubmitText;
          }
        });
    });
  }

  function bindBrandVideo() {
    var brandVideo = document.getElementById("brand-video");
    if (!brandVideo) return;
    var loaded = false;

    brandVideo.muted = true;
    brandVideo.volume = 0;

    function loadVideo() {
      if (loaded) return;
      loaded = true;

      brandVideo.querySelectorAll("source[data-src]").forEach(function (source) {
        source.src = source.getAttribute("data-src");
        source.removeAttribute("data-src");
      });

      brandVideo.load();
      if (brandVideo.autoplay) {
        var playPromise = brandVideo.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {
            // Mobile browsers may wait for user interaction.
          });
        }
      }
    }

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

    brandVideo.addEventListener("pointerdown", loadVideo, { once: true });
    brandVideo.addEventListener("focus", loadVideo, { once: true });

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadVideo();
          observer.disconnect();
        });
      }, { rootMargin: "300px 0px" });

      observer.observe(brandVideo);
    } else {
      window.setTimeout(loadVideo, 2000);
    }
  }

  function bindLightboxes() {
    var activeLightbox = null;

    function openLightbox(lightbox, trigger) {
      if (!lightbox) return;
      lightbox.querySelectorAll("source[data-srcset]").forEach(function (source) {
        source.srcset = source.getAttribute("data-srcset");
        source.removeAttribute("data-srcset");
      });
      lightbox.querySelectorAll("img[data-src]").forEach(function (img) {
        img.src = img.getAttribute("data-src");
        img.removeAttribute("data-src");
      });
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

  function loadDeferredFonts() {
    if (document.querySelector("link[data-deferred-fonts]")) return;

    var load = function () {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Playfair+Display:wght@700&display=swap";
      link.setAttribute("data-deferred-fonts", "true");
      document.head.appendChild(link);
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(load, { timeout: 1200 });
    } else {
      window.setTimeout(load, 700);
    }
  }

  function trackThankYou() {
    if (document.body.getAttribute("data-page") !== "merci") return;
    var params = new URLSearchParams(window.location.search);
    var source = params.get("source") || "direct";
    emit("thank_you_view", { page: "merci", source: source });
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensureSkipLink();
    bindMenu();
    bindTracking();
    bindImageFallbacks();
    bindFloatingContacts();
    bindQuoteForm();
    bindBrandVideo();
    bindLightboxes();
    loadDeferredFonts();
    trackThankYou();
  });
})();
