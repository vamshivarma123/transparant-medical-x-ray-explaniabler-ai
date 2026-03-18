const form = document.getElementById("analyze-form");
const button = document.getElementById("analyze-btn");
const statusBox = document.getElementById("status");
const results = document.getElementById("results");
const reportId = document.getElementById("report-id");
const loadingOverlay = document.getElementById("loading-overlay");

const predictionList = document.getElementById("prediction-list");
const overall = document.getElementById("overall");
const meta = document.getElementById("meta");
const nextSteps = document.getElementById("next-steps");
const safety = document.getElementById("safety");

const patientDetails = document.getElementById("patient-details");
const patientSmoking = document.getElementById("patient-smoking");
const patientSpo2 = document.getElementById("patient-spo2");
const patientDate = document.getElementById("patient-date");

const xrayInput = document.getElementById("xray");
const xrayPreview = document.getElementById("xray-preview");
const imagePlaceholder = document.getElementById("image-placeholder");
const heatmapToggle = document.getElementById("heatmap-toggle");
const heatmapOverlay = document.getElementById("heatmap-overlay");

const primaryTitle = document.getElementById("primary-title");
const primaryScore = document.getElementById("primary-score");
const primaryText = document.getElementById("primary-text");
const primaryTags = document.getElementById("primary-tags");
const driversList = document.getElementById("drivers-list");
const aiExplanation = document.getElementById("ai-explanation");
const secondaryList = document.getElementById("secondary-list");

const ageInput = document.getElementById("age");
const sexInput = document.getElementById("sex");
const smokingInput = document.getElementById("smoking_history");
const spo2Input = document.getElementById("spo2");
const dateInput = document.getElementById("scan_date");

let previewObjectUrl = null;

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.remove("hidden", "error");
  if (isError) {
    statusBox.classList.add("error");
  }
}

function clearStatus() {
  statusBox.classList.add("hidden");
  statusBox.classList.remove("error");
  statusBox.textContent = "";
}

function setLoading(isLoading) {
  loadingOverlay.classList.toggle("hidden", !isLoading);
}

function clearResults() {
  results.classList.remove("hidden");
  predictionList.innerHTML = "";
  nextSteps.innerHTML = "<li>Upload a valid X-ray image and run analysis.</li>";
  secondaryList.innerHTML = "<li><strong>Awaiting analysis</strong><small>Secondary findings will be listed here.</small></li>";
  driversList.innerHTML = "";
  primaryTags.innerHTML = '<span class="tag ghost-tag">No finding tags yet</span>';
  overall.textContent = "No analysis has been executed yet.";
  meta.textContent = "Exam: Chest X-ray • Urgency: pending • Source: Model";
  safety.textContent = "AI output is assistive only and requires physician/radiologist confirmation.";
  primaryTitle.textContent = "Awaiting analysis";
  primaryScore.textContent = "--%";
  primaryText.textContent = "Upload an X-ray image to generate the primary finding narrative.";
  aiExplanation.textContent = "Upload an image to generate clinical and plain-language explanation.";

  driversList.appendChild(createDriverRow("Awaiting model output", 0, "Driver metrics appear after analysis."));
}

function normalizeConfidence(value) {
  const v = (value || "low").toLowerCase();
  if (["high", "medium", "low"].includes(v)) return v;
  return "low";
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createReportId() {
  const random = Math.floor(10000 + Math.random() * 90000);
  reportId.textContent = `#XR-${random}`;
}

function renderPatientStrip() {
  const age = ageInput.value?.trim();
  const sex = sexInput.value?.trim();
  const smoking = smokingInput.value?.trim();
  const spo2 = spo2Input.value?.trim();
  const date = dateInput.value;

  patientDetails.textContent = `${age || "N/A"} ${sex || "-"}`;
  patientSmoking.textContent = smoking || "Not provided";
  patientSpo2.textContent = spo2 || "Not provided";
  patientDate.textContent = date ? new Date(date).toLocaleDateString() : "Not provided";
}

function showImagePreview() {
  const file = xrayInput.files?.[0];
  if (!file) {
    xrayPreview.removeAttribute("src");
    imagePlaceholder.classList.remove("hidden");
    return;
  }
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
  }
  previewObjectUrl = URL.createObjectURL(file);
  xrayPreview.src = previewObjectUrl;
  imagePlaceholder.classList.add("hidden");
}

function createDriverRow(label, value, note = "") {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const row = document.createElement("div");
  row.className = "driver-row";
  row.innerHTML = `
    <div class="driver-head">
      <strong>${esc(label)}</strong>
      <span>${clamped}%</span>
    </div>
    <div class="driver-track"><span style="width:${clamped}%"></span></div>
    <small>${esc(note || "Derived from model evidence")}</small>
  `;
  return row;
}

function renderPrimaryFinding(topPrediction) {
  if (!topPrediction) {
    primaryTitle.textContent = "No finding generated";
    primaryScore.textContent = "0%";
    primaryText.textContent = "AI did not return a primary disease prediction.";
    return;
  }

  primaryTitle.textContent = topPrediction.disease || "Unspecified finding";
  primaryScore.textContent = `${Math.max(0, Math.min(100, Number(topPrediction.likelihood) || 0))}%`;
  primaryText.textContent =
    topPrediction.explanation_clinical || topPrediction.explanation_plain || "No explanation returned.";

  (topPrediction.supporting_findings || []).slice(0, 4).forEach((finding) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = finding;
    primaryTags.appendChild(tag);
  });
}

function renderDecisionDrivers(predictions) {
  const candidates = (predictions || []).slice(0, 4);
  if (!candidates.length) {
    driversList.appendChild(createDriverRow("No drivers available", 0, "No model predictions."));
    return;
  }

  candidates.forEach((entry) => {
    const findingText = (entry.supporting_findings || [])[0] || "Pattern confidence from model output";
    driversList.appendChild(createDriverRow(entry.disease || "Unspecified", entry.likelihood ?? 0, findingText));
  });
}

function renderSecondaryFindings(predictions) {
  const secondary = (predictions || []).slice(1, 5);
  if (!secondary.length) {
    const li = document.createElement("li");
    li.textContent = "No secondary findings generated.";
    secondaryList.appendChild(li);
    return;
  }

  secondary.forEach((entry) => {
    const li = document.createElement("li");
    const context = (entry.contradicting_findings || [])[0] || (entry.supporting_findings || [])[0] || "No note";
    li.innerHTML = `<strong>${esc(entry.disease || "Unspecified")}</strong><small>${esc(context)}</small>`;
    secondaryList.appendChild(li);
  });
}

function createPredictionCard(item) {
  const confidence = normalizeConfidence(item.confidence_label);
  const card = document.createElement("article");
  card.className = "prediction-card";

  const findingList = (arr = []) =>
    arr.length
      ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>`
      : "<p>Not specified</p>";

  card.innerHTML = `
    <div class="prediction-header">
      <h3>${esc(item.disease || "Unspecified condition")}</h3>
      <div>
        <strong>${Math.max(0, Math.min(100, Number(item.likelihood) || 0))}%</strong>
        <span class="chip ${confidence}">${confidence}</span>
      </div>
    </div>
    <div class="meter"><span style="width: ${Math.max(0, Math.min(100, Number(item.likelihood) || 0))}%;"></span></div>

    <div class="term-group">
      <div class="term-title">Plain-language explanation</div>
      <p>${esc(item.explanation_plain || "Not provided.")}</p>
    </div>

    <div class="term-group">
      <div class="term-title">Clinical terminology</div>
      <p>${esc(item.explanation_clinical || "Not provided.")}</p>
    </div>

    <div class="term-group">
      <div class="term-title">Supporting visual findings</div>
      ${findingList(item.supporting_findings || [])}
    </div>

    <div class="term-group">
      <div class="term-title">Contradicting findings / uncertainty</div>
      ${findingList(item.contradicting_findings || [])}
    </div>
  `;

  return card;
}

function renderResults(data) {
  driversList.innerHTML = "";
  secondaryList.innerHTML = "";
  primaryTags.innerHTML = "";
  predictionList.innerHTML = "";
  nextSteps.innerHTML = "";

  meta.textContent = `Exam: ${data.exam_type || "Chest X-ray"} • Urgency: ${data.urgency || "routine"} • Source: ${data.source || "Model"}`;
  overall.textContent = data.overall_impression || "No overall impression provided.";
  safety.textContent = data.safety_notice || "Always confirm with a licensed clinician/radiologist.";

  const predictions = Array.isArray(data.predictions) ? data.predictions : [];
  const topPrediction = [...predictions].sort((a, b) => (Number(b.likelihood) || 0) - (Number(a.likelihood) || 0))[0];

  renderPatientStrip();
  renderPrimaryFinding(topPrediction);
  renderDecisionDrivers(predictions);
  renderSecondaryFindings(predictions);
  aiExplanation.textContent =
    topPrediction?.explanation_clinical || topPrediction?.explanation_plain || "No detailed explanation returned.";

  (data.recommended_next_steps || []).forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    nextSteps.appendChild(li);
  });

  predictions.forEach((item) => {
    predictionList.appendChild(createPredictionCard(item));
  });
}

clearResults();
createReportId();

xrayInput.addEventListener("change", showImagePreview);
heatmapToggle.addEventListener("change", () => {
  heatmapOverlay.classList.toggle("hidden", !heatmapToggle.checked);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();
  clearResults();
  createReportId();
  showImagePreview();

  const formData = new FormData(form);
  button.disabled = true;
  setLoading(true);
  setStatus("Model is analyzing the X-ray and building explainable findings...");

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to analyze image.");
    }

    clearStatus();
    renderResults(payload);
  } catch (error) {
    setStatus(error.message || "Unexpected error while analyzing image.", true);
  } finally {
    button.disabled = false;
    setLoading(false);
  }
});
