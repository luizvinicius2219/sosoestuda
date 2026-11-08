import { buildWeeks, type PlannerWeek } from "./planner.ts";
import { scheduleReview, todayKey, type Review, type StudyState } from "./study.ts";
import type { StudyPlanner } from "./planner-schema.ts";

/** Page 6: cumulative windows, repeated grouped cycles and final review. */
export function reviewWindows(plan: StudyPlanner): PlannerWeek[] {
  const seen = new Set<string>();
  const result: PlannerWeek[] = [];
  for (const week of buildWeeks(plan)) {
    if (week.start >= plan.examDate) continue;
    if (week.kind === "cumulative") result.push({ ...week, cycleIds: [...seen] });
    else if (week.kind === "final") result.push({ ...week, cycleIds: plan.cycles.map(c => c.id) });
    else if (week.kind === "cycle") {
      if (week.cycleIds.length > 1 && week.cycleIds.every(id => seen.has(id))) result.push(week);
      week.cycleIds.forEach(id => seen.add(id));
    }
  }
  return result;
}

function scopeFor(state: StudyState, review: Review): string[] {
  const plan = state.planner!;
  const valid = new Set(plan.cycles.map(c => c.id));
  const existing = review.calendar?.cycleIds.filter(id => valid.has(id)) || [];
  if (existing.length) return existing;
  const sessions = state.sessions.filter(s => s.subjectId === review.subjectId && s.topic === review.title);
  const linked = [...new Set(sessions.flatMap(s => s.plannerRef && valid.has(s.plannerRef.cycleId) ? [s.plannerRef.cycleId] : []))];
  if (linked.length) return linked;
  const norm = (s:string) => s.trim().toLocaleLowerCase("pt-BR");
  const exact = plan.cycles.filter(c => c.blocks.some(b => b.subjectId === review.subjectId && [b.title, ...b.topics].some(t => norm(t) === norm(review.title))));
  if (exact.length) return exact.map(c => c.id);
  // Free study / error notebook: use the discipline's cycles, never an invented next-day interval.
  return plan.cycles.filter(c => c.blocks.some(b => b.subjectId === review.subjectId)).map(c => c.id);
}

export function reconcileReviews(state: StudyState, referenceDay = todayKey()): StudyState {
  if (!state.planner) return state;
  const windows = reviewWindows(state.planner);
  const reviews = state.reviews.map((review): Review => {
    const error = state.errors.find(e => e.subjectId === review.subjectId && review.title === `Caderno de erros: ${e.question.slice(0,110)}`);
    const errorDate = error ? (error.createdAt.length === 10 ? error.createdAt : todayKey(new Date(error.createdAt))) : undefined;
    const sourceDate = review.calendar?.sourceDate || state.sessions.filter(s => s.subjectId === review.subjectId && s.topic === review.title && s.date <= referenceDay).sort((a,b) => a.date.localeCompare(b.date))[0]?.date || errorDate || referenceDay;
    const cycleIds = scopeFor(state, review);
    const afterDate = review.calendar?.afterDate;
    const finishedWeeks = new Set((state.reviewCompletions || []).filter(c => c.reviewId === review.id).map(c => c.weekId));
    const week = windows.find(w => !finishedWeeks.has(w.id) && w.end >= sourceDate && (!afterDate || w.start > afterDate) && (!cycleIds.length || w.cycleIds.some(id => cycleIds.includes(id))));
    return { ...review, completed: !week, dueDate: week?.start || review.dueDate, interval: 1,
      calendar: { cycleIds, sourceDate, ...(afterDate ? { afterDate } : {}), ...(week ? { weekId: week.id, endDate: week.end, label: week.title } : {}) } };
  });
  return { ...state, reviews };
}

export function completeReview(state: StudyState, reviewId: string, rating: "again" | "good" | "easy", referenceDay = todayKey()): StudyState {
  const normalized = reconcileReviews(state, referenceDay);
  const review = normalized.reviews.find(r => r.id === reviewId);
  if (!review || review.completed || review.dueDate > referenceDay) return normalized;
  // A difficult card stays in its assigned window until the student can recall it.
  if (rating === "again") return normalized;
  const completionId = `${review.id}@${review.calendar?.weekId || review.dueDate}`;
  const completions = normalized.reviewCompletions || [];
  if (completions.some(c => c.id === completionId)) return normalized;
  return reconcileReviews({ ...normalized,
    reviewCompletions: [...completions, { id: completionId, reviewId, date: referenceDay, ...(review.calendar?.weekId ? {weekId:review.calendar.weekId} : {}) }],
    reviews: normalized.reviews.map(r => r.id !== reviewId ? r : r.calendar
      ? { ...r, calendar: { ...r.calendar, afterDate: r.dueDate } }
      : scheduleReview(r, rating, referenceDay)),
  }, referenceDay);
}
