const form = document.getElementById('build-form');
const statusEl = document.getElementById('status');

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
    showStatus(
      `Done! Package: <code>${data.packageId}</code><br/><a href="/api/download/${jobId}">Download APK</a>`,
      'ok'
    );
    return;
  }

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

    pollJob(data.jobId);
  } catch (err) {
    showStatus('Network error: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
