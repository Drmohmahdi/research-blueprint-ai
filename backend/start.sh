#!/bin/bash
# يُشغَّل عبر PM2 — يُفعّل البيئة الافتراضية ثم يشغّل uvicorn.
cd "$(dirname "$0")"
source venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port 3005
