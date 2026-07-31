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

    function updateMenuButton(item, isOpen) {
      item.btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      item.btn.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
      var icon = item.btn.querySelector("[aria-hidden='true']");
      if (icon) icon.textContent = isOpen ? "×" : "☰";
    }

    function updatePageScroll() {
      var hasOpenMenu = items.some(function (item) {
        return item.menu.classList.contains("open");
      });
      document.documentElement.classList.toggle("mobile-menu-open", hasOpenMenu);
      document.body.classList.toggle("mobile-menu-open", hasOpenMenu);
    }

    function closeItem(item, restoreFocus) {
      item.menu.classList.remove("open");
      item.menu.setAttribute("aria-hidden", "true");
      updateMenuButton(item, false);
      updatePageScroll();
      if (restoreFocus && typeof item.btn.focus === "function") {
        item.btn.focus({ preventScroll: true });
      }
    }

    function closeAll(exceptMenu, restoreFocus) {
      items.forEach(function (item) {
        if (!exceptMenu || item.menu !== exceptMenu) {
          closeItem(item, restoreFocus);
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
          menu.setAttribute("aria-hidden", "false");
          updateMenuButton(item, true);
          updatePageScroll();
          var firstLink = menu.querySelector("a");
          if (firstLink && typeof firstLink.focus === "function") {
            firstLink.focus({ preventScroll: true });
          }
        } else {
          closeItem(item, true);
        }
      });

      menu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          closeItem(item, false);
        });
      });
    });

    if (!items.length) return;

    document.addEventListener("click", function (evt) {
      items.forEach(function (item) {
        if (!item.menu.classList.contains("open")) return;
        if (item.menu.contains(evt.target) || item.btn.contains(evt.target)) return;
        closeItem(item, false);
      });
    });

    document.addEventListener("keydown", function (evt) {
      var openItem = items.find(function (item) {
        return item.menu.classList.contains("open");
      });
      if (!openItem) return;

      if (evt.key === "Escape") {
        closeItem(openItem, true);
        return;
      }

      if (evt.key === "Tab") {
        var focusable = [openItem.btn].concat(
          Array.prototype.slice.call(openItem.menu.querySelectorAll("a[href], button:not([disabled])"))
        );
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (evt.shiftKey && document.activeElement === first) {
          evt.preventDefault();
          last.focus();
        } else if (!evt.shiftKey && document.activeElement === last) {
          evt.preventDefault();
          first.focus();
        }
      }
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

  var turnstileLoadPromise = null;

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    if (turnstileLoadPromise) return turnstileLoadPromise;

    turnstileLoadPromise = new Promise(function (resolve, reject) {
      var existingScript = document.querySelector("script[data-turnstile-loader]");
      if (existingScript) {
        existingScript.addEventListener("load", resolve, { once: true });
        existingScript.addEventListener("error", reject, { once: true });
        return;
      }

      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-turnstile-loader", "true");
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });

    return turnstileLoadPromise;
  }

  function bindTurnstileLoader() {
    var verification = document.querySelector(".turnstile-verification");
    var form = document.getElementById("quote-form");
    if (!verification || !form) return;

    var requested = false;
    function requestTurnstile() {
      if (requested) return;
      requested = true;
      loadTurnstileScript().catch(function () {
        requested = false;
        turnstileLoadPromise = null;
        var failedScript = document.querySelector("script[data-turnstile-loader]");
        if (failedScript) failedScript.remove();
      });
    }

    form.addEventListener("focusin", requestTurnstile, { once: true });
    verification.addEventListener("pointerenter", requestTurnstile, { once: true });

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        requestTurnstile();
        observer.disconnect();
      }, { rootMargin: "500px 0px" });
      observer.observe(verification);
    } else {
      window.setTimeout(requestTurnstile, 1800);
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

    function resetTurnstile() {
      if (window.turnstile && typeof window.turnstile.reset === "function") {
        try {
          window.turnstile.reset();
        } catch (error) {
          // A fresh challenge will be rendered on the next attempt.
        }
      }
    }

    function openWhatsAppFallback(institution, volume, zone, frequency, email, phone, details) {
      var messageLines = [
        "Bonjour Zepoul Ayiti,",
        "",
        "Client: " + institution,
        "Volume hebdomadaire (cartons): " + volume,
        "Zone d’approvisionnement: " + zone,
        "Fréquence souhaitée: " + frequency,
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
      var zone = document.getElementById("zone").value.trim();
      var frequency = document.getElementById("frequency").value.trim();
      var email = document.getElementById("email").value.trim();
      var phone = document.getElementById("phone").value.trim();
      var details = document.getElementById("details").value.trim();
      var turnstileInput = form.querySelector("input[name='cf-turnstile-response']");
      var turnstileToken = turnstileInput ? turnstileInput.value.trim() : "";

      if (!form.checkValidity()) {
        form.reportValidity();
        setFormStatus("Veuillez vérifier les renseignements obligatoires avant de transmettre la demande.", false);
        return;
      }

      if (!turnstileToken) {
        setFormStatus("Veuillez compléter la vérification de sécurité avant de transmettre la demande.", false);
        return;
      }

      var commercialDetails = [
        "Zone d’approvisionnement : " + zone,
        "Fréquence souhaitée : " + frequency,
        details ? "Précisions : " + details : ""
      ].filter(Boolean).join("\n");

      var payload = {
        institution: institution,
        volume: volume,
        volume_hebdomadaire_cartons: volume,
        zone: zone,
        frequency: frequency,
        email: email,
        phone: phone,
        whatsapp: phone,
        details: commercialDetails,
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

      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timeoutId = window.setTimeout(function () {
        if (controller) controller.abort();
      }, 15000);

      fetch(QUOTE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      })
        .then(function (response) {
          return response.json().catch(function () {
            return {};
          }).then(function (data) {
            if (!response.ok || data.success === false) {
              var requestError = new Error(data.error || "request_failed");
              requestError.status = response.status;
              requestError.code = data.error || "request_failed";
              throw requestError;
            }
            return data;
          });
        })
        .then(function () {
          emit("quote_form_submit", { institution: institution, volume: volume, channel: "server_form" });
          setFormStatus("Demande envoyée avec succès. Redirection en cours...", true);
          form.reset();
          window.setTimeout(function () {
            window.location.href = "merci.html?source=quote";
          }, 500);
        })
        .catch(function (error) {
          resetTurnstile();

          if (error && (error.status === 400 || error.code === "invalid_fields")) {
            setFormStatus("Certains renseignements ne sont pas valides. Veuillez les vérifier avant de réessayer.", false);
            return;
          }

          if (error && (error.status === 403 || error.code === "turnstile_failed")) {
            setFormStatus("La vérification de sécurité a expiré. Veuillez la compléter de nouveau.", false);
            return;
          }

          if (error && error.status === 429) {
            setFormStatus("Trop de tentatives ont été effectuées. Veuillez patienter quelques minutes avant de réessayer.", false);
            return;
          }

          emit("quote_form_fallback_whatsapp", { institution: institution, volume: volume });
          setFormStatus("Envoi direct indisponible. Ouverture de WhatsApp en secours...", false);
          openWhatsAppFallback(institution, volume, zone, frequency, email, phone, details);
        })
        .finally(function () {
          window.clearTimeout(timeoutId);
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
    var inertSiblings = [];

    function getFocusableElements(lightbox) {
      return Array.prototype.slice.call(lightbox.querySelectorAll(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )).filter(function (element) {
        return !element.classList.contains("lightbox-backdrop") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.offsetParent !== null;
      });
    }

    function isolateLightbox(lightbox) {
      inertSiblings = [];
      Array.prototype.forEach.call(document.body.children, function (element) {
        if (element === lightbox) return;
        inertSiblings.push({
          element: element,
          wasInert: element.hasAttribute("inert")
        });
        element.setAttribute("inert", "");
      });
      document.documentElement.classList.add("lightbox-open");
      document.body.classList.add("lightbox-open");
    }

    function restorePageInteraction() {
      inertSiblings.forEach(function (item) {
        if (!item.wasInert) {
          item.element.removeAttribute("inert");
        }
      });
      inertSiblings = [];
      document.documentElement.classList.remove("lightbox-open");
      document.body.classList.remove("lightbox-open");
    }

    function openLightbox(lightbox, trigger) {
      if (!lightbox) return;
      if (activeLightbox && activeLightbox !== lightbox) {
        closeLightbox(activeLightbox, false);
      }
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
      isolateLightbox(lightbox);

      var closeButton = lightbox.querySelector(".lightbox-close");
      if (closeButton && typeof closeButton.focus === "function") {
        closeButton.focus({ preventScroll: true });
      }
    }

    function closeLightbox(lightbox, restoreFocus) {
      if (!lightbox) return;
      lightbox.classList.remove("open");
      lightbox.setAttribute("aria-hidden", "true");
      activeLightbox = null;
      restorePageInteraction();

      if (restoreFocus !== false && lightbox.__lastTrigger && typeof lightbox.__lastTrigger.focus === "function") {
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
        return;
      }

      if (evt.key === "Tab" && activeLightbox) {
        var focusable = getFocusableElements(activeLightbox);
        if (!focusable.length) {
          evt.preventDefault();
          return;
        }

        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (evt.shiftKey && document.activeElement === first) {
          evt.preventDefault();
          last.focus();
        } else if (!evt.shiftKey && document.activeElement === last) {
          evt.preventDefault();
          first.focus();
        }
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
    bindTurnstileLoader();
    bindQuoteForm();
    bindBrandVideo();
    bindLightboxes();
    loadDeferredFonts();
    trackThankYou();
  });
})();
