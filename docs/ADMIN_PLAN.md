# Admin sayti va talabalar oqimi

Asosiy qaror: **talaba hech narsa yaratmaydi.** Fan, test va materiallarni faqat admin tayyorlaydi; talaba ularni o'qiydi va kerak bo'lsa adminga so'rov yuboradi. Admin ishlari faqat admin saytda, Mini App esa faqat talaba uchun.

## Admin sayti (`admin/`, alohida Vercel loyiha)
- **Kirish:** saytdagi tugma botni ochadi, bot 4 belgili kodni ko'rsatib «Tasdiqlash» tugmasini yuboradi. ID `ADMIN_TELEGRAM_IDS` ichida bo'lsa (admin) yoki moderator bo'lsa kiradi. Tasdiq 5 daqiqa, bir marta ishlaydi (`admin_login_requests`, faqat xesh saqlanadi). Sessiya 8 soat.
- **Umumiy ko'rinish:** foydalanuvchilar, kunlik faol, voronka (ro'yxatdan o'tdi → ochdi → material oldi → birinchi javob), AI sarfi, qiyin savollar.
- **So'rovlar:** talabalar so'rovi (fayllari bilan), javob botga boradi, shu fayldan test yoki fan tuzish.
- **Kutubxona:** test (fayldan AI bilan yoki Word/Hemis matnidan), fan (imtihon savollari va ma'ruza fayllari), tahrirlash, qoralama, nusxalash, kimga ochiq.
- **Topshiriqlar:** kutubxona elementi + guruhlar + muddat, botda xabar, har guruh bo'yicha natija.
- **Xabarlar:** hamma yoki guruhlarga, hozir yoki rejalashtirilgan, yetgan va yetmaganlar soni.
- **Guruhlar:** a'zolar, taklif havolasi, guruh AI limiti, moderatorlar.
- **Foydalanuvchilar:** qidiruv, bloklash, moderator, shaxsiy AI limit.
- **Xatolar:** talabalar "savolda xato bor" deb yuborganlar, bir savol bo'yicha jamlangan; "Kutubxonada ochish" bilan to'g'ridan-to'g'ri tahrirlanadi.
- **Sozlamalar:** umumiy kunlik AI limiti (tartib: shaxsiy, guruh, umumiy; adminlarga ham shaxsiy limit beriladi).
- **Jurnal:** kim, qachon, nima qilgan.

Moderator faqat o'z guruhlarini ko'radi (a'zolar, havola, topshiriqlar).

## Talaba (Mini App va bot)
- **Bugun, Topshiriq, Fanlar, So'rov, Profil.** Kutubxonadan nashr qilingan narsa talabaga o'zi keladi va yangilanadi (natijalari saqlanadi).
- **So'rov:** tur tanlab yozadi, 5 tagacha fayl biriktiradi (PDF, Word, PowerPoint, TXT, rasm; 20 MB gacha). Botga yozgan har qanday matn, fayl yoki rasm ham so'rov bo'ladi.
- Topshiriq bajarilishi talabaning o'z ma'lumotidan hisoblanib serverga yuboriladi.
- Har ertalab 08:00 da bot reja bilan birga bugun yoki ertaga tugaydigan, hali bajarilmagan topshiriqlarni eslatadi.
- Test va savolda xato bo'lsa, "Savolda xato bor" tugmasi adminga xabar yuboradi.

## Qoidalar
- Rollar: talaba, moderator, admin. `admin` faqat `ADMIN_TELEGRAM_IDS` sirida; panelda berilmaydi.
- Har bir ruxsat bazada (RLS) tekshiriladi; sayt faqat ko'rinish.
- Ish `feature/admin-web` branchida; `main` ga faqat Pull Request orqali. Sanjar bilan `src/` va `supabase/` ga tegishdan oldin kelishiladi.

## Keyingi ishlar
- Sanjar bilan `main` ni birlashtirish (nom, email domeni va qattiq yozilgan ID'lar bo'yicha kelishuv).
