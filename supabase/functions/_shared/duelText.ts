// Bot messages about duels. Pure (no Deno or npm imports) so it can be unit tested.

type Lang = 'uz' | 'ru';

// To the opponent: someone from the group has played and waits for an answer within 24 hours
export function duelChallengeMessage(lang: Lang, challenger: string, questions: number): string {
  return lang === 'ru'
    ? `⚔️ ${challenger} вызывает вас на дуэль!\n\n${questions} вопросов, ответьте в течение 24 часов. Победа — 50 XP, ничья — 25, поражение — 10.`
    : `⚔️ ${challenger} sizni duelga chaqirdi!\n\n${questions} ta savol, 24 soat ichida javob bering. G'alaba — 50 XP, durang — 25, mag'lubiyat — 10.`;
}

// To the challenger: the opponent has answered, here is how it ended (scores from the challenger's side)
export function duelResultMessage(lang: Lang, opponent: string, mine: number, theirs: number): string {
  const score = `${mine}:${theirs}`;
  if (mine > theirs) return lang === 'ru' ? `🏆 Победа в дуэли с ${opponent}! ${score} · +50 XP` : `🏆 ${opponent} bilan duelda g'alaba! ${score} · +50 XP`;
  if (mine === theirs) return lang === 'ru' ? `🤝 Ничья в дуэли с ${opponent}. ${score} · +25 XP` : `🤝 ${opponent} bilan duel durang. ${score} · +25 XP`;
  return lang === 'ru'
    ? `💪 ${opponent} в этот раз сильнее: ${score} · +10 XP. Попробуйте реванш!`
    : `💪 Bu safar ${opponent} kuchliroq chiqdi: ${score} · +10 XP. Qayta urinib ko'ring!`;
}
