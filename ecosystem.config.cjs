// PM2 process config — منصة ذات عمليتين منفصلتين (خلافًا لبقية المنصات):
// واجهة React ثابتة تُقدَّم عبر serve، وخلفية FastAPI/Python عبر uvicorn.
// Traefik يوجّه /api و/ws للخلفية، وكل شيء آخر للواجهة (انظر ملف Traefik).
//
// الاستخدام (أول مرة):   pm2 start ecosystem.config.cjs
// الاستخدام (إعادة نشر): pm2 reload ecosystem.config.cjs --update-env

module.exports = {
  apps: [
    {
      name: 'research-frontend',
      script: 'server/static-server.mjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3004 },
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
