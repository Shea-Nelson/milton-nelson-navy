(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var navToggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector("#site-nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var filters = document.querySelectorAll(".filters button");
  var prints = Array.prototype.slice.call(document.querySelectorAll(".album .print"));
  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      var name = button.getAttribute("data-filter");
      filters.forEach(function (other) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      prints.forEach(function (figure) {
        var tags = (figure.getAttribute("data-tags") || "").split(/\s+/);
        var show = name === "all" || tags.indexOf(name) !== -1;
        figure.hidden = !show;
      });
    });
  });

  var dialog = document.getElementById("lightbox");
  var lbImg = document.getElementById("lb-img");
  var lbCaption = document.getElementById("lb-caption");
  var lbClose = document.getElementById("lb-close");
  var lbPrev = document.getElementById("lb-prev");
  var lbNext = document.getElementById("lb-next");
  var opener = null;
  var index = 0;

  function visibleOpens() {
    var root = document;
    if (opener) {
      var album = opener.closest(".album");
      if (album) root = album;
    }
    return Array.prototype.slice.call(root.querySelectorAll(".print-open")).filter(function (button) {
      var figure = button.closest(".print");
      return figure && !figure.hidden;
    });
  }

  function showAt(i) {
    var buttons = visibleOpens();
    if (!buttons.length || !dialog) return;
    index = (i + buttons.length) % buttons.length;
    var button = buttons[index];
    var img = button.querySelector("img");
    var figure = button.closest("figure");
    var caption = figure ? figure.querySelector("figcaption") : null;
    lbImg.src = img ? img.currentSrc || img.src : "";
    lbImg.alt = img ? img.alt : "";
    lbCaption.innerHTML = caption ? caption.innerHTML : "";
    if (!dialog.open) dialog.showModal();
  }

  document.querySelectorAll(".print-open").forEach(function (button) {
    button.addEventListener("click", function () {
      opener = button;
      var buttons = visibleOpens();
      showAt(buttons.indexOf(button));
    });
  });

  function shut() {
    if (!dialog || !dialog.open) return;
    dialog.close();
    lbImg.removeAttribute("src");
    if (opener) opener.focus();
  }

  if (lbClose) lbClose.addEventListener("click", shut);
  if (lbPrev) lbPrev.addEventListener("click", function () { showAt(index - 1); });
  if (lbNext) lbNext.addEventListener("click", function () { showAt(index + 1); });
  if (dialog) {
    dialog.addEventListener("cancel", function () {
      lbImg.removeAttribute("src");
    });
    dialog.addEventListener("close", function () {
      if (opener) opener.focus();
    });
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") { event.preventDefault(); showAt(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); showAt(index + 1); }
    });
  }

  var stops = Array.prototype.slice.call(document.querySelectorAll(".stop"));
  var status = document.getElementById("map-status");

  function setActive(stop, pan) {
    stops.forEach(function (item) {
      var on = item === stop;
      item.classList.toggle("is-active", on);
      var btn = item.querySelector(".stop-btn");
      if (btn) btn.setAttribute("aria-current", on ? "true" : "false");
    });
    if (!stop) return;
    if (pan && window.nelsonMapPin) window.nelsonMapPin(stop);
    if (pan) stop.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }

  stops.forEach(function (stop) {
    var btn = stop.querySelector(".stop-btn");
    if (!btn) return;
    btn.addEventListener("click", function () { setActive(stop, true); });
  });

  var prevBtn = document.getElementById("voyage-prev");
  var nextBtn = document.getElementById("voyage-next");
  function step(dir) {
    var current = document.querySelector(".stop.is-active");
    var i = stops.indexOf(current);
    if (i < 0) i = dir > 0 ? -1 : 0;
    var next = stops[(i + dir + stops.length) % stops.length];
    setActive(next, true);
    var btn = next.querySelector(".stop-btn");
    if (btn) btn.focus();
  }
  if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });

  function bootMap() {
    var holder = document.getElementById("map");
    if (!holder || typeof L === "undefined") {
      if (status) status.textContent = "The map could not be loaded. The voyage is written out in the list beside it.";
      return;
    }
    var map = L.map(holder, { scrollWheelZoom: false, minZoom: 2 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 16,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var markers = [];
    var line = [];
    stops.forEach(function (stop) {
      var btn = stop.querySelector(".stop-btn");
      var lat = parseFloat(stop.getAttribute("data-lat"));
      var lng = parseFloat(stop.getAttribute("data-lng"));
      if (!isFinite(lat) || !isFinite(lng)) return;
      // Draw the voyage across the Pacific. Western-Pacific longitudes are
      // shifted into the same world copy as California so the line does not
      // run the long way, east across Africa.
      if (lng > 0) lng -= 360;
      var num = stop.getAttribute("data-num");
      var marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "pin-wrap",
          html: '<span class="pin">' + num + "</span>",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18]
        }),
        keyboard: true,
        title: btn ? btn.querySelector(".where").textContent : "Stop"
      });
      var where = btn ? btn.querySelector(".where").textContent : "";
      var when = btn ? btn.querySelector(".when").textContent : "";
      var summary = stop.getAttribute("data-summary") || "";
      function esc(value) {
        return String(value).replace(/[&<>"']/g, function (ch) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
      }
      marker.bindPopup("<strong>" + esc(num) + ". " + esc(where) + "</strong><p>" + esc(when) + "</p><p>" + esc(summary) + "</p>");
      marker.on("click", function () { setActive(stop, false); });
      marker.addTo(map);
      stop._marker = marker;
      markers.push(marker);
      line.push([lat, lng]);
    });

    if (line.length) {
      L.polyline(line, {
        color: "#9a7340",
        weight: 2,
        opacity: 0.85,
        dashArray: "7 8"
      }).addTo(map);
      map.fitBounds(L.latLngBounds(line).pad(0.12));
    }

    window.nelsonMapPin = function (stop) {
      markers.forEach(function (marker) {
        var el = marker.getElement();
        if (!el) return;
        var pin = el.querySelector(".pin");
        if (pin) pin.classList.remove("is-active");
      });
      if (!stop._marker) {
        if (status) status.textContent = "This stop is on the timeline only. The cruise book does not give a longitude, so it is not pinned.";
        return;
      }
      var el = stop._marker.getElement();
      if (el) {
        var pin = el.querySelector(".pin");
        if (pin) pin.classList.add("is-active");
      }
      var zoom = Math.max(map.getZoom(), 5);
      var targetZoom = stop.hasAttribute("data-zoom") ? parseInt(stop.getAttribute("data-zoom"), 10) : zoom;
      var latlng = stop._marker.getLatLng();
      if (reduceMotion) map.setView(latlng, targetZoom);
      else map.flyTo(latlng, targetZoom, { duration: 0.8 });
      stop._marker.openPopup();
      if (status) status.textContent = "Showing stop " + stop.getAttribute("data-num") + " on the map.";
    };

    var hash = decodeURIComponent(location.hash || "");
    var fromHash = hash ? document.querySelector(hash) : null;
    if (fromHash && fromHash.classList.contains("stop")) setActive(fromHash, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootMap);
  } else {
    bootMap();
  }
})();
