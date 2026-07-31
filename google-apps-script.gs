const SPREADSHEET_ID = "1J80-ox1i-SCPNPO9dtyhPeHcTwA4vr97MOoK2MessZ8";
const QUOTES_SHEET_NAME = "DEMANDE DE COTATION";
const STOCK_SHEET_NAME = "STOCK PUBLIC";
const SCHEMA_VERSION = "2";
const QUOTE_HEADERS = [
  "Date et heure",
  "Institution / client",
  "Volume hebdomadaire (cartons)",
  "Adresse e-mail",
  "WhatsApp",
  "Précisions",
  "Source",
  "Statut",
  "Responsable du suivi",
  "Notes commerciales",
  "Zone d’approvisionnement",
  "Fréquence souhaitée",
  "Identifiant",
  "Dernière mise à jour"
];
const STOCK_HEADERS = [
  "Cartons disponibles",
  "Statut public",
  "Dernière mise à jour",
  "Message public",
  "Publication active"
];
const VALID_STATUSES = [
  "Nouvelle",
  "En cours",
  "Cotation envoyée",
  "Confirmée",
  "Clôturée"
];
const VALID_STOCK_STATUSES = [
  "Disponible",
  "Stock limité",
  "Sur demande",
  "Indisponible"
];

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeText_(value, maxLength) {
  const text = String(value || "").trim().slice(0, maxLength);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function plainText_(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function secureEquals_(left, right) {
  left = String(left || "");
  right = String(right || "");
  if (!left || left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function parseRequest_(event) {
  const raw = event && event.postData && event.postData.contents;
  if (!raw) throw new Error("empty_request");
  return JSON.parse(raw);
}

function generateQuoteId_(submissionId) {
  const datePart = Utilities.formatDate(
    new Date(),
    "America/Port-au-Prince",
    "yyyyMMdd"
  );
  const source = plainText_(submissionId, 80).replace(/[^a-zA-Z0-9]/g, "");
  const suffix = source.length >= 8
    ? source.slice(-8).toUpperCase()
    : Utilities.getUuid().slice(0, 8).toUpperCase();
  return "ZP-" + datePart + "-" + suffix;
}

function asIso_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  if (!value) return "";
  const date = new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function styleHeader_(range) {
  range
    .setBackground("#0A3C19")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setWrap(true);
}

function setupQuotesSheet_(spreadsheet, sheet) {
  const isNew = !sheet;
  if (!sheet) sheet = spreadsheet.insertSheet(QUOTES_SHEET_NAME);

  if (sheet.getMaxColumns() < QUOTE_HEADERS.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      QUOTE_HEADERS.length - sheet.getMaxColumns()
    );
  }

  if (isNew || sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, QUOTE_HEADERS.length).setValues([QUOTE_HEADERS]);
  } else {
    sheet.getRange(1, 11, 1, 4).setValues([QUOTE_HEADERS.slice(10)]);
  }

  styleHeader_(sheet.getRange(1, 1, 1, QUOTE_HEADERS.length));
  sheet.setFrozenRows(1);
  sheet.setHiddenGridlines(true);
  sheet.setRowHeight(1, 40);
  sheet.setColumnWidth(11, 175);
  sheet.setColumnWidth(12, 155);
  sheet.setColumnWidth(13, 150);
  sheet.setColumnWidth(14, 165);
  sheet.getRange(2, 14, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setNumberFormat("dd mmm yyyy HH:mm");

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(VALID_STATUSES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 8, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setDataValidation(statusRule);

  return sheet;
}

function setupStockSheet_(spreadsheet, sheet) {
  const isNew = !sheet;
  if (!sheet) sheet = spreadsheet.insertSheet(STOCK_SHEET_NAME);

  if (sheet.getMaxColumns() < STOCK_HEADERS.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      STOCK_HEADERS.length - sheet.getMaxColumns()
    );
  }

  sheet.getRange(1, 1, 1, STOCK_HEADERS.length).setValues([STOCK_HEADERS]);
  if (isNew || sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, 1, 5).setValues([
      ["", "Sur demande", "", "Volumes confirmés sur demande.", "NON"]
    ]);
  }

  styleHeader_(sheet.getRange(1, 1, 1, STOCK_HEADERS.length));
  sheet.setFrozenRows(1);
  sheet.setHiddenGridlines(true);
  sheet.setTabColor("#FBC531");
  sheet.setRowHeight(1, 40);
  sheet.setColumnWidth(1, 155);
  sheet.setColumnWidth(2, 145);
  sheet.setColumnWidth(3, 175);
  sheet.setColumnWidth(4, 265);
  sheet.setColumnWidth(5, 155);
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setNumberFormat("0");
  sheet.getRange(2, 3, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setNumberFormat("dd mmm yyyy HH:mm");
  sheet.getRange("E1").setNote(
    "Choisissez OUI uniquement lorsque la quantité et la date sont exactes. Le site masque le bloc lorsque la valeur est NON."
  );

  const stockStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(VALID_STOCK_STATUSES, true)
    .setAllowInvalid(false)
    .build();
  const publicationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["OUI", "NON"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 2, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setDataValidation(stockStatusRule);
  sheet.getRange(2, 5, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setDataValidation(publicationRule);

  return sheet;
}

function ensureSystem_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  spreadsheet.setSpreadsheetTimeZone("America/Port-au-Prince");

  let quotes = spreadsheet.getSheetByName(QUOTES_SHEET_NAME);
  let stock = spreadsheet.getSheetByName(STOCK_SHEET_NAME);
  const properties = PropertiesService.getScriptProperties();
  const requiresSetup =
    !quotes ||
    !stock ||
    quotes.getMaxColumns() < QUOTE_HEADERS.length ||
    properties.getProperty("SCHEMA_VERSION") !== SCHEMA_VERSION;

  if (requiresSetup) {
    quotes = setupQuotesSheet_(spreadsheet, quotes);
    stock = setupStockSheet_(spreadsheet, stock);
    properties.setProperty("SCHEMA_VERSION", SCHEMA_VERSION);
  }

  return { spreadsheet: spreadsheet, quotes: quotes, stock: stock };
}

function initialiserSystemeZepoul() {
  ensureSystem_();
  return "Système Zepoul initialisé.";
}

function createQuote_(system, payload) {
  const institution = safeText_(payload.institution, 160);
  const email = safeText_(payload.email, 254);
  const phone = safeText_(payload.phone, 40);
  const zone = safeText_(payload.zone, 120);
  const frequency = safeText_(payload.frequency, 80);
  const details = safeText_(payload.details, 2000);
  const source = safeText_(payload.source || "Site web", 80);
  const submissionId = plainText_(payload.submissionId, 80).toLowerCase();
  const volume = Number(payload.volume);

  if (
    institution.length < 2 ||
    !Number.isInteger(volume) ||
    volume < 1 ||
    !isValidEmail_(email) ||
    phone.replace(/\D/g, "").length < 8 ||
    zone.length < 2 ||
    frequency.length < 2 ||
    !/^[a-z0-9-]{16,80}$/.test(submissionId)
  ) {
    return { success: false, error: "invalid_fields" };
  }

  const quoteId = generateQuoteId_(submissionId);
  const now = new Date();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(7000)) return { success: false, error: "service_busy" };

  try {
    const existing = system.quotes
      .getRange(2, 13, Math.max(system.quotes.getLastRow() - 1, 1), 1)
      .createTextFinder(quoteId)
      .matchEntireCell(true)
      .findNext();
    if (existing) {
      return { success: true, quoteId: quoteId, duplicate: true };
    }

    system.quotes.appendRow([
      now,
      institution,
      volume,
      email,
      phone,
      details,
      source,
      "Nouvelle",
      "",
      "",
      zone,
      frequency,
      quoteId,
      now
    ]);
    SpreadsheetApp.flush();
    return { success: true, quoteId: quoteId };
  } finally {
    lock.releaseLock();
  }
}

function rowToQuote_(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    submittedAt: asIso_(row[0]),
    institution: plainText_(row[1], 160),
    volume: Number(row[2]) || 0,
    email: plainText_(row[3], 254),
    phone: plainText_(row[4], 40),
    details: plainText_(row[5], 2000),
    source: plainText_(row[6], 80),
    status: plainText_(row[7], 40) || "Nouvelle",
    responsible: plainText_(row[8], 160),
    notes: plainText_(row[9], 2000),
    zone: plainText_(row[10], 120),
    frequency: plainText_(row[11], 80),
    quoteId: plainText_(row[12], 80),
    updatedAt: asIso_(row[13])
  };
}

function listQuotes_(system, payload) {
  const lastRow = system.quotes.getLastRow();
  if (lastRow < 2) return { success: true, quotes: [] };

  const limit = Math.min(Math.max(Number(payload.limit) || 200, 1), 500);
  const status = plainText_(payload.status, 40).toLowerCase();
  const search = plainText_(payload.search, 120).toLowerCase();
  const firstRow = Math.max(2, lastRow - 1999);
  const values = system.quotes
    .getRange(firstRow, 1, lastRow - firstRow + 1, QUOTE_HEADERS.length)
    .getValues();

  const quotes = [];
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    if (!row[1]) continue;
    const quote = rowToQuote_(row, firstRow + index);
    if (status && quote.status.toLowerCase() !== status) continue;
    if (search) {
      const searchable = [
        quote.institution,
        quote.email,
        quote.phone,
        quote.zone,
        quote.quoteId
      ].join(" ").toLowerCase();
      if (!searchable.includes(search)) continue;
    }
    quotes.push(quote);
    if (quotes.length >= limit) break;
  }

  return { success: true, quotes: quotes };
}

function updateQuoteStatus_(system, payload) {
  const rowNumber = Number(payload.rowNumber);
  const requestedId = plainText_(payload.quoteId, 80);
  const status = plainText_(payload.status, 40);
  const responsible = safeText_(payload.responsible, 160);
  const notes = safeText_(payload.notes, 2000);

  if (
    !Number.isInteger(rowNumber) ||
    rowNumber < 2 ||
    rowNumber > system.quotes.getLastRow() ||
    VALID_STATUSES.indexOf(status) === -1
  ) {
    return { success: false, error: "invalid_fields" };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(7000)) return { success: false, error: "service_busy" };

  try {
    const currentId = plainText_(system.quotes.getRange(rowNumber, 13).getValue(), 80);
    if (requestedId && currentId && requestedId !== currentId) {
      return { success: false, error: "stale_reference" };
    }

    const quoteId = currentId || generateQuoteId_("");
    system.quotes.getRange(rowNumber, 8, 1, 3)
      .setValues([[status, responsible, notes]]);
    system.quotes.getRange(rowNumber, 13, 1, 2)
      .setValues([[quoteId, new Date()]]);
    SpreadsheetApp.flush();

    const row = system.quotes
      .getRange(rowNumber, 1, 1, QUOTE_HEADERS.length)
      .getValues()[0];
    return { success: true, quote: rowToQuote_(row, rowNumber) };
  } finally {
    lock.releaseLock();
  }
}

function inventory_(system) {
  const values = system.stock.getRange(2, 1, 1, 5).getValues()[0];
  const cartons = Number(values[0]);
  const publicationActive = plainText_(values[4], 10).toUpperCase() === "OUI";
  const validQuantity = Number.isFinite(cartons) && cartons >= 0;
  const published = publicationActive && validQuantity;

  return {
    success: true,
    published: published,
    cartons: published ? cartons : null,
    status: published ? plainText_(values[1], 60) : "",
    updatedAt: published ? asIso_(values[2]) : "",
    message: published ? plainText_(values[3], 240) : ""
  };
}

function health_(system) {
  return {
    success: Boolean(system.quotes && system.stock),
    schemaVersion: SCHEMA_VERSION
  };
}

function doGet() {
  return jsonResponse_({
    success: true,
    service: "Zepoul Ayiti - opérations commerciales"
  });
}

function doPost(event) {
  try {
    const request = parseRequest_(event);
    const configuredSecret = PropertiesService
      .getScriptProperties()
      .getProperty("WORKER_SHARED_SECRET");

    if (!configuredSecret || !secureEquals_(request.secret, configuredSecret)) {
      return jsonResponse_({ success: false, error: "unauthorized" });
    }

    const system = ensureSystem_();
    const action = plainText_(request.action, 60);
    const payload = request.payload || {};

    if (action === "create_quote") return jsonResponse_(createQuote_(system, payload));
    if (action === "inventory") return jsonResponse_(inventory_(system));
    if (action === "list_quotes") return jsonResponse_(listQuotes_(system, payload));
    if (action === "update_quote_status") {
      return jsonResponse_(updateQuoteStatus_(system, payload));
    }
    if (action === "health") return jsonResponse_(health_(system));

    return jsonResponse_({ success: false, error: "unknown_action" });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ success: false, error: "server_error" });
  }
}
