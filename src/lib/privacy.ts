// What the student is told about their data, once at the start and always in the profile.
// Keep the text true: when the code starts to store something new (or stops sending something to the AI), change it here.
import { Language } from './i18n';

export const PRIVACY_KEY = 'tayyorman-privacy-ok';

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Storage can be blocked (private mode, full): then the notice is simply shown again next time
export function privacySeen(store: KeyValueStore | null): boolean {
  try {
    return store?.getItem(PRIVACY_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPrivacySeen(store: KeyValueStore | null): void {
  try {
    store?.setItem(PRIVACY_KEY, '1');
  } catch {
    // nothing to do: the choice is kept for this visit by the component
  }
}

export interface PrivacyText {
  title: string;
  points: string[];
  accept: string;
}

const TEXT: Record<Language, PrivacyText> = {
  uz: {
    title: "Ma'lumotlaringiz haqida",
    points: [
      "Saqlanadi: ismingiz, Telegram ID va username, fanlaringiz, natijalaringiz va yuborgan so'rovlaringiz (fayllari bilan). Ularni faqat administratorlar ko'radi.",
      "Ovozli javob va qog'ozdagi javob rasmi matnga aylantirish va baholash uchun AI xizmatiga (Google Gemini) yuboriladi. Ovozning va rasmning o'zi bizda saqlanmaydi, saqlanadigani javobingiz matni. Google yuborilgan ma'lumotni o'z qoidalariga ko'ra qayta ishlashi mumkin.",
      "Eslatmalar botdan keladi. Ularni /eslatma buyrug'i bilan o'chirib qo'yishingiz mumkin.",
      "Ma'lumotlaringizni o'chirishni xohlasangiz yoki savolingiz bo'lsa, botga yozing: xabaringiz administratorga yetadi.",
    ],
    accept: 'Tushundim',
  },
  ru: {
    title: 'О ваших данных',
    points: [
      'Сохраняются: ваше имя, Telegram ID и username, предметы, результаты и отправленные запросы (вместе с файлами). Их видят только администраторы.',
      'Голосовой ответ и фото ответа с бумаги отправляются в ИИ-сервис (Google Gemini) для перевода в текст и оценки. Сами запись и фото у нас не хранятся, хранится текст вашего ответа. Google может обрабатывать отправленные данные по своим правилам.',
      'Напоминания приходят из бота. Их можно отключить командой /eslatma.',
      'Если хотите удалить свои данные или есть вопрос, напишите боту: сообщение дойдёт до администратора.',
    ],
    accept: 'Понятно',
  },
};

export const privacyText = (lang: Language): PrivacyText => TEXT[lang];
