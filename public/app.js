const form = document.getElementById('build-form');
const statusEl = document.getElementById('status');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');

// There's no exact "% complete" signal from Gradle, so we simulate a smooth
// ramp based on elapsed time: fast at first, slowing as it approaches a
// 95% ceiling, then snapped to 100% the moment the real status says "done".
// EXPECTED_MS is roughly how long a typical build takes; tune if your
// builds consistently run faster/slower once warmed up.
const EXPECTED_MS = 3 * 60 * 1000; // ~3 minutes
let progressTimer = null;
let buildStartedAt = null;

function setProgress(pct, kind) {
  const clamped = Math.max(0, Math.min(100, pct));
  progressFill.style.width = `${clamped}%`;
  progressFill.className = `progress-fill ${kind || ''}`.trim();
  progressLabel.textContent = `${Math.round(clamped)}%`;
}

function startProgressAnimation() {
  progressContainer.hidden = false;
  buildStartedAt = Date.now();
  setProgress(0, '');

  progressTimer = setInterval(() => {
    const elapsed = Date.now() - buildStartedAt;
    // Asymptotic curve approaching 95%, never reaching it on its own.
    const pct = 95 * (1 - Math.exp(-elapsed / (EXPECTED_MS / 3)));
    setProgress(pct, '');
  }, 400);
}

function finishProgressAnimation(kind) {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (kind === 'error') {
    setProgress(progressFill.style.width ? parseFloat(progressFill.style.width) : 0, 'error');
  } else {
    setProgress(100, 'done');
  }
}

function showStatus(message, kind) {
  statusEl.hidden = false;
  statusEl.className = `status ${kind || ''}`;
  statusEl.innerHTML = message;
}

async function pollJob(jobId) {
  const res = await fetch(`/api/build/${jobId}`);
  const data = await res.json();

  if (data.status === 'building') {
    showStatus('Building your APK… this can take a few minutes the first time (Gradle downloads dependencies).', '');
    setTimeout(() => pollJob(jobId), 3000);
    return;
  }

  if (data.status === 'done') {
    finishProgressAnimation('done');
    showStatus(
      `Done! Package: <code>${data.packageId}</code><br/><a href="/api/download/${jobId}">Download APK</a>`,
      'ok'
    );
    return;
  }

  finishProgressAnimation('error');
  showStatus(
    `Build failed. <a href="/api/build/${jobId}/log" target="_blank">View log</a>`,
    'error'
  );
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  showStatus('Submitting build…', '');

  try {
    const res = await fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      showStatus(data.error || 'Something went wrong.', 'error');
      submitBtn.disabled = false;
      return;
    }

    startProgressAnimation();
    pollJob(data.jobId);
  } catch (err) {
    showStatus('Network error: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
