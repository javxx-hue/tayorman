# Muhitlar va ishga tushirishdan oldingi ro'yxat

## Ikki muhit

| | Development | Production |
|---|---|---|
| Bot | `@tayormanbot` | Sanjarning boti |
| Supabase loyihasi | `tayorman` (hozirgi) | **alohida** loyiha |
| Vercel loyihalari | `tayyorman` (Mini App), `tayyorman-admin` | alohida ikkitasi |
| Sirlar | `supabase/functions/.env` | alohida to'plam; `AUTH_SECRET`, tokenlar boshqa |
| Kod | `feature/*` branchlari | `main` (PR orqali) |

Muhitlar **hech narsani bo'lishmaydi**: bir muhitning tokeni, kaliti yoki bazasi ikkinchisida ishlatilmaydi. Bu tasodifan haqiqiy foydalanuvchilarga xabar yuborish yoki ularning ma'lumotini buzishdan saqlaydi.

### Yangi muhit ochish (production)
1. Yangi Supabase loyihasi, `pg_cron` va `pg_net` yoqilgan.
2. Migratsiyalar `0001`…`0005` tartib bilan (README, 2-bosqich).
3. Yangi bot tokeni (BotFather), yangi tasodifiy `AUTH_SECRET`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`; `ADMIN_TELEGRAM_IDS`, `APP_URL`, `ADMIN_URL`, `ALLOWED_ORIGINS`, Gemini kaliti.
4. `npm run deploy:functions -- --project <production-ref>`.
5. Webhook (README, 4-bosqich) va ikkita cron ishi (5-bosqich) production manzillari bilan.
6. `.env.production` (VITE_* qiymatlari) bilan `npm run deploy:app -- --env .env.production`, so'ng `npm run deploy:admin`.
7. BotFather: Menu Button = production Mini App manzili.

## Ishga tushirishdan oldingi ro'yxat (haqiqiy talabalar kelishidan oldin)

**Xavfsizlik**
- [ ] Git tarixida ochiq qolgan eski bot tokeni (bot ID `9088363125`) BotFather'da `/revoke` qilingan va yangi token faqat sirlarda turibdi.
- [ ] Eski Gemini kaliti bekor qilingan.
- [ ] Har bir muhitning `AUTH_SECRET` i o'zining; ular hech qayerda git'ga yozilmagan (`git log -p | grep` bilan tekshirish).
- [ ] `ADMIN_TELEGRAM_IDS` faqat haqiqiy adminlar. (Eslatma: Sanjar qo'shgan `DEFAULT_ADMIN_IDS` ro'yxati kodda ham turibdi, `supabase/functions/_shared/users.ts`.)
- [ ] GitHub'da `main` uchun branch himoyasi: faqat Pull Request orqali, CI o'tishi shart.

**Ma'lumot**
- [ ] **Zaxira (backup):** Supabase bepul tarifida avtomatik zaxira yo'q. Pullik tarifga o'ting yoki muntazam `npx supabase db dump` (DB paroli bilan) qiling va xavfsiz joyga saqlang. Bepul loyiha bir hafta faolsiz qolsa to'xtatiladi.
- [ ] Migratsiyalar tartib bilan bajarilgan (`0001`…`0005`).
- [ ] Ikkala cron ishi mavjud: `select jobname, schedule from cron.job;`

**Tarif va cheklovlar**
- [ ] Vercel Hobby tarifi tijoriy foydalanishga mo'ljallanmagan: daromad boshlanganda Pro'ga o'ting.
- [ ] Supabase bepul tarif chegaralari (baza hajmi, funksiya chaqiruvlari) kuzatilmoqda.

**Jonli tekshiruv** (har yangi muhitda, telefonda)
- [ ] Talaba: kirish, guruhga qo'shilish, fan keladi, mashq, ovoz/rasm bilan javob, topshiriq, so'rov (fayl bilan).
- [ ] Admin: botdagi «Admin» tugmasi (faqat adminda), kirish, kutubxonada test tuzish, topshiriq berish va botga xabar, xabarni rejalashtirish.
- [ ] Ertalab 08:00 eslatma keldi (muddatli topshiriq bilan).
- [ ] Talaba admin saytga kira olmaydi.
