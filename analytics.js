(function () {
  // Remplacez par votre identifiant GA4 réel (format : G-XXXXXXXXXX).
  var DEFAULT_MEASUREMENT_ID = "G-XXXXXXXXXX";
  var MEASUREMENT_ID = (window.GA4_MEASUREMENT_ID || DEFAULT_MEASUREMENT_ID || "").trim();
  var isValidMeasurementId = /^G-[A-Z0-9]{6,12}$/i.test(MEASUREMENT_ID);
  if (!isValidMeasurementId || MEASUREMENT_ID === DEFAULT_MEASUREMENT_ID) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(s);

  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });
})();
