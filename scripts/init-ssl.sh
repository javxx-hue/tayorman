#!/usr/bin/env bash
# Script to obtain Let's Encrypt SSL certificate for st.uzbek-talim.uz using Certbot Docker

DOMAIN="st.uzbek-talim.uz"
EMAIL="${1:-admin@$DOMAIN}"

echo ">>> Certbot orqali SSL sertifikat olish: $DOMAIN ($EMAIL)"

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
  --email $EMAIL \
  -d $DOMAIN \
  --agree-tos \
  --no-eff-email \
  --force-renewal" nginx

if [ -f "certbot/conf/live/$DOMAIN/fullchain.pem" ] || docker compose exec nginx test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
  echo ">>> SSL sertifikat muvaffaqiyatli olindi!"
  echo ">>> ssl.conf faollashtirilmoqda..."
  cp nginx/conf.d/ssl.conf.template nginx/conf.d/ssl.conf
  docker compose exec nginx nginx -s reload
  echo ">>> Nginx qayta yuklandi. HTTPS faol!"
else
  echo ">>> SSL olishda xatolik yuz berdi. Iltimos DNS va port 80 ulanishini tekshiring."
fi
