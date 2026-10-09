const path = require('path');
const fs = require('fs-extra');
const express = require('express');
const { nanoid } = require('nanoid');
const { buildApk } = require('../lib/bubblewrap');

const router = express.Router();

const WORKDIR = path.join(__dirname, '..', '..', 'workdir');
const BUILDS_DIR = path.join(__dirname, '..', '..', 'builds');

// In-memory job tracking. Swap for Redis/a DB if you need this to survive
// restarts or run across multiple server instances.
const jobs = new Map();

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

router.post('/build', async (req, res) => {
  const { url, appName, shortName, packageId, themeColor, backgroundColor, iconUrl } = req.body || {};

  if (!url || !isValidHttpUrl(url)) {
    return res.status(400).json({ error: 'Provide a valid http(s) URL.' });
  }
  if (!appName || !appName.trim()) {
    return res.status(400).json({ error: 'App name is required.' });
  }

  const jobId = nanoid(10);
  const jobDir = path.join(WORKDIR, jobId);
  jobs.set(jobId, { status: 'building', createdAt: Date.now() });

  res.status(202).json({ jobId, status: 'building' });

  try {
    const result = await buildApk(jobDir, {
      targetUrl: url,
      appName: appName.trim(),
      shortName: (shortName || appName).trim(),
      packageId,
      themeColor,
      backgroundColor,
      iconUrl,
    });

    if (!result.success) {
      jobs.set(jobId, { status: 'failed', log: result.log });
      return;
    }

    await fs.ensureDir(BUILDS_DIR);
    const finalApkPath = path.join(BUILDS_DIR, `${jobId}.apk`);
    await fs.move(result.apkPath, finalApkPath, { overwrite: true });

    jobs.set(jobId, {
      status: 'done',
      apkFile: `${jobId}.apk`,
      packageId: result.manifest.packageId,
      log: result.log,
    });
  } catch (err) {
    jobs.set(jobId, {
      status: 'failed',
      error: err.message,
      log: (err.stdout || '') + '\n' + (err.stderr || ''),
    });
  } finally {
    // Clean up the Gradle project but keep the final APK in BUILDS_DIR.
    fs.remove(jobDir).catch(() => {});
  }
});

router.get('/build/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Unknown job id.' });
  res.json({ jobId: req.params.jobId, ...job, log: undefined });
});

router.get('/build/:jobId/log', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Unknown job id.' });
  res.type('text/plain').send(job.log || '');
});

router.get('/download/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'done') {
    return res.status(404).json({ error: 'Build not ready or not found.' });
  }
  const apkPath = path.join(BUILDS_DIR, job.apkFile);
  if (!(await fs.pathExists(apkPath))) {
    return res.status(404).json({ error: 'APK file missing.' });
  }
  res.download(apkPath, `${job.packageId || 'app'}.apk`);
});

module.exports = router;
