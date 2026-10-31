#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🚀 Sessiyaga tayyorlan: Production Deploy"
echo "=========================================="

echo ">>> 1. Frontend build qilinmoqda..."
npm run build

echo ">>> 2. Serverga fayllar sinxronizatsiya qilinmoqda..."
rsync -avz --delete dist/ big:/home/ubuntu/sessiyagatayyorlan/dist/
scp nginx/spa.conf big:/home/ubuntu/sessiyagatayyorlan/nginx/spa.conf
scp scripts/bot.mjs big:/home/ubuntu/sessiyagatayyorlan/bot.mjs

echo ">>> 3. Serverdagi konteynerlar yangilanmoqda..."
ssh big "cd /home/ubuntu/sessiyagatayyorlan && docker compose restart && docker exec mb-caddy caddy reload --config /etc/caddy/Caddyfile"

echo ">>> 4. Jonli domen tekshirilmoqda..."
curl -f -I https://st.uzbek-talim.uz | head -n 5

echo "=========================================="
echo "✅ Deploy muvaffaqiyatli yakunlandi: https://st.uzbek-talim.uz"
echo "=========================================="
