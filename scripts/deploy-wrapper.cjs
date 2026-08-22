// Wrapper to deploy to Vercel with patched os.userInfo
const os = require('os');
const origUserInfo = os.userInfo;
os.userInfo = (opts) => {
  const info = origUserInfo.call(os, opts);
  return { ...info, username: 'vercel' };
};

const path = require('path');
const cp = require('child_process');

const vcPath = path.join(process.env.APPDATA, 'npm/node_modules/vercel/dist/vc.js');
const args = process.argv.slice(2);

console.log('Running vercel deploy with patched username...');
console.log('Args:', args.join(' '));

const result = cp.spawnSync('node', [vcPath, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    USERNAME: 'vercel',
    USER: 'vercel',
  }
});

process.exit(result.status || 0);
