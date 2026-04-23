const video = document.getElementById("video");
const startCameraBtn = document.getElementById("startCameraBtn");
const gpsBtn = document.getElementById("gpsBtn");
const loadModelBtn = document.getElementById("loadModelBtn");
const captureBtn = document.getElementById("captureBtn");
const sendSnapshotBtn = document.getElementById("sendSnapshotBtn");

const snapshotCanvas = document.getElementById("snapshotCanvas");
const snapshotPreview = document.getElementById("snapshotPreview");
const downloadSnapBtn = document.getElementById("downloadSnapBtn");

const latText = document.getElementById("latText");
const lonText = document.getElementById("lonText");
const statusBox = document.getElementById("statusBox");

let currentStream = null;
let currentLocation = null;
let latestSnapshotBlob = null;

function setStatus(message) {
  statusBox.textContent = message;
}

startCameraBtn.addEventListener("click", startCamera);
gpsBtn.addEventListener("click", getLocation);
loadModelBtn.addEventListener("click", loadModel);
captureBtn.addEventListener("click", captureSnapshot);
sendSnapshotBtn.addEventListener("click", sendSnapshotToBackend);

async function startCamera() {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;
    setStatus("✅ Camera opened successfully.");
  } catch (err) {
    console.error(err);
    setStatus("❌ Camera open failed: " + err.message);
  }
}

function getLocation() {
  if (!navigator.geolocation) {
    setStatus("❌ Geolocation is not supported in this browser.");
    return;
  }

  setStatus("Fetching GPS location...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      latText.textContent = currentLocation.latitude;
      lonText.textContent = currentLocation.longitude;

      setStatus("✅ GPS fetched successfully.");
    },
    (error) => {
      console.error(error);
      setStatus("❌ GPS fetch failed: " + error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

async function loadModel() {
  setStatus("ℹ️ Prototype mode: inference will run on backend. Camera + GPS + backend event flow are the focus now.");
}

function captureSnapshot() {
  try {
    if (!video || video.readyState < 2) {
      setStatus("❌ Camera is not ready yet.");
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setStatus("❌ Video frame not available.");
      return;
    }

    snapshotCanvas.width = width;
    snapshotCanvas.height = height;

    const ctx = snapshotCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    snapshotCanvas.toBlob((blob) => {
      if (!blob) {
        setStatus("❌ Snapshot blob creation failed.");
        return;
      }

      latestSnapshotBlob = blob;

      const imageUrl = URL.createObjectURL(blob);
      snapshotPreview.src = imageUrl;
      snapshotPreview.style.display = "block";

      downloadSnapBtn.href = imageUrl;
      downloadSnapBtn.style.display = "inline-block";

      setStatus("✅ Snapshot captured successfully.");
    }, "image/jpeg", 0.85);

  } catch (err) {
    console.error(err);
    setStatus("❌ Snapshot capture failed: " + err.message);
  }
}

async function sendSnapshotToBackend() {
  try {
    if (!latestSnapshotBlob) {
      setStatus("❌ Capture a snapshot first.");
      return;
    }

    const formData = new FormData();
    formData.append("image", latestSnapshotBlob, "roadsense_snapshot.jpg");
    formData.append("device_name", "phone-browser-test");
    formData.append("latitude", currentLocation?.latitude ?? 12.9716);
    formData.append("longitude", currentLocation?.longitude ?? 80.1940);
    formData.append("speed_kmph", 18.5);
    formData.append("detected_at", new Date().toISOString());

    const res = await fetch("https://roadsense-backend-v2.onrender.com/api/detect/", {
      method: "POST",
      body: formData
    });

    const text = await res.text();
    console.log("Detect response:", res.status, text);
    setStatus(`Detect POST status: ${res.status}\n${text}`);
  } catch (err) {
    console.error(err);
    setStatus("❌ Send snapshot failed: " + err.message);
  }
}
