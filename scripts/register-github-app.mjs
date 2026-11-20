const manifestPath = new URL('../.github/github-app-manifest.json', import.meta.url);
const manifest = await import(manifestPath, { with: { type: 'json' } });

const owner = process.argv[2];
const baseUrl = owner
  ? `https://github.com/organizations/${encodeURIComponent(owner)}/settings/apps/new`
  : 'https://github.com/settings/apps/new';
const manifestQuery = encodeURIComponent(JSON.stringify(manifest.default));

console.log(`${baseUrl}?manifest=${manifestQuery}`);
