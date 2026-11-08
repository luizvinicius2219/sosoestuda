import assert from "node:assert/strict";
import test from "node:test";
import { addDays, calculateStats, completeStudy, createInitialState, scheduleReview, studyStateSchema, todayKey, topicKey } from "../lib/study.ts";

test("civil dates use Recife across UTC midnight and leap days", () => {
  assert.equal(todayKey(new Date("2026-11-08T01:00:00Z")), "2026-11-07");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.throws(() => addDays("2026-02-30", 1));
});

test("new account starts without demo records; demo satisfies validation", () => {
  const fresh = createInitialState(false);
  assert.equal(fresh.sessions.length, 0);
  assert.equal(fresh.tasks.length, 0);
  assert.equal(fresh.notes.length, 0);
  assert.equal(studyStateSchema.safeParse(fresh).success, true);
  assert.equal(studyStateSchema.safeParse(createInitialState()).success, true);
  const stats = calculateStats(fresh);
  assert.equal(stats.xp, 0);
  assert.equal(stats.accuracy, 0);
  assert.equal(stats.streak, 0);
  assert.equal(stats.level, 1);
});

test("stats count this civil week and a streak ending yesterday", () => {
  const state = createInitialState(false);
  state.sessions = [
    { id: "1", subjectId: "portugues", topic: "Texto", minutes: 30, questions: 10, correct: 8, date: "2026-11-05" },
    { id: "2", subjectId: "portugues", topic: "Texto", minutes: 40, questions: 10, correct: 10, date: "2026-11-06" },
    { id: "3", subjectId: "portugues", topic: "Texto", minutes: 50, questions: 0, correct: 0, date: "2026-11-01" },
    { id: "future", subjectId: "portugues", topic: "Texto", minutes: 100, questions: 100, correct: 100, date: "2026-11-08" },
  ];
  state.completedTopics = [topicKey("portugues", 0), topicKey("portugues", 0), "invalid"];
  const stats = calculateStats(state, "2026-11-07");
  assert.equal(stats.totalMinutes, 120);
  assert.equal(stats.weekMinutes, 70);
  assert.equal(stats.accuracy, 90);
  assert.equal(stats.streak, 2);
  assert.equal(stats.completedTopics, 1);
  assert.equal(stats.baseXp, 319);
  assert.equal(stats.achievementXp, 125);
  assert.equal(stats.xp, 444);
  assert.equal(calculateStats(state, "2026-11-09").streak, 1);
});

test("overdue review schedules from today, caps intervals and preserves source", () => {
  const review = { id: "r1", subjectId: "portugues", title: "Crase", dueDate: "2026-09-01", interval: 7 };
  assert.equal(scheduleReview(review, "again", "2026-11-07").dueDate, "2026-11-08");
  assert.equal(scheduleReview(review, "good", "2026-11-07").interval, 14);
  assert.equal(scheduleReview(review, "easy", "2026-11-07").interval, 21);
  assert.equal(scheduleReview({ ...review, interval: 365 }, "easy", "2026-11-07").interval, 365);
  assert.equal(review.dueDate, "2026-09-01");
});

test("complete study creates tomorrow's review once and rejects invalid scores", () => {
  const state = createInitialState(false);
  const input = { subjectId: "portugues", topic: "Interpretação de textos", minutes: 25, questions: 10, correct: 8 };
  const next = completeStudy(state, input);
  assert.equal(next.sessions.length, 1);
  assert.equal(next.reviews[0].dueDate, addDays(todayKey(), 1));
  assert.equal(next.reviews[0].interval, 1);
  assert.equal(completeStudy(next, input).reviews.length, 1);
  next.reviews[0] = { ...next.reviews[0], interval: 30, dueDate: addDays(todayKey(), 30) };
  const restudied = completeStudy(next, input);
  assert.equal(restudied.reviews.length, 1);
  assert.equal(restudied.reviews[0].dueDate, addDays(todayKey(), 1));
  assert.equal(restudied.reviews[0].interval, 1);
  assert.equal(state.sessions.length, 0);
  assert.throws(() => completeStudy(state, { ...input, correct: 11 }));
  assert.throws(() => completeStudy(state, { ...input, subjectId: "missing" }));
});

test("validation rejects orphan records, impossible dates and duplicate XP topics", () => {
  const state = createInitialState();
  assert.equal(studyStateSchema.safeParse({ ...state, sessions: [{ ...state.sessions[0], correct: 99 }] }).success, false);
  assert.equal(studyStateSchema.safeParse({ ...state, tasks: [{ ...state.tasks[0], subjectId: "missing" }] }).success, false);
  assert.equal(studyStateSchema.safeParse({ ...state, tasks: [{ ...state.tasks[0], date: "2026-02-30" }] }).success, false);
  assert.equal(studyStateSchema.safeParse({ ...state, completedTopics: ["portugues:0", "portugues:0"] }).success, false);
});

test("stats ignore invalid and future sessions instead of creating impossible XP or percentages", () => {
  const state = createInitialState(false);
  state.sessions = [
    { id: "zero", subjectId: "portugues", topic: "Texto", minutes: 0, questions: 0, correct: 0, date: "2026-11-07" },
    { id: "invalid-score", subjectId: "portugues", topic: "Texto", minutes: 25, questions: 1, correct: 500, date: "2026-11-07" },
    { id: "future", subjectId: "portugues", topic: "Texto", minutes: 25, questions: 1, correct: 1, date: "2026-11-08" },
  ];
  let stats = calculateStats(state, "2026-11-07");
  assert.equal(stats.xp, 0);
  assert.equal(stats.accuracy, 0);
  assert.equal(stats.streak, 0);
  state.sessions.push({ id: "valid", subjectId: "portugues", topic: "Texto", minutes: 25, questions: 10, correct: 10, date: "2026-11-07" });
  stats = calculateStats(state, "2026-11-07");
  assert.equal(stats.baseXp, 80);
  assert.equal(stats.xp, 130);
  assert.equal(stats.accuracy, 100);
  assert.equal(stats.streak, 1);
  assert.equal(calculateStats(state, "2026-11-11").streak, 0);
});

test("form boundary values save without a backend mismatch", () => {
  const state = createInitialState(false);
  state.profile = { name: "N".repeat(80), goal: "G".repeat(120), dailyMinutes: 720, weeklyMinutes: 5040, examDate: "" };
  const next = completeStudy(state, { subjectId: "portugues", topic: "T".repeat(200), minutes: 720, questions: 1000, correct: 1000 });
  next.tasks.push({ id: "max-task", subjectId: "portugues", title: "T".repeat(200), minutes: 480, date: todayKey(), done: false });
  next.notes.push({ id: "max-note", subjectId: "portugues", title: "T".repeat(200), content: "N".repeat(15000), updatedAt: todayKey() });
  next.errors.push({ id: "max-error", subjectId: "portugues", question: "Q".repeat(3000), answer: "A".repeat(6000), reason: "R".repeat(1000), createdAt: todayKey(), resolved: false });
  assert.equal(studyStateSchema.safeParse(next).success, true);
  next.subjects[0].topics = ["T".repeat(501)];
  assert.equal(studyStateSchema.safeParse(next).success, false);
});
