export interface ExpenseCategoryOption {
  id: string;
  name: string;
  defaultDiscretionary: boolean;
}

export interface CategorizationRuleOption {
  id: string;
  matchType: "contains" | "starts_with" | "exact";
  patternNormalized: string;
  categoryId: string;
  priority: number;
}

const RULES: { category: string; patterns: RegExp[] }[] = [
  { category: "Продукты", patterns: [/\bmagnum\b/i, /\bsmall\b/i, /\bgalmart\b/i, /\bмагазин\b/i, /\bsupermarket\b/i, /\bgrocery\b/i, /\bрынок\b/i] },
  { category: "Кафе и рестораны", patterns: [/кофе/i, /coffee/i, /cafe/i, /кафе/i, /restaurant/i, /ресторан/i, /burger/i, /pizza/i, /kfc/i, /starbucks/i] },
  { category: "Транспорт", patterns: [/такси/i, /taxi/i, /yandex\s*go/i, /indrive/i, /uber/i, /автобус/i, /bus/i, /транспорт/i, /parking/i, /парков/i] },
  { category: "Жильё и коммунальные услуги", patterns: [/коммун/i, /квартплат/i, /электроэнерг/i, /газ/i, /водоканал/i, /аренд/i, /rent/i, /utility/i] },
  { category: "Здоровье и аптеки", patterns: [/аптек/i, /pharmacy/i, /clinic/i, /клиник/i, /medical/i, /медицин/i, /стомат/i] },
  { category: "Красота и уход", patterns: [/beauty/i, /salon/i, /салон/i, /маникюр/i, /космет/i, /barber/i, /парикмах/i] },
  { category: "Одежда и покупки", patterns: [/zara/i, /h&m/i, /lc waikiki/i, /одежд/i, /clothes/i, /fashion/i, /kaspi магазин/i, /wildberries/i, /ozon/i] },
  { category: "Подписки и связь", patterns: [/netflix/i, /spotify/i, /youtube/i, /подпис/i, /tele2/i, /beeline/i, /activ/i, /kcell/i, /internet/i, /интернет/i, /mobile/i] },
  { category: "Развлечения", patterns: [/cinema/i, /кино/i, /steam/i, /playstation/i, /xbox/i, /game/i, /театр/i, /развлеч/i] },
  { category: "Образование", patterns: [/course/i, /курс/i, /university/i, /университет/i, /school/i, /школ/i, /udemy/i, /coursera/i] },
  { category: "Путешествия", patterns: [/hotel/i, /отел/i, /booking/i, /airbnb/i, /air astana/i, /flyarystan/i, /авиабилет/i, /flight/i, /travel/i] },
  { category: "Питомцы", patterns: [/pet/i, /зоомаг/i, /ветерин/i, /ветклиник/i, /корм.*кот/i, /корм.*собак/i] },
  { category: "Подарки и помощь", patterns: [/gift/i, /подар/i, /благотвор/i, /charity/i] },
  { category: "Налоги и комиссии", patterns: [/налог/i, /tax/i, /комисси/i, /commission/i, /fee/i] },
  { category: "Переводы", patterns: [/перевод/i, /transfer/i] },
  { category: "Наличные", patterns: [/снятие налич/i, /cash withdrawal/i, /atm/i, /банкомат/i] },
];

export function normalizeCategorizationPattern(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ")
    .trim();
}

function ruleSpecificity(matchType: CategorizationRuleOption["matchType"]): number {
  if (matchType === "exact") return 3;
  if (matchType === "starts_with") return 2;
  return 1;
}

function userRuleMatch(description: string, rules: readonly CategorizationRuleOption[]): CategorizationRuleOption | undefined {
  const normalized = normalizeCategorizationPattern(description);
  return [...rules]
    .filter((rule) => {
      if (!rule.patternNormalized) return false;
      if (rule.matchType === "exact") return normalized === rule.patternNormalized;
      if (rule.matchType === "starts_with") return normalized.startsWith(rule.patternNormalized);
      return normalized.includes(rule.patternNormalized);
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const specificity = ruleSpecificity(b.matchType) - ruleSpecificity(a.matchType);
      if (specificity !== 0) return specificity;
      return b.patternNormalized.length - a.patternNormalized.length;
    })[0];
}

export function suggestExpenseCategory(
  description: string,
  categories: ExpenseCategoryOption[],
  userRules: readonly CategorizationRuleOption[] = [],
): { categoryId: string; analyticsStatus: "included" | "needs_review"; isDiscretionary: boolean; source: "user_rule" | "builtin" | "review" } {
  const customRule = userRuleMatch(description, userRules);
  if (customRule) {
    const customCategory = categories.find((category) => category.id === customRule.categoryId);
    if (customCategory) {
      return {
        categoryId: customCategory.id,
        analyticsStatus: "included",
        isDiscretionary: customCategory.defaultDiscretionary,
        source: "user_rule",
      };
    }
  }

  const match = RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(description)));
  const matchedCategory = match
    ? categories.find((category) => category.name.toLocaleLowerCase("ru-RU") === match.category.toLocaleLowerCase("ru-RU"))
    : undefined;

  if (matchedCategory) {
    return {
      categoryId: matchedCategory.id,
      analyticsStatus: "included",
      isDiscretionary: matchedCategory.defaultDiscretionary,
      source: "builtin",
    };
  }

  const reviewCategory = categories.find((category) => /требует проверки/i.test(category.name));
  const fallbackCategory = reviewCategory ?? categories.find((category) => /другое/i.test(category.name)) ?? categories[0];
  return {
    categoryId: fallbackCategory?.id ?? "",
    analyticsStatus: reviewCategory ? "needs_review" : "included",
    isDiscretionary: fallbackCategory?.defaultDiscretionary ?? false,
    source: "review",
  };
}
