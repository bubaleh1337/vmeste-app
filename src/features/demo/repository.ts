import { DEMO_GOAL_ID } from "@/lib/config";
import type { DemoAuditEntry, DemoExpense, DemoRepository, DemoSaving, DemoSnapshot } from "./types";

const KATYA = "demo-user-katya";
const NIKITA = "demo-user-nikita";

function cloneSnapshot(snapshot: DemoSnapshot): DemoSnapshot {
  return {
    goal: { ...snapshot.goal, participants: snapshot.goal.participants.map((item) => ({ ...item })) },
    savings: snapshot.savings.map((item) => ({ ...item })),
    expenses: snapshot.expenses.map((item) => ({ ...item })),
    audit: snapshot.audit.map((item) => ({ ...item })),
  };
}

const initialSnapshot: DemoSnapshot = {
  goal: {
    id: DEMO_GOAL_ID,
    title: "Квартира",
    targetAmountMinor: 10_000_000_00n,
    currencyCode: "KZT",
    targetDate: "2027-04-01",
    participants: [
      { id: KATYA, name: "Катя", initial: "К" },
      { id: NIKITA, name: "Никита", initial: "Н" },
    ],
  },
  savings: [
    { id: "s1", goalId: DEMO_GOAL_ID, type: "contribution", amountMinor: 1_200_000_00n, transactionDate: "2026-06-12", contributorUserId: KATYA, description: "Пополнение депозита", createdBy: KATYA, deletedAt: null },
    { id: "s2", goalId: DEMO_GOAL_ID, type: "contribution", amountMinor: 900_000_00n, transactionDate: "2026-06-18", contributorUserId: NIKITA, description: "Пополнение депозита", createdBy: NIKITA, deletedAt: null },
    { id: "s3", goalId: DEMO_GOAL_ID, type: "interest", amountMinor: 24_600_00n, transactionDate: "2026-07-01", contributorUserId: KATYA, description: "Проценты банка", createdBy: KATYA, deletedAt: null },
    { id: "s4", goalId: DEMO_GOAL_ID, type: "contribution", amountMinor: 480_000_00n, transactionDate: "2026-07-15", contributorUserId: KATYA, description: "Плановое пополнение", createdBy: KATYA, deletedAt: null },
    { id: "s5", goalId: DEMO_GOAL_ID, type: "contribution", amountMinor: 520_000_00n, transactionDate: "2026-08-10", contributorUserId: NIKITA, description: "Плановое пополнение", createdBy: NIKITA, deletedAt: null },
    { id: "s6", goalId: DEMO_GOAL_ID, type: "fee", amountMinor: 2_500_00n, transactionDate: "2026-08-20", contributorUserId: NIKITA, description: "Комиссия счёта", createdBy: NIKITA, deletedAt: null },
  ],
  expenses: [
    { id: "e1", goalId: DEMO_GOAL_ID, amountMinor: 42_800_00n, transactionDate: "2026-08-24", descriptionRaw: "SUPERMARKET", merchantNormalized: "Супермаркет", category: "Продукты", spentByUserId: KATYA, isDiscretionary: false, analyticsStatus: "included", createdBy: KATYA, deletedAt: null },
    { id: "e2", goalId: DEMO_GOAL_ID, amountMinor: 18_900_00n, transactionDate: "2026-08-25", descriptionRaw: "CAFE", merchantNormalized: "Кафе", category: "Кафе и рестораны", spentByUserId: NIKITA, isDiscretionary: true, analyticsStatus: "included", createdBy: NIKITA, deletedAt: null },
    { id: "e3", goalId: DEMO_GOAL_ID, amountMinor: 8_500_00n, transactionDate: "2026-08-26", descriptionRaw: "TAXI", merchantNormalized: "Такси", category: "Транспорт", spentByUserId: KATYA, isDiscretionary: true, analyticsStatus: "included", createdBy: KATYA, deletedAt: null },
    { id: "e4", goalId: DEMO_GOAL_ID, amountMinor: 12_000_00n, transactionDate: "2026-08-27", descriptionRaw: "PHARMACY", merchantNormalized: "Аптека", category: "Здоровье и аптеки", spentByUserId: NIKITA, isDiscretionary: false, analyticsStatus: "included", createdBy: NIKITA, deletedAt: null },
    { id: "e5", goalId: DEMO_GOAL_ID, amountMinor: 25_000_00n, transactionDate: "2026-08-28", descriptionRaw: "CASH WITHDRAWAL", merchantNormalized: "Снятие наличных", category: "Требует проверки", spentByUserId: KATYA, isDiscretionary: false, analyticsStatus: "needs_review", createdBy: KATYA, deletedAt: null },
  ],
  audit: [
    { id: "a1", actorUserId: NIKITA, action: "create", entityType: "saving", summary: "Добавил накопление", createdAt: "2026-08-10T11:20:00Z" },
    { id: "a2", actorUserId: KATYA, action: "create", entityType: "expense", summary: "Добавила расход в «Транспорт»", createdAt: "2026-08-26T08:10:00Z" },
    { id: "a3", actorUserId: NIKITA, action: "create", entityType: "expense", summary: "Добавил расход в «Здоровье и аптеки»", createdAt: "2026-08-27T17:40:00Z" },
  ],
};

export function createDemoRepository(): DemoRepository {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development demo repository is disabled in production.");
  }

  const state = cloneSnapshot(initialSnapshot);
  let sequence = 100;

  const addAudit = (entry: Omit<DemoAuditEntry, "id" | "createdAt">) => {
    state.audit = [
      { ...entry, id: `a${++sequence}`, createdAt: new Date().toISOString() },
      ...state.audit,
    ];
  };

  return {
    snapshot: () => cloneSnapshot(state),
    addSaving(input) {
      const item: DemoSaving = {
        ...input,
        id: `s${++sequence}`,
        goalId: DEMO_GOAL_ID,
        createdBy: KATYA,
        deletedAt: null,
      };
      state.savings = [...state.savings, item];
      addAudit({ actorUserId: KATYA, action: "create", entityType: "saving", summary: "Добавила накопление" });
    },
    updateSaving(id, patch) {
      state.savings = state.savings.map((item) => (item.id === id ? { ...item, ...patch } : item));
      addAudit({ actorUserId: KATYA, action: "update", entityType: "saving", summary: "Изменила накопление" });
    },
    addExpense(input) {
      const item: DemoExpense = {
        ...input,
        id: `e${++sequence}`,
        goalId: DEMO_GOAL_ID,
        createdBy: KATYA,
        deletedAt: null,
      };
      state.expenses = [...state.expenses, item];
      addAudit({ actorUserId: KATYA, action: "create", entityType: "expense", summary: `Добавила расход в «${item.category}»` });
    },
    updateExpense(id, patch) {
      state.expenses = state.expenses.map((item) => (item.id === id ? { ...item, ...patch } : item));
      addAudit({ actorUserId: KATYA, action: "update", entityType: "expense", summary: "Изменила расход" });
    },
  };
}
