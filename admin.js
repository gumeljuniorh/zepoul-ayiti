(function () {
  "use strict";

  var state = {
    quotes: [],
    activeQuote: null,
    loading: false
  };

  function query(selector, root) {
    return (root || document).querySelector(selector);
  }

  function queryAll(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function formatDate(value, includeTime) {
    if (!value) return "Non renseignée";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("fr-HT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: includeTime ? "2-digit" : undefined,
      minute: includeTime ? "2-digit" : undefined
    }).format(date);
  }

  function createTextElement(tag, text, className) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text || "";
    return element;
  }

  function setMessage(message, isError) {
    var target = query("[data-admin-message]");
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("is-error", Boolean(isError));
    target.hidden = !message;
  }

  function setLoading(loading) {
    state.loading = loading;
    queryAll("[data-refresh]").forEach(function (button) {
      button.disabled = loading;
      button.textContent = loading ? "Actualisation..." : "Actualiser";
    });
  }

  function setMetrics(quotes) {
    var counts = quotes.reduce(function (result, quote) {
      result[quote.status] = (result[quote.status] || 0) + 1;
      return result;
    }, {});

    queryAll("[data-metric]").forEach(function (element) {
      var metric = element.getAttribute("data-metric");
      element.textContent = metric === "total" ? quotes.length : counts[metric] || 0;
    });
  }

  function appendContact(container, quote) {
    var emailLink = document.createElement("a");
    emailLink.href = "mailto:" + quote.email;
    emailLink.textContent = quote.email || "E-mail non renseigné";
    container.appendChild(emailLink);

    var digits = String(quote.phone || "").replace(/\D/g, "");
    var phoneLink = document.createElement(digits ? "a" : "small");
    if (digits) {
      phoneLink.href = "https://wa.me/" + digits;
      phoneLink.target = "_blank";
      phoneLink.rel = "noopener";
    }
    phoneLink.textContent = quote.phone || "WhatsApp non renseigné";
    container.appendChild(phoneLink);
  }

  function renderQuotes() {
    var body = query("[data-quotes-body]");
    var container = query("[data-table-container]");
    var empty = query("[data-empty]");
    if (!body || !container || !empty) return;

    body.replaceChildren();
    setMetrics(state.quotes);
    container.hidden = state.quotes.length === 0;
    empty.hidden = state.quotes.length !== 0;

    state.quotes.forEach(function (quote) {
      var row = document.createElement("tr");

      var dateCell = document.createElement("td");
      dateCell.appendChild(createTextElement("strong", formatDate(quote.submittedAt, false)));
      dateCell.appendChild(createTextElement("small", quote.quoteId || "Dossier antérieur"));

      var clientCell = document.createElement("td");
      clientCell.appendChild(createTextElement("strong", quote.institution));
      clientCell.appendChild(createTextElement("small", quote.zone || "Zone à confirmer"));

      var needCell = document.createElement("td");
      needCell.appendChild(createTextElement("strong", String(quote.volume || 0) + " cartons / semaine"));
      needCell.appendChild(createTextElement("small", quote.frequency || "Fréquence à confirmer"));

      var contactCell = document.createElement("td");
      appendContact(contactCell, quote);

      var statusCell = document.createElement("td");
      var badge = createTextElement("span", quote.status || "Nouvelle", "status-badge");
      badge.setAttribute("data-status", quote.status || "Nouvelle");
      statusCell.appendChild(badge);
      if (quote.responsible) {
        statusCell.appendChild(createTextElement("small", "Suivi : " + quote.responsible));
      }

      var actionCell = document.createElement("td");
      var action = createTextElement("button", "Gérer", "admin-button admin-button-secondary");
      action.type = "button";
      action.addEventListener("click", function () {
        openQuoteDialog(quote);
      });
      actionCell.appendChild(action);

      [dateCell, clientCell, needCell, contactCell, statusCell, actionCell].forEach(function (cell) {
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  async function parseApiResponse(response) {
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success === false) {
      var error = new Error(data.error || "request_failed");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadQuotes() {
    if (state.loading) return;
    setLoading(true);
    setMessage("Chargement sécurisé des demandes...", false);

    var search = query("[data-search]");
    var status = query("[data-status-filter]");
    var params = new URLSearchParams({ limit: "500" });
    if (search && search.value.trim()) params.set("search", search.value.trim());
    if (status && status.value) params.set("status", status.value);

    try {
      var response = await fetch("/api/admin/quotes?" + params.toString(), {
        headers: { "Accept": "application/json" },
        credentials: "same-origin",
        cache: "no-store"
      });
      var data = await parseApiResponse(response);
      state.quotes = Array.isArray(data.quotes) ? data.quotes : [];
      renderQuotes();
      setMessage("", false);

      var sync = query("[data-last-sync]");
      if (sync) sync.textContent = "Dernière synchronisation : " + formatDate(new Date(), true);
    } catch (error) {
      state.quotes = [];
      renderQuotes();
      if (error.status === 403) {
        setMessage("Accès administratif non autorisé. Vérifiez la politique Cloudflare Access et l’adresse autorisée.", true);
      } else {
        setMessage("Les données commerciales ne sont pas disponibles. Vérifiez le Worker, Apps Script et leurs secrets partagés.", true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function checkHealth() {
    var pill = query("[data-system-pill]");
    if (!pill) return;

    try {
      var response = await fetch("/api/health", {
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      var data = await parseApiResponse(response);
      pill.textContent = data.storage === "operational" ? "Système opérationnel" : "Système à vérifier";
      pill.classList.toggle("is-online", data.storage === "operational");
      pill.classList.toggle("is-offline", data.storage !== "operational");
    } catch (error) {
      pill.textContent = "Système à vérifier";
      pill.classList.remove("is-online");
      pill.classList.add("is-offline");
    }
  }

  function addSummaryItem(summary, label, value) {
    var wrapper = document.createElement("div");
    wrapper.appendChild(createTextElement("dt", label));
    wrapper.appendChild(createTextElement("dd", value || "Non renseigné"));
    summary.appendChild(wrapper);
  }

  function openQuoteDialog(quote) {
    var dialog = query("[data-quote-dialog]");
    var form = query("[data-quote-form]");
    var summary = query("[data-quote-summary]");
    if (!dialog || !form || !summary) return;

    state.activeQuote = quote;
    query("[data-dialog-client]").textContent = quote.institution || "Demande de cotation";
    query("[data-dialog-reference]").textContent = quote.quoteId || "Dossier antérieur sans identifiant";
    form.elements.rowNumber.value = quote.rowNumber;
    form.elements.quoteId.value = quote.quoteId || "";
    form.elements.status.value = quote.status || "Nouvelle";
    form.elements.responsible.value = quote.responsible || "";
    form.elements.notes.value = quote.notes || "";
    query("[data-dialog-status]").textContent = "";

    summary.replaceChildren();
    addSummaryItem(summary, "Réception", formatDate(quote.submittedAt, true));
    addSummaryItem(summary, "Volume", String(quote.volume || 0) + " cartons / semaine");
    addSummaryItem(summary, "Zone", quote.zone);
    addSummaryItem(summary, "Fréquence", quote.frequency);
    addSummaryItem(summary, "E-mail", quote.email);
    addSummaryItem(summary, "WhatsApp", quote.phone);
    if (quote.details) addSummaryItem(summary, "Précisions", quote.details);

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog() {
    var dialog = query("[data-quote-dialog]");
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    state.activeQuote = null;
  }

  async function saveQuote(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var submit = form.querySelector("button[type='submit']");
    var statusTarget = query("[data-dialog-status]");
    var payload = {
      rowNumber: Number(form.elements.rowNumber.value),
      quoteId: form.elements.quoteId.value,
      status: form.elements.status.value,
      responsible: form.elements.responsible.value.trim(),
      notes: form.elements.notes.value.trim()
    };

    submit.disabled = true;
    submit.textContent = "Enregistrement...";
    statusTarget.textContent = "Enregistrement du suivi...";
    statusTarget.classList.remove("is-error");

    try {
      var response = await fetch("/api/admin/quotes/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      await parseApiResponse(response);
      statusTarget.textContent = "Suivi commercial enregistré.";
      await loadQuotes();
      window.setTimeout(closeDialog, 500);
    } catch (error) {
      statusTarget.textContent = "La mise à jour n’a pas pu être enregistrée. Veuillez réessayer.";
      statusTarget.classList.add("is-error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Enregistrer le suivi";
    }
  }

  function debounce(callback, delay) {
    var timer;
    return function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(callback, delay);
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    queryAll("[data-refresh]").forEach(function (button) {
      button.addEventListener("click", function () {
        loadQuotes();
        checkHealth();
      });
    });

    var search = query("[data-search]");
    var status = query("[data-status-filter]");
    if (search) search.addEventListener("input", debounce(loadQuotes, 350));
    if (status) status.addEventListener("change", loadQuotes);

    queryAll("[data-dialog-close]").forEach(function (button) {
      button.addEventListener("click", closeDialog);
    });

    var dialog = query("[data-quote-dialog]");
    if (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) closeDialog();
      });
    }

    var form = query("[data-quote-form]");
    if (form) form.addEventListener("submit", saveQuote);

    loadQuotes();
    checkHealth();
  });
})();
