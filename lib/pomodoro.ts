import { z } from "zod";

export const pomodoroSettingsSchema = z.object({
  focus: z.number().int().min(1).max(180), short: z.number().int().min(1).max(60), long: z.number().int().min(1).max(120),
  rounds: z.number().int().min(2).max(12), autoBreak: z.boolean(), autoFocus: z.boolean(), sound: z.boolean(), notifications: z.boolean(),
}).strict();
export type PomodoroSettings = z.infer<typeof pomodoroSettingsSchema>;
export const defaultPomodoro: PomodoroSettings = { focus:25, short:5, long:15, rounds:4, autoBreak:false, autoFocus:false, sound:true, notifications:false };
export const pomodoroTimerSchema = z.object({
  phase:z.enum(["focus","short","long"]), remainingMs:z.number().min(0).max(10800000), totalMs:z.number().min(60000).max(10800000),
  running:z.boolean(), deadline:z.number().nullable(), accountedAt:z.number(), focusMs:z.number().min(0).max(43200000),
  completedFocus:z.number().int().min(0).max(144), round:z.number().int().min(0).max(100000),
}).strict();
export type PomodoroTimer = z.infer<typeof pomodoroTimerSchema>;
export type Phase = PomodoroTimer["phase"];
export function newTimer(settings:PomodoroSettings, now=Date.now()):PomodoroTimer {
  return {phase:"focus",remainingMs:settings.focus*60000,totalMs:settings.focus*60000,running:false,deadline:null,accountedAt:now,focusMs:0,completedFocus:0,round:0};
}
function account(timer:PomodoroTimer,now:number):PomodoroTimer {
  if (!timer.running || timer.deadline === null) return timer;
  const elapsed = Math.max(0,Math.min(now,timer.deadline)-timer.accountedAt);
  return {...timer, remainingMs:Math.max(0,timer.deadline-now), accountedAt:Math.min(now,timer.deadline), focusMs:Math.min(43200000,timer.focusMs+(timer.phase==="focus"?elapsed:0))};
}
export function setRunning(timer:PomodoroTimer,running:boolean,now=Date.now()):PomodoroTimer {
  const t=account(timer,now);
  return {...t,running,deadline:running?now+t.remainingMs:null,accountedAt:now};
}
export function changePhase(timer:PomodoroTimer,phase:Phase,settings:PomodoroSettings,now=Date.now()):PomodoroTimer {
  const t=account(timer,now),duration=settings[phase]*60000;
  return {...t,phase,remainingMs:duration,totalMs:duration,running:false,deadline:null,accountedAt:now};
}
export function tickTimer(timer:PomodoroTimer,settings:PomodoroSettings,now=Date.now()):{timer:PomodoroTimer; finished:Phase|null} {
  const t=account(timer,now);
  if(!t.running || t.remainingMs>0) return {timer:t,finished:null};
  const round=t.round+(t.phase==="focus"?1:0);
  const next:Phase=t.phase==="focus"?(round%settings.rounds===0?"long":"short"):"focus";
  const moved=changePhase({...t,round,completedFocus:Math.min(144,t.completedFocus+(t.phase==="focus"?1:0))},next,settings,now);
  // Advance once, from now. A suspended tab never fabricates multiple completed rounds.
  return {timer:setRunning(moved,next==="focus"?settings.autoFocus:settings.autoBreak,now),finished:t.phase};
}
