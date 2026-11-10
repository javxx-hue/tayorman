// One daily time budget for all subjects together, so the day's work stays doable.
// Each subject's own plan says what it would like today (its share until the exam). When all of that does not fit
// into the student's minutes, what is due (card reviews and mistakes that came back) is always kept, and the rest is
// cut down by the same factor in every subject. A subject whose exam is near already asks for more per day, so it
// keeps more. What does not fit simply stays for the following days.

// Rough minutes per item
export const COST = { question: 4, test: 1, mistake: 1, newCard: 0.5, review: 0.3 } as const;

export interface Need {
  id: string; // subject id
  questions: number; // exam questions planned for today (written or spoken answers)
  tests: number; // new test questions for today
  mistakes: number; // test mistakes that came back today
  newCards: number; // new flashcards for today
  reviews: number; // flashcard reviews due
}
export type Allowance = Omit<Need, 'id'> & { minutes: number };

const minutesOf = (n: Omit<Need, 'id'>) =>
  n.questions * COST.question + n.tests * COST.test + n.mistakes * COST.mistake + n.newCards * COST.newCard + n.reviews * COST.review;

export function allocate(needs: Need[], budgetMinutes: number): Record<string, Allowance> {
  const fixed = needs.reduce((m, n) => m + n.mistakes * COST.mistake + n.reviews * COST.review, 0);
  const flexible = needs.reduce((m, n) => m + n.questions * COST.question + n.tests * COST.test + n.newCards * COST.newCard, 0);
  const room = Math.max(0, budgetMinutes - fixed);
  const factor = flexible <= room ? 1 : flexible > 0 ? room / flexible : 0;
  // Something of each kind stays in the day, as long as there is any room at all
  const cut = (n: number) => (n === 0 || factor === 0 ? 0 : Math.max(1, Math.floor(n * factor)));

  const out: Record<string, Allowance> = {};
  for (const n of needs) {
    const a = { questions: cut(n.questions), tests: cut(n.tests), newCards: cut(n.newCards), mistakes: n.mistakes, reviews: n.reviews };
    out[n.id] = { ...a, minutes: Math.round(minutesOf(a)) };
  }
  return out;
}

// ---------------------------------------------------------------- the student's daily minutes (this phone)
export const MINUTE_CHOICES = [20, 30, 45, 60, 90, 120];
export const DEFAULT_MINUTES = 45;
const KEY = 'sessiyagatayyorlan_daily_minutes';

export function getDailyMinutes(): number {
  try {
    const n = Number(localStorage.getItem(KEY));
    return MINUTE_CHOICES.includes(n) ? n : DEFAULT_MINUTES;
  } catch {
    return DEFAULT_MINUTES;
  }
}

export function setDailyMinutes(n: number): void {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* blocked storage: the default applies */
  }
}
