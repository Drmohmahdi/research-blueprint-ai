# Deploying the backend on the Hostinger VPS

Checklist for turning the current ad-hoc backend process into a reproducible,
production-grade deployment. Run these on the VPS itself.

## 1. Code and dependencies

```bash
git clone <repo-url> /var/www/research-blueprint-ai
cd /var/www/research-blueprint-ai/backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## 2. Database

Switch from SQLite to PostgreSQL before relying on this for real testing data —
SQLite works locally but doesn't hold up under concurrent access in production.

```bash
sudo -u postgres createdb research_blueprint
sudo -u postgres createuser research_blueprint_user --pwprompt
```

Set `DATABASE_URL` in `backend/.env` accordingly (see `.env.production.example`).

## 3. Environment file

```bash
cp backend/.env.production.example backend/.env
# edit backend/.env: DATABASE_URL, CORS_ORIGINS, GEMINI_API_KEY
```

## 4. Migrations

```bash
cd backend && .venv/bin/python -m alembic upgrade head
```

## 5. systemd service

```bash
sudo cp deploy/hostinger/research-blueprint-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now research-blueprint-backend
sudo systemctl status research-blueprint-backend
```

## 6. Nginx + SSL

```bash
sudo cp deploy/hostinger/nginx.conf.example /etc/nginx/sites-available/research-blueprint-api
sudo ln -s /etc/nginx/sites-available/research-blueprint-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.your-domain.com
```

## 7. Point the Vercel frontend at it

Once `api.your-domain.com` is live with a valid certificate, add an `/api`
rewrite in `public/vercel.json` pointing to it, add the Vercel domain to
`CORS_ORIGINS` in `backend/.env`, and redeploy with `npm run deploy:vercel`.

## Later: moving the frontend to Hostinger too

`npm run build` produces `dist/`; the commented-out server block in
`nginx.conf.example` shows how to serve it directly from this VPS once
you're ready to retire the Vercel staging deployment.
