/**
 * Builds a Bubblewrap twa-manifest.json object from simple user input.
 * Docs: https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/core/src/lib/TwaManifest.ts
 */

function sanitizePackageId(appName, host) {
  // Fallback package id derived from the host, reversed-domain style.
  const parts = host.split('.').filter(Boolean).reverse();
  const base = parts.length ? parts.join('.') : 'app';
  const safeName = (appName || 'app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20) || 'app';
  return `${base}.${safeName}`.replace(/\.+/g, '.');
}

function buildManifest({
  targetUrl,
  appName,
  shortName,
  packageId,
  themeColor,
  backgroundColor,
  iconUrl,
  keystorePath,
  keyAlias,
}) {
  const url = new URL(targetUrl);
  const host = url.host;
  const startUrl = url.pathname + url.search || '/';

  const resolvedPackageId = packageId && packageId.trim()
    ? packageId.trim()
    : sanitizePackageId(appName, host);

  const resolvedIconUrl = iconUrl && iconUrl.trim()
    ? iconUrl.trim()
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`;

  return {
    packageId: resolvedPackageId,
    host,
    name: appName,
    launcherName: (shortName || appName).slice(0, 30),
    display: 'standalone',
    themeColor: themeColor || '#000000',
    navigationColor: themeColor || '#000000',
    navigationColorDark: '#000000',
    navigationDividerColor: '#000000',
    navigationDividerColorDark: '#000000',
    backgroundColor: backgroundColor || '#FFFFFF',
    enableNotifications: false,
    startUrl,
    iconUrl: resolvedIconUrl,
    maskableIconUrl: '',
    monochromeIconUrl: '',
    splashScreenFadeOutDuration: 300,
    signingKey: {
      path: keystorePath,
      alias: keyAlias,
    },
    appVersionName: '1.0.0',
    appVersionCode: 1,
    shortcuts: [],
    generatorApp: 'HTML2APK',
    // customtabs fallback works even when the target site has not published
    // a Digital Asset Links file (assetlinks.json) proving domain ownership.
    // Full edge-to-edge "native" TWA display requires the target site's
    // owner to publish that file at /.well-known/assetlinks.json.
    fallbackType: 'customtabs',
    features: {},
    alphaDependencies: { enabled: false },
    isChromeOSOnly: false,
    isMetaQuest: false,
  };
}

module.exports = { buildManifest, sanitizePackageId };
