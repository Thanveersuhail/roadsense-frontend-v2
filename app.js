const map = L.map("map").setView([10.6605, 77.0085], 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);
const classColors = {
  pothole: "#dc2626",
  longitudinal_crack: "#2563eb",
  transverse_crack: "#7c3aed",
  alligator_crack: "#d97706",
  patch_repair: "#059669",
  other_surface_damage: "#475569"
};
const activityListEl = document.getElementById("activityList");
const exportBtn = document.getElementById("exportBtn");
const tableBody = document.getElementById("eventsTableBody");
const totalEventsEl = document.getElementById("totalEvents");
const criticalEventsEl = document.getElementById("criticalEvents");
const maxSeverityEl = document.getElementById("maxSeverity");
const classFilterEl = document.getElementById("classFilter");
const severityFilterEl = document.getElementById("severityFilter");
const eventDetailsEl = document.getElementById("eventDetails");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const liveChip = document.getElementById("liveChip");
const criticalChip = document.getElementById("criticalChip");
const normalChip = document.getElementById("normalChip");

// ✅ NEW DOM references
const refreshBtn = document.getElementById("refreshBtn");
const lastUpdatedText = document.getElementById("lastUpdatedText");

let markersLayer = L.layerGroup().addTo(map);
let allEvents = [];

function createColorIcon(color) {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="
      background:${color};
      width:16px;
      height:16px;
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 0 0 2px rgba(0,0,0,0.15);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function formatClassName(value) {
  if (!value) return "Unknown";
  return String(value).replaceAll("_", " ");
}
function setLiveChipStatus(status) {
  liveChip.classList.remove("chip-live", "chip-loading", "chip-offline");

  if (status === "loading") {
    liveChip.textContent = "Refreshing...";
    liveChip.classList.add("chip", "chip-loading");
    return;
  }

  if (status === "offline") {
    liveChip.textContent = "Offline";
    liveChip.classList.add("chip", "chip-offline");
    return;
  }

  liveChip.textContent = "Live";
  liveChip.classList.add("chip", "chip-live");
}
function formatTime(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
function getSeverityStatus(severity) {
  if (severity >= 0.7) {
    return { label: "Critical", className: "status-critical" };
  }
  if (severity >= 0.4) {
    return { label: "Moderate", className: "status-moderate" };
  }
  return { label: "Low", className: "status-low" };
}

function showDefaultDetails() {
  eventDetailsEl.innerHTML = `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1.73 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"></path>
      </svg>
      <strong>Select an event from the table</strong>
      <p>Click any row to see anomaly details, images, and GPS location.</p>
    </div>
  `;
}
function showErrorDetails(message) {
  eventDetailsEl.innerHTML = `
    <div class="empty-state">
      <strong>Data load failed</strong>
      ${message}
    </div>
  `;
}

function showEventDetails(event) {
  const status = getSeverityStatus(event.severity);

  function buildUrl(path) {
    if (!path) return null;
    const clean = String(path).replace(/^\/+/, "");
    return clean.startsWith("http://") || clean.startsWith("https://")
      ? clean
      : `https://roadsense-backend-v2.onrender.com${clean}`;
  }

  const cropUrl = buildUrl(event.image_crop_path);
  const frameUrl = buildUrl(event.full_frame_path);

  eventDetailsEl.innerHTML = `
    <div class="detail-row"><span class="detail-label">Event ID:</span> ${event.id}</div>
    <div class="detail-row"><span class="detail-label">Device:</span> ${event.device?.name || "N/A"}</div>
    <div class="detail-row"><span class="detail-label">Class:</span> ${formatClassName(event.event_type)}</div>
    <div class="detail-row">
  <span class="detail-label">Severity:</span>
  <div style="display:flex;align-items:center;gap:8px;">
    <span>${event.severity}</span>
    <div style="flex:1;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
      <div style="width:${Math.min(event.severity*100,100)}%;height:100%;background:linear-gradient(90deg,#dc2626 0%,#d97706 50%,#059669 100%);"></div>
    </div>
  </div>
</div>
    <div class="detail-row"><span class="detail-label">Confidence:</span> ${event.confidence}</div>
    <div class="detail-row"><span class="detail-label">Speed:</span> ${event.speed_kmph ?? "N/A"} km/h</div>
    <div class="detail-row"><span class="detail-label">Detected at:</span> ${event.detected_at}</div>
    <div class="detail-row"><span class="detail-label">Created at:</span> ${event.created_at || "N/A"}</div>
    <div class="detail-row"><span class="detail-label">Latitude:</span> ${event.latitude}</div>
    <div class="detail-row"><span class="detail-label">Longitude:</span> ${event.longitude}</div>

    <div class="detail-row">
      <span class="detail-label">Crop preview:</span>
      ${cropUrl ? `<img src="${cropUrl}" alt="Crop preview" class="detail-preview-img">` : "N/A"}
    </div>

    <div class="detail-row">
      <span class="detail-label">Frame preview:</span>
      ${frameUrl ? `<img src="${frameUrl}" alt="Frame preview" class="detail-preview-img">` : "N/A"}
    </div>

    <div class="detail-row">
      <span class="detail-label">Crop path:</span>
      ${cropUrl ? `<a href="${cropUrl}" target="_blank" rel="noopener noreferrer">${event.image_crop_path}</a>` : "N/A"}
    </div>

    <div class="detail-row">
      <span class="detail-label">Frame path:</span>
      ${frameUrl ? `<a href="${frameUrl}" target="_blank" rel="noopener noreferrer">${event.full_frame_path}</a>` : "N/A"}
    </div>

    <div class="detail-row">
      <span class="detail-label">Status:</span>
      <span class="status-pill ${status.className}">${status.label}</span>
    </div>
  `;
  attachImageFallbacks();
}

function attachImageFallbacks() {
  const imgs = eventDetailsEl.querySelectorAll("img.detail-preview-img");
  imgs.forEach(img => {
    img.addEventListener("error", () => {
      const wrapper = document.createElement("span");
      wrapper.className = "detail-preview-fallback";
      wrapper.textContent = "Image not available";
      img.replaceWith(wrapper);
    });
  });
}
function getFilteredEvents() {
  const selectedClass = classFilterEl.value;
  const minSeverity = parseFloat(severityFilterEl.value);

  return allEvents.filter(event => {
    const classMatch = selectedClass === "all" || event.event_type === selectedClass;
    const severityMatch = parseFloat(event.severity) >= minSeverity;
    return classMatch && severityMatch;
  });
}

function renderDashboard(events) {
  tableBody.innerHTML = "";
  markersLayer.clearLayers();

  const criticalCount = events.filter(e => parseFloat(e.severity) >= 0.7).length;
  const normalCount = events.filter(e => parseFloat(e.severity) < 0.7).length;

  criticalChip.textContent = `Critical: ${criticalCount}`;
  normalChip.textContent = `Normal: ${normalCount}`;

  const classCounts = events.reduce((acc, event) => {
    const type =
      event.event_type ||
      event.class_name ||
      event.anomaly_type ||
      event.damage_type ||
      "other_surface_damage";

    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const mostCommonClass =
    Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  totalEventsEl.textContent = events.length;
  criticalEventsEl.textContent = criticalCount;
  maxSeverityEl.textContent = mostCommonClass.replaceAll("_", " ");

  if (events.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <strong>No events found</strong>
            No anomalies match the selected filters. Try changing class or severity.
          </div>
        </td>
      </tr>
    `;
    eventDetailsEl.innerHTML = `
      <div class="empty-state">
        <strong>No matching events</strong>
        Try changing the selected filters or reset them to view all data.
      </div>
    `;
    return;
  }

  showDefaultDetails();

  events.forEach(event => {
    const eventType =
      event.event_type ||
      event.class_name ||
      event.anomaly_type ||
      event.damage_type ||
      "other_surface_damage";

    const color = classColors[eventType] || "#334155";
    let marker = null;

    if (event.latitude != null && event.longitude != null) {
      marker = L.marker([event.latitude, event.longitude], {
        icon: createColorIcon(color)
      }).bindPopup(`
        <div class="popup-title">${formatClassName(eventType)}</div>
        <div class="popup-meta">
          Severity: ${event.severity ?? "N/A"}<br>
          Confidence: ${event.confidence ?? "N/A"}<br>
          Time: ${event.detected_at ?? "N/A"}<br>
          Lat: ${event.latitude}<br>
          Lon: ${event.longitude}
        </div>
      `);

      marker.addTo(markersLayer);
    }

    const row = document.createElement("tr");

    row.innerHTML = `
      <td><span class="badge ${eventType}">${formatClassName(eventType)}</span></td>
      <td>${event.severity ?? "N/A"}</td>
      <td>${event.confidence ?? "N/A"}</td>
      <td>${event.detected_at ?? "N/A"}</td>
    `;

    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      if (event.latitude != null && event.longitude != null && marker) {
        map.setView([event.latitude, event.longitude], 18);
        marker.openPopup();
      }
      showEventDetails(event);
    });

    tableBody.appendChild(row);
  });

  renderRecentActivity(events);
}
function applyFilters() {
  const filteredEvents = getFilteredEvents();
  renderDashboard(filteredEvents);
}
function renderRecentActivity(events) {
  const latest = [...events]
    .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
    .slice(0, 3);

  if (latest.length === 0) {
    activityListEl.innerHTML = `<div class="activity-item">No recent activity yet.</div>`;
    return;
  }

  activityListEl.innerHTML = latest.map(event => `
    <div class="activity-item">
      <strong>${formatClassName(event.event_type)}</strong> detected
      <span class="activity-time">${formatTime(event.detected_at)}</span>
    </div>
  `).join("");
}
function downloadCSV(rows) {
  const headers = ["id", "device", "event_type", "severity", "confidence", "latitude", "longitude", "speed_kmph", "detected_at", "created_at"];
  const csvRows = [headers.join(",")];

  rows.forEach(event => {
    const values = [
      event.id,
      `"${event.device?.name || ""}"`,
      event.event_type,
      event.severity,
      event.confidence,
      event.latitude,
      event.longitude,
      event.speed_kmph ?? "",
      event.detected_at,
      event.created_at || ""
    ];
    csvRows.push(values.join(","));
  });

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roadsense-events.csv";
  a.click();
  URL.revokeObjectURL(url);
}
function resetFilters() {
  classFilterEl.value = "all";
  severityFilterEl.value = "0";
  renderDashboard(allEvents);

}

// ✅ NEW helper
function setLastUpdatedNow() {
  const now = new Date();
  lastUpdatedText.textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

// ✅ UPDATED loader
async function loadEventsFromBackend() {
  try {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Loading...";
    setLiveChipStatus("loading");

    tableBody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="loading-note">Loading events from backend...</div>
        </td>
      </tr>
    `;

    const response = await fetch("https://roadsense-backend.onrender.com/api/events/?format=json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("First backend event:", data[0]);
    allEvents = data;
    renderDashboard(allEvents);
    setLiveChipStatus("live");
    setLastUpdatedNow();
  } catch (error) {
    console.error("Failed to load events:", error);
    setLiveChipStatus("offline");
    tableBody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <strong>Could not load backend data</strong>
            Check Django server and CORS/network settings.
          </div>
        </td>
      </tr>
    `;
    totalEventsEl.textContent = "0";
    criticalEventsEl.textContent = "0";
    maxSeverityEl.textContent = "0.00";
    showErrorDetails(error.message);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh Data";
  }
}

// ✅ Event listeners
classFilterEl.addEventListener("change", applyFilters);
severityFilterEl.addEventListener("change", applyFilters);
resetFiltersBtn.addEventListener("click", resetFilters);
refreshBtn.addEventListener("click", loadEventsFromBackend);
exportBtn.addEventListener("click", () => {
  downloadCSV(getFilteredEvents());
});
// ✅ Initial load
setLiveChipStatus("loading");
loadEventsFromBackend();
