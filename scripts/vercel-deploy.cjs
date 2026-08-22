// Workaround for Vercel CLI Arabic username bug on Windows
const os = require('os');
const origUserInfo = os.userInfo;
os.userInfo = function(opts) {
  const info = origUserInfo.call(os, opts);
  return { ...info, username: 'vercel' };
};

// Run vercel CLI
require('vercel');
