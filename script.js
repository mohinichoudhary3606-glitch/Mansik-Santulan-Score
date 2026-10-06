// ============================================================
// CONFIG: change this one line to point at your FastAPI backend
// ============================================================
const API_URL = "http://127.0.0.1:8000/predict";

// Highest possible score, used to draw the gauge (change if your model uses a different scale)
const MAX_SCORE = 10;

// ---------- Field definitions ----------
// key = JSON key sent to the backend (also the form field's name/id)

  const NUMBER_FIELDS = {
  age: {
    label: "Age",
    min: 13,
    max: 60,
    unit: ""
  },

  avg_daily_usage_hours: {
    label: "Screen time",
    min: 0,
    max: 24,
    unit: " h/day"
  },

  daily_unlocks: {
    label: "Phone unlocks",
    min: 0,
    max: 500,
    unit: "/day"
  },

  study_hours: {
    label: "Study hours",
    min: 0,
    max: 24,
    unit: " h/day"
  },

  sleep_hours_per_night: {
    label: "Sleep hours",
    min: 0,
    max: 24,
    unit: " h/night"
  },

  physical_activity_hours: {
    label: "Physical activity",
    min: 0,
    max: 24,
    unit: " h/day"
  }
};
const TEXT_FIELDS = {
  gender:             "Please choose a gender.",
  country:            "Please enter your country.",
  academic_level:     "Please choose your academic level.",
  most_used_platform: "Please choose a platform.",
  purpose_of_use:    "Please choose a purpose."
};
// Labels shown in the "Information You Submitted" cards, in display order
const SUMMARY = [
["Main purpose", "purpose_of_use", ""],
["Screen time", "avg_daily_usage_hours", " h/day"],
["Phone unlocks", "daily_unlocks", "/day"],
["Study", "study_hours", " h/day"],
["Sleep", "sleep_hours_per_night", " h/night"],
];

// ---------- Elements ----------
const form = document.getElementById("predictForm");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");
const btnText = submitBtn.querySelector(".btn-text");
const resultSection = document.getElementById("resultSection");
const gaugeBar = document.getElementById("gaugeBar");
const GAUGE_LENGTH = 2 * Math.PI * 95; // circle circumference (r = 95)

// ---------- Validation helpers ----------
function setFieldError(inputEl, message) {
  const field = inputEl.closest(".field");
  field.classList.toggle("invalid", Boolean(message));
  field.querySelector(".error-msg").textContent = message || "";
}

function validateForm() {
  let firstInvalid = null;
  const fail = (el, msg) => {
    setFieldError(el, msg);
    if (!firstInvalid) firstInvalid = el;
  };

  for (const [key, rule] of Object.entries(NUMBER_FIELDS)) {
    const el = form.elements[key];
    const raw = el.value.trim();
    const num = Number(raw);
    if (raw === "") {
      fail(el, `${rule.label} is required.`);
    } else if (Number.isNaN(num) || num < rule.min || num > rule.max) {
      fail(el, `${rule.label} must be between ${rule.min} and ${rule.max}.`);
    } else {
      setFieldError(el, "");
    }
  }

  for (const [key, message] of Object.entries(TEXT_FIELDS)) {
    const el = form.elements[key];
    if (el.value.trim() === "") fail(el, message);
    else setFieldError(el, "");
  }

  const stress = form.querySelector('input[name="stress_level"]:checked');
  const firstStress = document.getElementById("stress1");
  if (!stress) fail(firstStress, "Please select a stress level.");
  else setFieldError(firstStress, "");

  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

// Clear an error as soon as the user fixes the field
form.addEventListener("input", (e) => {
  if (e.target.closest(".field.invalid")) setFieldError(e.target, "");
});

// ---------- Collect form data ----------
function collectFormData() {
  const data = {};
  for (const key of Object.keys(NUMBER_FIELDS)) data[key] = Number(form.elements[key].value);
  for (const key of Object.keys(TEXT_FIELDS)) data[key] = form.elements[key].value.trim();
  data.stress_level = form.querySelector('input[name="stress_level"]:checked').value;
  return data;
}

// ---------- API call ----------
async function requestPrediction(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    let detail = "";
    try { detail = JSON.stringify((await response.json()).detail || ""); } catch (_) {}
    throw new Error(`Server responded with status ${response.status}. ${detail}`);
  }
  return response.json();
}

// Pulls the score out of the FastAPI response.
// Edit here if your backend uses a different key.
function extractScore(data) {
  const candidate =
    data.predicted_mental_health_score;
  const value = Array.isArray(candidate) ? candidate[0] : candidate;
  const score = Number(value);
  if (!Number.isFinite(score)) {
    throw new Error("The response did not contain a valid score.");
  }
  return score;
}

// ---------- Loading state ----------
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("loading", isLoading);
  btnText.textContent = isLoading ? "Generating your prediction…" : "Predict Mental Health Score";
}

// ---------- Result display ----------
function describeScore(score) {
  const ratio = score / MAX_SCORE;
  if (ratio >= 0.75) return ["Doing well", "Your habits are associated with a higher predicted score. Keep up the routines that work for you."];
  if (ratio >= 0.5)  return ["Fairly balanced", "Your habits point to a moderate score. Small changes to sleep, screen time or breaks could make a difference."];
  return ["Room to recharge", "Your habits are associated with a lower predicted score. Consider more rest and downtime, and talk to someone you trust if things feel heavy."];
}

function displayResult(score, payload) {
  const clamped = Math.max(0, Math.min(MAX_SCORE, score));
  document.getElementById("scoreValue").textContent = clamped.toFixed(1);
  document.getElementById("scoreMax").textContent = `out of ${MAX_SCORE}`;

  const [band, text] = describeScore(clamped);
  document.getElementById("scoreBand").textContent = band;
  document.getElementById("scoreText").textContent = text;

  const chips = document.getElementById("submittedChips");
  chips.textContent = "";
  SUMMARY.forEach(([label, key, unit]) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    const small = document.createElement("small");
    small.textContent = label;
    const value = document.createElement("b");
    value.textContent = `${payload[key]}${unit}`;
    chip.append(small, value);
    chips.appendChild(chip);
  });

  gaugeBar.style.strokeDasharray = GAUGE_LENGTH;
  gaugeBar.style.strokeDashoffset = GAUGE_LENGTH;

  form.closest("section").hidden = true;
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

  // Animate the gauge after the section is visible
  requestAnimationFrame(() => requestAnimationFrame(() => {
    gaugeBar.style.strokeDashoffset = GAUGE_LENGTH * (1 - clamped / MAX_SCORE);
  }));
}

// ---------- Submit handler ----------
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;

  if (!validateForm()) {
    formError.textContent = "Please fix the highlighted fields and try again.";
    formError.hidden = false;
    return;
  }

  const payload = collectFormData();
  setLoading(true);
  try {
    const data = await requestPrediction(payload);
    displayResult(extractScore(data), payload);
  } catch (err) {
    console.error(err);
    formError.textContent =
      `We couldn't get a prediction. Check that your backend is running at ${API_URL} and that CORS is enabled. (${err.message})`;
    formError.hidden = false;
    formError.scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    setLoading(false);
  }
});

// ---------- Predict Again ----------
document.getElementById("againBtn").addEventListener("click", () => {
  form.reset();
  form.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  formError.hidden = true;
  resultSection.hidden = true;
  form.closest("section").hidden = false;
  document.getElementById("predict").scrollIntoView({ behavior: "smooth", block: "start" });
});
