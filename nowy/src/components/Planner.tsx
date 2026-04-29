import React, { useState, useEffect } from 'react';
import { DAL } from '../services/DAL';
import { Habit, Goal } from '../types';
import { format, addDays, startOfToday, isSameDay, getDay, getDate, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Check, Circle, Clock, ChevronLeft, ChevronRight, CalendarDays, Flame, Zap, LayoutGrid, List } from 'lucide-react';
import { ProgressEngine } from '../services/ProgressEngine';
import { SocialManager } from '../services/SocialManager';
import { AudioService } from '../services/AudioService';
import toast from 'react-hot-toast';
import { auth } from '../lib/firebase';

import { HabitUtils } from '../utils/HabitUtils';

export default function Planner() {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [baseDate, setBaseDate] = useState(startOfToday());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [logs, setLogs] = useState<Record<string, { completed: boolean, count: number }>>({});
  const [loading, setLoading] = useState(true);

  // Refs for debouncing sync
  const syncTimeoutsRef = React.useRef<Record<string, NodeJS.Timeout>>({});
  // Ref to track local optimistic updates and their timestamps per date
  // This prevents the Firestore listener from overriding local state during a grace period
  const localUpdatesRef = React.useRef<Record<string, Record<string, { count: number, completed: boolean, timestamp: number }>>>({});

  // Horizontal days list: 7 days starting from baseDate
  const upcomingDays = Array.from({ length: 7 }, (_, i) => addDays(baseDate, i));

  const navigateForward = () => setBaseDate(prev => addDays(prev, viewMode === 'week' ? 7 : 30));
  const navigateBackward = () => setBaseDate(prev => addDays(prev, viewMode === 'week' ? -7 : -30));

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLogs({}); // Clear logs when switching days to prevent state bleed
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Subscribe to habits
    const unsubHabits = DAL.subscribeToHabits((habitData) => {
      setHabits(habitData);
      setLoading(false);
    });

    // Subscribe to logs for the selected date
    const unsubLogs = DAL.subscribeToHabitLogs(dateStr, (logData) => {
      setLogs(prev => {
        // Build fresh map from server data
        const logsMap: Record<string, { completed: boolean, count: number }> = {};
        const now = Date.now();
        const GRACE_PERIOD = 2500;
        
        // Ensure the Ref has a sub-object for this date
        if (!localUpdatesRef.current[dateStr]) {
          localUpdatesRef.current[dateStr] = {};
        }
        const localDateUpdates = localUpdatesRef.current[dateStr];

        logData.forEach(l => {
          const local = localDateUpdates[l.habitId];
          // Optimization: Check if the local update is for the SAME DATE
          if (!local || (now - local.timestamp > GRACE_PERIOD)) {
            logsMap[l.habitId] = { completed: l.completed, count: l.count || 0 };
            if (local) delete localDateUpdates[l.habitId];
          } else {
            // Keep the optimistic state
            logsMap[l.habitId] = { completed: local.completed, count: local.count };
          }
        });

        // Ensure habits without logs are still present if they have an active optimistic update
        Object.entries(localDateUpdates).forEach(([id, localData]) => {
          const local = localData as { count: number, completed: boolean, timestamp: number };
          if (!logsMap[id] && (now - local.timestamp <= GRACE_PERIOD)) {
            logsMap[id] = { completed: local.completed, count: local.count };
          }
        });

        return logsMap;
      });
    });

    // Fetch goals
    DAL.getGoals().then(setGoals);

    return () => {
      unsubHabits();
      unsubLogs();
      // Clear all pending syncs on unmount
      Object.values(syncTimeoutsRef.current).forEach(clearTimeout);
    };
  }, [selectedDate]);

  const isHabitVisible = (habit: Habit, date: Date) => {
    return HabitUtils.isHabitVisibleAtDate(habit, date);
  };

  const handleToggleHabit = (habit: Habit) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    // For non-daily habits, we always use a binary toggle (1 instance per day)
    const target = habit.frequency === 'daily' ? (habit.targetCount || 1) : 1;
    
    // 1. CALCULATE NEXT STATE
    const currentLog = logs[habit.id] || { completed: false, count: 0 };
    let nextCount = currentLog.count + 1;
    let nextCompleted = nextCount >= target;

    if (target === 1) {
      nextCompleted = !currentLog.completed;
      nextCount = nextCompleted ? 1 : 0;
    } else if (currentLog.completed) {
      nextCount = 0;
      nextCompleted = false;
    }

    // 2. IMMEDIATE STATE UPDATE (OPTIMISTIC)
    if (nextCompleted && !currentLog.completed) {
      AudioService.playSuccess();
    }
    
    setLogs(prev => ({
      ...prev,
      [habit.id]: { completed: nextCompleted, count: nextCount }
    }));

    // 3. SAVE TO LOCAL REF (LOCK FOR GRACE PERIOD) - Make it date-aware
    if (!localUpdatesRef.current[dateStr]) {
      localUpdatesRef.current[dateStr] = {};
    }
    localUpdatesRef.current[dateStr][habit.id] = {
      count: nextCount,
      completed: nextCompleted,
      timestamp: Date.now()
    };

    // 4. DEBOUNCED BACKGROUND SYNC
    // Clear any previous pending sync for this habit
    if (syncTimeoutsRef.current[habit.id]) {
      clearTimeout(syncTimeoutsRef.current[habit.id]);
    }

    // Schedule new sync
    syncTimeoutsRef.current[habit.id] = setTimeout(async () => {
      try {
        await DAL.logHabit(habit.id, dateStr, nextCompleted, nextCount);
        // Only run heavy logic if this was the last update
        ProgressEngine.recalculateGoalProgress(habit.goalId);
        ProgressEngine.updateHabitStreak(habit.id);
        
        if (nextCompleted && target === 1) {
           if (isSameDay(selectedDate, startOfToday())) {
              SocialManager.shareHabitCompletion(habit.name, habit.id, habit.streak, habit.frequency);
           }
        }
        delete syncTimeoutsRef.current[habit.id];
      } catch (e) {
        console.error("Delayed sync failed", e);
      }
    }, 800); // 800ms debounce: Perfect balance between speed and efficiency

    // Immediate feedback toast (only on completion and only once per toggle session ideally, 
    // but here we just keep it simple)
    if (nextCompleted && !currentLog.completed && target === 1) {
       toast.success(`Hábito completado`, { duration: 600, position: 'bottom-center' });
    }
  };

  const filteredHabits = habits.filter(h => isHabitVisible(h, selectedDate));

  // Monthly Calendar Logic
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="flex flex-col h-full gap-6 pb-32 normal-case">
      {/* Date Header: Month Display with Picker & View Switcher */}
      <div className="flex items-center justify-between px-2 pt-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-blue opacity-80">
          {format(baseDate, 'MMMM yyyy', { locale: es })}
        </h3>
        <div className="flex items-center gap-2">
           <div className="flex bg-card-bg border border-card-border rounded-xl p-1">
              <button 
                onClick={() => setViewMode('week')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'week' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted hover:text-brand-blue'}`}
              >
                <List size={16} />
              </button>
              <button 
                onClick={() => setViewMode('month')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'month' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted hover:text-brand-blue'}`}
              >
                <LayoutGrid size={16} />
              </button>
           </div>
           <div className="relative group">
            <button className="p-2 text-brand-blue bg-brand-blue/10 rounded-xl border border-brand-blue/20 group-hover:bg-brand-blue/20 transition-all pointer-events-none">
              <CalendarDays size={20} />
            </button>
            <input 
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer z-20 w-full h-full"
              onChange={(e) => {
                const dateParts = e.target.value.split('-');
                if (dateParts.length === 3) {
                  const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
                  if (!isNaN(date.getTime())) {
                    setSelectedDate(date);
                    setBaseDate(date);
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Date Selector Navigation */}
      <div className="flex items-center gap-2 px-1">
        <button 
          onClick={navigateBackward}
          className="p-2 text-text-muted hover:text-brand-blue bg-card-bg border border-card-border rounded-xl active:scale-95 transition-all"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex-1">
          {viewMode === 'week' ? (
            <div className="grid grid-cols-7 gap-1 sm:gap-2 py-2">
              {upcomingDays.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, startOfToday());
                return (
                   <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all ${
                      isSelected 
                        ? 'bg-brand-blue border-brand-blue text-white shadow-md scale-105 z-10' 
                        : 'bg-card-bg border-card-border text-text-muted hover:border-brand-blue/30'
                    }`}
                  >
                    <span className="text-[6px] sm:text-[7px] font-bold uppercase opacity-80 mb-0.5 sm:mb-1 truncate w-full text-center">
                      {isToday ? 'HOY' : format(day, 'EEE', { locale: es }).replace('.', '')}
                    </span>
                    <span className="text-xs sm:text-sm font-black leading-none">
                      {format(day, 'd')}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
             <div className="grid grid-cols-7 gap-1 p-2 bg-card-bg border border-card-border rounded-3xl overflow-hidden">
                {['L','M','X','J','V','S','D'].map(day => (
                  <div key={day} className="text-[8px] font-black text-text-muted text-center py-1">{day}</div>
                ))}
                {calendarDays.map((day, idx) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, startOfToday());
                  const isCurrentMonth = isSameMonth(day, baseDate);
                  const scheduledHabits = habits.filter(h => isHabitVisible(h, day));
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        if (!isCurrentMonth) setBaseDate(day);
                      }}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all ${
                        isSelected 
                          ? 'bg-brand-blue text-white z-10' 
                          : isToday 
                            ? 'bg-brand-blue/10 text-brand-blue border border-brand-blue/20'
                            : isCurrentMonth ? 'text-[var(--text-main)] hover:bg-surface' : 'text-text-muted/30'
                      }`}
                    >
                      <span className="text-[10px] font-bold">{format(day, 'd')}</span>
                      {scheduledHabits.length > 0 && (
                        <div className="flex gap-0.5 mt-1">
                          {scheduledHabits.slice(0, 3).map(h => (
                            <div key={h.id} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/60' : 'bg-brand-blue'}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
             </div>
          )}
        </div>

        <button 
          onClick={navigateForward}
          className="p-2 text-text-muted hover:text-brand-blue bg-card-bg border border-card-border rounded-xl active:scale-95 transition-all"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Activities List */}
      <div className="flex-1 space-y-6">
        <header className="px-2">
          <div className="title-small uppercase !mb-1">Tu Agenda</div>
          <h2 className="text-2xl font-bold text-[var(--text-main)]">
            {isSameDay(selectedDate, startOfToday()) ? 'Hoy' : format(selectedDate, 'EEEE d MMMM', { locale: es })}
          </h2>
        </header>

        {loading ? (
          <div className="p-10 flex justify-center text-brand-blue">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-4 border-t-transparent rounded-full" />
          </div>
        ) : filteredHabits.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bento-card text-center p-12 flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center text-text-muted">
              <Calendar size={32} />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-main)]">Día libre</h3>
              <p className="text-xs text-text-muted">No tienes actividades programadas para este día.</p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredHabits.map((habit) => {
              const habitLog = logs[habit.id] || { completed: false, count: 0 };
              const target = habit.targetCount;
                return (
                  <div 
                    key={habit.id} 
                    onClick={() => handleToggleHabit(habit)}
                    className={`bento-card !p-4 flex flex-col gap-3 transition-[background-color,border-color,transform,shadow] duration-200 cursor-pointer group active:scale-[0.98] ${
                      habitLog.completed ? 'bg-brand-green/10 border-brand-green/40 shadow-sm' : 'hover:border-brand-blue/30'
                    }`}
                  >
                   <div className="flex justify-between items-center">
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                         <h4 className={`font-bold transition-all truncate ${habitLog.completed ? 'text-brand-green line-through opacity-70' : 'text-[var(--text-main)]'}`}>
                           {habit.name.replace('Acción: ', '')}
                         </h4>
                         {habit.streak > 0 && (
                           <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black animate-pulse-subtle ${
                             habit.streak >= 10 ? 'bg-brand-blue text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                             habit.streak >= 3 ? 'bg-orange-500 text-white shadow-[0_0_6px_rgba(249,115,22,0.4)]' :
                             'bg-orange-500/10 text-orange-600'
                           }`}>
                             {habit.streak >= 10 ? <Zap size={8} fill="currentColor" /> : <Flame size={8} fill={habit.streak >= 3 ? "currentColor" : "none"} />}
                             {habit.streak}
                           </div>
                         )}
                       </div>
                       <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border border-current bg-current/5 ${
                            habit.frequency === 'daily' ? 'text-orange-500' :
                            habit.frequency === 'weekly' ? 'text-brand-blue' :
                            'text-brand-green'
                          }`}>
                            {habit.frequency === 'daily' && target > 1 ? `${habitLog.count}/${target}` : habit.frequency.toUpperCase()}
                          </span>
                          <span className="text-[8px] font-bold text-text-muted bg-surface px-2 py-0.5 rounded-full border border-card-border uppercase">
                            {format(habit.createdAt, 'MMM d', { locale: es })} 
                            {habit.deletedAt ? ` - ${format(habit.deletedAt, 'MMM d', { locale: es })}` : ' - Activo'}
                          </span>
                       </div>
                     </div>
                     <div className={`p-2.5 rounded-xl border transition-[background-color,border-color,color] duration-200 ${habitLog.completed ? 'bg-brand-green border-brand-green text-surface' : 'bg-surface border-card-border text-text-muted group-hover:border-brand-blue/50'}`}>
                        {habitLog.completed ? <Check size={20} /> : <Circle size={20} />}
                     </div>
                   </div>

                   {habit.scheduledTimes && habit.scheduledTimes.length > 0 && (
                     <div className="flex gap-2 flex-wrap pb-1">
                       {habit.scheduledTimes.map((time, i) => (
                         <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all border ${
                           habitLog.count > i ? 'bg-brand-green/10 border-brand-green/30 text-brand-green' : 'bg-surface border-card-border text-text-muted'
                         } text-[9px] font-bold`}>
                           <Clock size={10} className={habitLog.count > i ? 'text-brand-green' : 'text-brand-blue'} />
                           {time}
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
