export type BudgetLevel = 'ok' | 'warning' | 'over';

/** Share of the budget at which the user is warned that they are close to the limit. */
export const BUDGET_WARNING_RATIO = 0.8;

export function budgetStatus(spent: number, limit: number): { ratio: number; level: BudgetLevel; remaining: number } {
  const ratio = limit > 0 ? spent / limit : 0;
  const level: BudgetLevel = ratio > 1 ? 'over' : ratio >= BUDGET_WARNING_RATIO ? 'warning' : 'ok';
  return { ratio, level, remaining: limit - spent };
}
