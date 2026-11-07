import { forecastGoal, requiredMonthlyContribution, type ForecastInput } from '../lib/forecast';
import { parseISO } from '../lib/dates';
import type { Goal } from '../lib/types';
import type { State } from './store';

export function goalInput(state: State, goal: Goal, overrides: Partial<ForecastInput> = {}): ForecastInput {
  const linked = state.accounts.filter((a) => goal.accountIds.includes(a.id));
  return {
    start: state.today,
    target: goal.target,
    targetDate: parseISO(goal.targetDate),
    monthlyContribution: goal.monthlyContribution,
    savings: linked.map((a) => ({ balance: Math.max(0, a.balance), rate: a.interestRate ?? 0 })),
    termDeposits: state.termDeposits.filter((t) => t.goalId === goal.id),
    rwt: state.settings.rwt,
    ...overrides,
  };
}

export type GoalStatus = 'done' | 'on-track' | 'behind';

export function goalSummary(state: State, goal: Goal) {
  const input = goalInput(state, goal);
  const forecast = forecastGoal(input);
  const current = forecast.points[0].total;
  const targetDate = parseISO(goal.targetDate);
  const status: GoalStatus =
    current >= goal.target
      ? 'done'
      : forecast.reachedDate && forecast.reachedDate <= targetDate
        ? 'on-track'
        : 'behind';
  const required = status === 'behind' ? requiredMonthlyContribution(input) : null;
  return { input, forecast, current, status, required, progress: Math.min(1, current / goal.target) };
}
