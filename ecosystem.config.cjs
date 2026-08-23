// PM2 process config — منصة ذات عمليتين منفصلتين (خلافًا لبقية المنصات):
// واجهة React ثابتة تُقدَّم عبر serve، وخلفية FastAPI/Python عبر uvicorn.
// Traefik يوجّه /api و/ws للخلفية، وكل شيء آخر للواجهة (انظر ملف Traefik).
//
// الاستخدام (أول مرة):   pm2 start ecosystem.config.cjs
// الاستخدام (إعادة نشر): pm2 reload ecosystem.config.cjs --update-env

// Minimal, dependency-free .env reader — reused so the frontend's static
// server can independently gate the SPA bundle with the same password as
// the backend (backend/app/services/site_gate.py), without duplicating the
// secret in a second file. Missing file/key is silently treated as unset.
function readEnvValue(relativePath, key) {
  try {
    const content = require('fs').readFileSync(require('path').join(__dirname, relativePath), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1 || trimmed.startsWith('#')) continue;
      if (trimmed.slice(0, eq).trim() === key) return trimmed.slice(eq + 1).trim();
    }
  } catch {
    // Backend .env not present at pm2-config-eval time — gate stays disabled.
  }
  return '';
}

module.exports = {
  apps: [
    {
      name: 'research-frontend',
      script: 'server/static-server.mjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
        SITE_GATE_PASSWORD: readEnvValue('backend/.env', 'SITE_GATE_PASSWORD'),
      },
      max_memory_restart: '256M',
    },
    {
      name: 'research-backend',
      script: 'backend/start.sh',
      interpreter: 'bash',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '768M',
    },
  ],
}
