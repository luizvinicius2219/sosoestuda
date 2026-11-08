import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPomodoro, newTimer, setRunning, changePhase, tickTimer, pomodoroTimerSchema, pomodoroSettingsSchema } from '../lib/pomodoro.ts';
const settings={...defaultPomodoro,focus:1,short:1,long:2,rounds:2};
test('focus counts actual elapsed time while pauses and breaks never count as study',()=>{
 let t=setRunning(newTimer(settings,0),true,0);t=tickTimer(t,settings,20000).timer;assert.equal(t.focusMs,20000);
 t=setRunning(t,false,30000);assert.equal(t.focusMs,30000);t=tickTimer(t,settings,100000).timer;assert.equal(t.focusMs,30000);
 t=setRunning(t,true,100000);let result=tickTimer(t,settings,130000);t=result.timer;assert.equal(result.finished,'focus');assert.equal(t.focusMs,60000);assert.equal(t.completedFocus,1);assert.equal(t.phase,'short');assert.equal(t.running,false);
 t=setRunning(t,true,130000);t=tickTimer(t,settings,190000).timer;assert.equal(t.focusMs,60000);assert.equal(t.phase,'focus');
});
test('long break follows the configured completed rounds; skipping cannot create a completed Pomodoro',()=>{
 let t=setRunning(newTimer(settings,0),true,0);t=tickTimer(t,settings,60000).timer;t=changePhase(t,'focus',settings,60000);t=setRunning(t,true,60000);t=tickTimer(t,settings,120000).timer;
 assert.equal(t.phase,'long');assert.equal(t.remainingMs,120000);assert.equal(t.completedFocus,2);assert.equal(t.round,2);
 let partial=setRunning(newTimer(settings,0),true,0);partial=changePhase(partial,'short',settings,10000);assert.equal(partial.focusMs,10000);assert.equal(partial.completedFocus,0);assert.equal(partial.round,0);
});
test('an inactive tab finishes exactly one stage and never invents hours of rounds',()=>{
 const auto={...settings,autoBreak:true,autoFocus:true};const t=setRunning(newTimer(auto,0),true,0);
 const result=tickTimer(t,auto,3600000);assert.equal(result.timer.completedFocus,1);assert.equal(result.timer.focusMs,60000);assert.equal(result.timer.phase,'short');assert.equal(result.timer.deadline,3660000);
 assert.equal(tickTimer(result.timer,auto,3600000).finished,null);
});
test('resetting a stage preserves banked time and serialized reload preserves remaining time',()=>{
 let t=setRunning(newTimer(settings,0),true,0);t=tickTimer(t,settings,20000).timer;
 const restored=pomodoroTimerSchema.parse(JSON.parse(JSON.stringify(t)));assert.equal(tickTimer(restored,settings,25000).timer.focusMs,25000);
 t=changePhase(t,'focus',settings,25000);assert.equal(t.remainingMs,60000);assert.equal(t.focusMs,25000);assert.equal(t.running,false);
});
test('custom durations and auto-start toggles validate sensible limits',()=>{
 assert.equal(pomodoroSettingsSchema.safeParse({...settings,focus:0}).success,false);assert.equal(pomodoroSettingsSchema.safeParse({...settings,rounds:1}).success,false);
 assert.equal(pomodoroSettingsSchema.safeParse({...settings,focus:90,short:15,long:30}).success,true);
 const auto={...settings,autoBreak:true};const result=tickTimer(setRunning(newTimer(auto,0),true,0),auto,60000);assert.equal(result.timer.running,true);assert.equal(result.timer.deadline,120000);
});
