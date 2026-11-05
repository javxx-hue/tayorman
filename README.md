# Sessiyaga tayyorlan

Sessiya va oraliq nazoratlarga tayyorlanish uchun **Telegram bot + Mini App**. Hozircha SamDU talabalariga mo'ljallangan, lekin kirish hamma uchun ochiq. Hammasi bepul (beta).

## Nima qiladi

**Bot (chat):**
- `/start` — salomlashish va Mini App tugmasi; `t.me/<bot>?start=c_<kod>` havolasi orqali guruhga qo'shilish.
- Har qanday matn, fayl yoki rasm adminga so'rov bo'lib boradi (talaba o'zi fan yoki material yaratmaydi). Admin javobi botga keladi.
- `/reja` (bugungi reja), `/til` (o'zbek/rus), `/eslatma`. Har kuni 08:00 da reja va yaqin topshiriq muddatlari avtomatik keladi.
- Adminlar va moderatorlarda yozuv maydoni yonida **«Admin»** menyu tugmasi bor: admin saytni Telegram ichida ochadi.

**Mini App (talaba):**
- **Bugun** — bugungi reja, ketma-ket kunlar, oxirgi to'plamlar.
- **Topshiriq** — admin guruhga bergan vazifalar: muddat, holat (yangi, jarayonda, bajarildi), natija.
- **Fanlar** — admin biriktirgan fanlar: imtihon sanasi, savollar, mashq (kunlik reja, «Yana 10 ta savol»), test va kartalar (FSRS takrorlash), tayyorlik foizi. Talaba fan yaratmaydi: nashr qilingan narsa o'zi keladi va yangilanadi, admin qaytarib olsa o'chadi.
- Javobni **yozib, gapirib yoki qog'ozdagi javob rasmini yuklab** kiritish mumkin; AI matnni chiqaradi, talaba tekshirib tuzatadi, keyin baholanadi.
- **So'rov** — adminga yozish (yangi fan, savol/material, xato); 5 tagacha manba fayl biriktiriladi.
- **Profil** — til, OTM, guruhlar, eslatmalar.

**Admin sayti** (`admin/`): umumiy ko'rinish, so'rovlar, kutubxona (test va fan tuzish), xatolar, topshiriqlar, xabarlar, guruhlar, foydalanuvchilar, sozlamalar, jurnal. Qarang: [docs/ADMIN_PLAN.md](docs/ADMIN_PLAN.md).

AI kuniga har bir foydalanuvchiga cheklangan (admin saytida: shaxsiy > guruh > umumiy). Kalit faqat serverda.

## Tuzilma

```
src/                  Mini App (React + Vite + TypeScript)
admin/                admin sayti (alohida Vite ilova, alohida Vercel loyiha)
supabase/migrations/  ma'lumotlar bazasi sxemasi (RLS bilan), 0001 dan 0009 gacha ketma-ket
supabase/functions/   server (Edge Functions); ro'yxati: scripts/functions.mjs
scripts/              deploy skriptlari
docs/                 reja va muhitlar qo'llanmasi
```

Funksiyalar: `telegram-auth` (Mini App kirishi), `telegram-bot` (webhook), `telegram-reminders` va `broadcast-due` (cron), `admin-login`, `admin-broadcast`, `admin-reply`, `assignment-notify`, `request-admin`, `bot-action`, `gemini` (AI proksi).

Mini App ochilganda `telegram-auth` Telegram imzosini (initData) tekshiradi va Supabase sessiyasini beradi; parol yo'q. Ma'lumotlar telefonda saqlanadi va Supabase'ga nusxalanadi.

## Muhitlar

Development va production alohida bo'lishi kerak: har birining **o'z boti, Supabase loyihasi, sirlari va Vercel loyihasi** bor. To'liq qo'llanma va ishga tushirishdan oldingi ro'yxat: [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md).

## Ishga tushirish (har muhit uchun bir marta)

### 1. Hisoblar
- **Bot:** [@BotFather](https://t.me/BotFather) → `/newbot` → token. Mini App: Bot Settings → Menu Button → Mini App manzili (deploydan keyin).
- **Supabase:** yangi loyiha (region: Frankfurt). **Database → Extensions**: `pg_cron` va `pg_net` ni yoqing.
- **Gemini kaliti:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
- **Telegram ID'ingiz:** [@userinfobot](https://t.me/userinfobot). Bu sizni admin qiladi.

### 2. Baza
Supabase → **SQL Editor** → migratsiyalarni **tartib bilan** ishga tushiring: `0001_init.sql`, `0002_admin.sql`, `0003_admin_login.sql`, `0004_request_files.sql`, `0005_funnel.sql`, `0006_performance_indexes.sql`, `0007_admin_credentials.sql`, `0008_blocked_and_uploads.sql`, `0009_quota_refund_and_helpers.sql`.

### 3. Sirlar
`supabase/functions/.env.example` dan nusxa olib `supabase/functions/.env` ni to'ldiring:

| Sir | Nima uchun |
|---|---|
| `TELEGRAM_BOT_TOKEN` | bot tokeni |
| `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `AUTH_SECRET` | tasodifiy uzun qiymatlar; **`AUTH_SECRET` ni keyin o'zgartirmang** |
| `GEMINI_API_KEY` | AI kaliti |
| `GEMINI_MODEL` | asosiy model. 6 soniyada javob bermasa, zaxira modellar (`gemini-3.5-flash-lite` va boshqalar) ham so'rovni boshlaydi; birinchi tayyor javob olinadi |
| `ADMIN_TELEGRAM_IDS` | adminlar ID'lari, vergul bilan |
| `OWNER_TELEGRAM_IDS` | ega ID'si (adminlar ichidan): faqat u boshqa adminlarga login va parol bera oladi. Bo'sh bo'lsa, hech kim bera olmaydi |
| `APP_URL`, `ADMIN_URL` | Mini App va admin sayt manzillari (https) |
| `ALLOWED_ORIGINS` | ikkala manzil, vergul bilan |

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase secrets set --env-file supabase/functions/.env
npm run deploy:functions -- --project <ref>      # hamma funksiya, to'g'ri bayroqlar bilan
```

(`secrets set --env-file` ba'zan xato beradi; u holda sirlarni bittadan `npx supabase secrets set NOM=qiymat` bilan o'rnating.)

### 4. Botni ulash
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ref>.supabase.co/functions/v1/telegram-bot&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

### 5. Cron ishlari
SQL Editor'da (`<CRON_SECRET>` — yuqoridagi sir):
```sql
-- kunlik eslatma, 08:00 Toshkent
select cron.schedule('daily-reminders', '0 3 * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/telegram-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
$$);

-- rejalashtirilgan xabarlar, har daqiqa
select cron.schedule('broadcasts-due', '* * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/broadcast-due',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
$$);
```
Bu SQL maxfiy qiymatni o'z ichiga oladi: uni git'ga yozmang va skrinshot qilmang.

### 6. Mini App va admin saytni joylash
```bash
# .env (yoki --env .env.production): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_TELEGRAM_BOT
npm run deploy:app
npm run deploy:admin        # build + alohida Vercel loyihasi
```
Manzillarni `APP_URL`, `ADMIN_URL`, `ALLOWED_ORIGINS` va BotFather menyu tugmasiga qo'ying.

## Admin saytiga kirish

Sayt faqat adminlar (`ADMIN_TELEGRAM_IDS`) va ular tayinlagan moderatorlar uchun. Sayt kirishda har safar **login va parol** so'raydi (8 soatlik sessiya tugamaguncha qayta so'ramaydi). Ularni faqat ega (`OWNER_TELEGRAM_IDS`) saytdagi «Hisoblar» sahifasidan beradi: loginni ham, parolni ham o'zi yozadi (parol kamida 10 belgi, oddiy emas) yoki parolni bo'sh qoldirib, tizimga yaratishni topshiradi. Bazada faqat hash saqlanadi, 5 marta xato kiritilsa login 15 daqiqaga to'xtaydi, rol olib tashlansa login ishlamaydi. Login yonida ikkita qo'shimcha yo'l bor: botdagi **«Admin»** tugmasidan ochilsa «Telegram hisobim bilan kirish» (bir bosish), oddiy brauzerda «Telegram orqali kirish» (botda kodni tasdiqlash). Sessiya 8 soat.

## Ishlab chiqish

```bash
npm install
npm run dev          # Mini App, http://localhost:5173
npm run dev:admin    # admin sayti, http://localhost:5174
npm test             # vitest (bazaning ruxsatlari ham haqiqiy Postgres'da sinaladi)
npm run typecheck
```

## Eslatmalar
- To'lov yo'q: barcha rejimlar bepul. Keyin tarif qo'shish uchun `profiles` jadvaliga maydon qo'shiladi.
- Bir martalik xabar bitta so'rovda 2500 tagacha foydalanuvchiga ishlaydi; kattaroq auditoriya uchun bo'laklash kerak bo'ladi.
- Yuklanadigan fayl 20 MB gacha (Telegram va ombor cheklovi).
