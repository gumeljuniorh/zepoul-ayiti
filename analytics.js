(function () {
  var MEASUREMENT_ID = "G-XXXXXXXXXX";
  if (!MEASUREMENT_ID || MEASUREMENT_ID === "G-XXXXXXXXXX") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(s);

  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);
})();

