const fs = require('fs-extra');
const path = require('path');
const { execFile } = require('child_process');
const { buildManifest } = require('./manifest');

const KEYSTORE_PASSWORD = process.env.HTML2APK_KEYSTORE_PASSWORD || 'html2apk-build';
const KEY_ALIAS = 'html2apk';

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts, maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Generates a debug-style signing keystore for this build if one doesn't
 * already exist in the job directory. In production you would reuse one
 * persistent keystore per app instead of minting a new one per build.
 */
async function ensureKeystore(jobDir) {
  const keystorePath = path.join(jobDir, 'android.keystore');
  if (await fs.pathExists(keystorePath)) {
    return keystorePath;
  }
  await run('keytool', [
    '-genkeypair',
    '-v',
    '-keystore', keystorePath,
    '-alias', KEY_ALIAS,
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '10000',
    '-storepass', KEYSTORE_PASSWORD,
    '-keypass', KEYSTORE_PASSWORD,
    '-dname', 'CN=HTML2APK, OU=Dev, O=HTML2APK, L=City, ST=State, C=US',
  ]);
  return keystorePath;
}

/**
 * Runs a full build: writes twa-manifest.json, ensures a signing key
 * exists, then invokes the Bubblewrap CLI to generate the Android project
 * and assemble a signed release APK.
 *
 * Requires, on the host running this server (NOT inside this sandbox):
 *   - JDK 17+
 *   - Android SDK (set ANDROID_HOME / ANDROID_SDK_ROOT)
 *   - @bubblewrap/cli installed (npx @bubblewrap/cli works too)
 */
async function buildApk(jobDir, formInput) {
  await fs.ensureDir(jobDir);
  const keystorePath = await ensureKeystore(jobDir);

  const manifest = buildManifest({
    ...formInput,
    keystorePath: './android.keystore',
    keyAlias: KEY_ALIAS,
  });

  const manifestPath = path.join(jobDir, 'twa-manifest.json');
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });

  // `bubblewrap build` reads twa-manifest.json from the current working
  // directory, generates the Android project, and runs the Gradle
  // assembleRelease task, signing with the keystore referenced above.
  const { stdout, stderr } = await run(
    'npx',
    [
      '--yes',
      '@bubblewrap/cli',
      'build',
      '--skipPwaValidation',
      `--password=${KEYSTORE_PASSWORD}`,
    ],
    { cwd: jobDir }
  );

  const apkPath = path.join(jobDir, 'app-release-signed.apk');
  const built = await fs.pathExists(apkPath);

  return {
    success: built,
    apkPath: built ? apkPath : null,
    log: stdout + '\n' + stderr,
    manifest,
  };
}

module.exports = { buildApk };
