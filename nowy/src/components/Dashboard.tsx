import React, { useEffect, useState } from 'react';
import { DAL } from '../services/DAL';
import { Goal, Habit, HabitFrequency, TimelinePost } from '../types';
import { Target, TrendingUp, Plus, X, Pencil, Flame, Users, Check, Circle, ThumbsUp, ThumbsDown, Trash2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { ProgressEngine } from '../services/ProgressEngine';
import { SocialManager } from '../services/SocialManager';
import { AudioService } from '../services/AudioService';
import { HabitUtils } from '../utils/HabitUtils';
import { format, getDay, getDate, differenceInDays, startOfDay, getWeekOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { auth, db } from '../lib/firebase';
import { onSnapshot, query, collection, where, orderBy, limit, getDocs } from 'firebase/firestore';
import HabitDetailModal from './HabitDetailModal';

export default function Dashboard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, { completed: boolean, count: number }>>({});
  const [communityUpdates, setCommunityUpdates] = useState<TimelinePost[]>([]);

  const [selectedHabitForStats, setSelectedHabitForStats] = useState<Habit | null>(null);
  const [habitHistory, setHabitHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<{id: string, goalId: string} | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Form States (Goal)
  const [goalTitle, setGoalTitle] = useState('');
  const [goalFreq, setGoalFreq] = useState<HabitFrequency>('daily');
  const [goalScheduledDays, setGoalScheduledDays] = useState<number[]>([]);
  const [goalScheduledTimes, setGoalScheduledTimes] = useState<string[]>(['']);
  const [goalScheduledMonthDays, setGoalScheduledMonthDays] = useState<number[]>([]);
  const [goalIntervalValue, setGoalIntervalValue] = useState(2);
  const [goalAnchorDate, setGoalAnchorDate] = useState(today);
  const [goalMonthlyType, setGoalMonthlyType] = useState<'day_of_month' | 'day_of_week'>('day_of_month');
  const [goalScheduledWeeks, setGoalScheduledWeeks] = useState<number[]>([]);
  
  // Form States (Habit)
  const [habitName, setHabitName] = useState('');
  const [habitFreq, setHabitFreq] = useState<HabitFrequency>('daily');
  const [habitScheduledDays, setHabitScheduledDays] = useState<number[]>([]);
  const [habitScheduledTimes, setHabitScheduledTimes] = useState<string[]>(['']);
  const [habitScheduledMonthDays, setHabitScheduledMonthDays] = useState<number[]>([]);
  const [habitIntervalValue, setHabitIntervalValue] = useState(2);
  const [habitAnchorDate, setHabitAnchorDate] = useState(today);
  const [habitMonthlyType, setHabitMonthlyType] = useState<'day_of_month' | 'day_of_week'>('day_of_month');
  const [habitScheduledWeeks, setHabitScheduledWeeks] = useState<number[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to goals
    const unsubGoals = onSnapshot(query(collection(db, 'goals'), where('userId', '==', user.uid)), (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal)));
    });

    // Subscribe to habits
    const unsubHabits = DAL.subscribeToHabits(setHabits);

    // Subscribe to logs
    const unsubLogs = DAL.subscribeToHabitLogs(today, (logData) => {
      const logsMap: Record<string, { completed: boolean, count: number }> = {};
      logData.forEach(l => {
        logsMap[l.habitId] = { completed: l.completed, count: l.count || 0 };
      });
      setLogs(logsMap);
      setLoading(false);
    });

    // Subscribe to timeline
    const unsubTimeline = DAL.subscribeToTimeline((posts) => {
      const currentUserId = auth.currentUser?.uid;
      const seen = new Set<string>();
      const updates = posts
        .filter(p => (p.type as any) === 'habit_status' && p.userId !== currentUserId)
        .filter(p => {
          const key = `${p.userId}_${p.content}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 5);
      setCommunityUpdates(updates);
    });

    return () => {
      unsubGoals();
      unsubHabits();
      unsubLogs();
      unsubTimeline();
    };
  }, []);

  const handleOpenCreateGoal = () => {
    setEditingGoal(null);
    setGoalTitle('');
    setGoalFreq('daily');
    setGoalScheduledDays([]);
    setGoalScheduledTimes(['']);
    setGoalScheduledMonthDays([]);
    setGoalIntervalValue(2);
    setGoalAnchorDate(today);
    setGoalMonthlyType('day_of_month');
    setGoalScheduledWeeks([]);
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalTitle(goal.title);
    setGoalFreq(goal.frequency);
    const habit = habits.find(h => h.goalId === goal.id);
    setGoalScheduledDays(habit?.scheduledDays || []);
    setGoalScheduledTimes(habit?.scheduledTimes || ['']);
    setGoalScheduledMonthDays(habit?.scheduledMonthDays || []);
    setGoalIntervalValue(habit?.intervalValue || 2);
    setGoalAnchorDate(habit?.anchorDate || today);
    setGoalMonthlyType(habit?.monthlyType || 'day_of_month');
    setGoalScheduledWeeks(habit?.scheduledWeeks || []);
    setIsGoalModalOpen(true);
  };

  const handleOpenEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setHabitName(habit.name);
    setHabitFreq(habit.frequency);
    setHabitScheduledDays(habit.scheduledDays || []);
    setHabitScheduledTimes(habit.scheduledTimes || ['']);
    setHabitScheduledMonthDays(habit.scheduledMonthDays || []);
    setHabitIntervalValue(habit.intervalValue || 2);
    setHabitAnchorDate(habit.anchorDate || today);
    setHabitMonthlyType(habit.monthlyType || 'day_of_month');
    setHabitScheduledWeeks(habit.scheduledWeeks || []);
    setIsHabitModalOpen(true);
  };

  const calculateTarget = (freq: HabitFrequency, times: string[], daysW: number[], daysM: number[]) => {
    if (freq === 'daily') return times.filter(t => t).length || 1;
    // Weekly/Monthly habits are marked once per scheduled day
    return 1;
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle) return;
    setIsSubmitting(true);
    
    const target = calculateTarget(goalFreq, goalScheduledTimes, goalScheduledDays, goalScheduledMonthDays);

    const habitData: any = {
      frequency: goalFreq,
      targetCount: target,
      scheduledDays: (goalFreq === 'weekly' || (goalFreq === 'monthly' && goalMonthlyType === 'day_of_week')) ? goalScheduledDays : [],
      scheduledTimes: goalFreq === 'daily' ? goalScheduledTimes.filter(t => t) : [],
      scheduledMonthDays: (goalFreq === 'monthly' && goalMonthlyType === 'day_of_month') ? goalScheduledMonthDays : [],
      intervalValue: goalFreq === 'interval' ? (goalIntervalValue || 0) : 1,
      anchorDate: goalFreq === 'interval' ? goalAnchorDate : today,
      monthlyType: goalFreq === 'monthly' ? goalMonthlyType : null,
      scheduledWeeks: (goalFreq === 'monthly' && goalMonthlyType === 'day_of_week') ? goalScheduledWeeks : []
    };

    if (goalFreq === 'interval' && (!goalIntervalValue || goalIntervalValue <= 0)) {
      setIsSubmitting(false);
      toast.error('Especifica un intervalo válido (mayor a 0 días) para que podamos programar tu meta correctamente.');
      return;
    }

    try {
      if (editingGoal) {
        await DAL.saveGoal({ ...editingGoal, title: goalTitle, frequency: goalFreq });
        const habit = habits.find(h => h.goalId === editingGoal.id);
        if (habit) {
          await DAL.saveHabit({ ...habit, ...habitData });
        }
        toast.success('Meta actualizada');
      } else {
        const goalId = await DAL.saveGoal({ title: goalTitle, progress: 0, status: 'active', frequency: goalFreq });
        await DAL.saveHabit({ 
          name: `Acción: ${goalTitle}`, 
          goalId, 
          streak: 0, 
          weight: 1.0,
          ...habitData
        });
        toast.success('Meta creada');
      }
      setIsGoalModalOpen(false);
    } catch (error) { toast.error('Error al guardar'); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabit || !habitName) return;
    setIsSubmitting(true);

    const target = calculateTarget(habitFreq, habitScheduledTimes, habitScheduledDays, habitScheduledMonthDays);

    if (habitFreq === 'interval' && (!habitIntervalValue || habitIntervalValue <= 0)) {
      setIsSubmitting(false);
      toast.error('Especifica un intervalo válido (mayor a 0 días) para que la acción se programe correctamente.');
      return;
    }

    try {
      await DAL.saveHabit({ 
        ...editingHabit, 
        name: habitName, 
        frequency: habitFreq, 
        targetCount: target,
        scheduledDays: (habitFreq === 'weekly' || (habitFreq === 'monthly' && habitMonthlyType === 'day_of_week')) ? habitScheduledDays : [],
        scheduledTimes: habitFreq === 'daily' ? habitScheduledTimes.filter(t => t) : [],
        scheduledMonthDays: (habitFreq === 'monthly' && habitMonthlyType === 'day_of_month') ? habitScheduledMonthDays : [],
        intervalValue: habitFreq === 'interval' ? (habitIntervalValue || 0) : 1,
        anchorDate: habitFreq === 'interval' ? habitAnchorDate : today,
        monthlyType: habitFreq === 'monthly' ? habitMonthlyType : null,
        scheduledWeeks: (habitFreq === 'monthly' && habitMonthlyType === 'day_of_week') ? habitScheduledWeeks : []
      });
      toast.success('Hábito actualizado');
      setIsHabitModalOpen(false);
    } catch (error) { toast.error('Error al actualizar'); }
    finally { setIsSubmitting(false); }
  };

  const openHabitStats = async (habit: Habit) => {
    setSelectedHabitForStats(habit);
    setIsLoadingHistory(true);
    setHabitHistory([]);
    
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Fetch last 30 days of logs for this habit
      const q = query(
        collection(db, 'habitLogs'), 
        where('userId', '==', user.uid),
        where('habitId', '==', habit.id), 
        orderBy('date', 'desc'),
        limit(30)
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => doc.data());
      setHabitHistory(history);
    } catch (e) {
      console.error("Error fetching habit history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleToggleHabit = async (habit: Habit, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentLog = logs[habit.id] || { completed: false, count: 0 };
    // For non-daily habits, we always use a binary toggle (1 instance per day)
    const target = habit.frequency === 'daily' ? (habit.targetCount || 1) : 1;
    let nextCount = currentLog.count + 1;
    let nextCompleted = nextCount >= target;

    if (target === 1) {
       nextCompleted = !currentLog.completed;
       nextCount = nextCompleted ? 1 : 0;
    } else if (currentLog.completed) {
       nextCount = 0;
       nextCompleted = false;
    }

    setLogs(prev => ({ ...prev, [habit.id]: { completed: nextCompleted, count: nextCount } }));
    try {
      await DAL.logHabit(habit.id, today, nextCompleted, nextCount);
      await ProgressEngine.recalculateGoalProgress(habit.goalId);
      await ProgressEngine.updateHabitStreak(habit.id);
      if (nextCompleted && !currentLog.completed) {
        AudioService.playSuccess();
        toast.success(`¡"${habit.name}" completado!`, { icon: '🚀', duration: 2000 });
        await SocialManager.shareHabitCompletion(habit.name, habit.id, habit.streak, habit.frequency);
      }
    } catch (error) { toast.error('Error al guardar'); }
  };

  const handleDeleteHabit = async (id: string, goalId: string) => {
    try {
      await DAL.deleteHabit(id);
      await ProgressEngine.recalculateGoalProgress(goalId);
      toast.success('Hábito eliminado');
      setHabitToDelete(null);
    } catch (error) { toast.error('Error al eliminar'); }
  };

  const isHabitVisible = (habit: Habit, date: Date) => {
    return HabitUtils.isHabitVisibleAtDate(habit, date);
  };

  const todayHabits = habits.filter(h => isHabitVisible(h, new Date()));
  const completedToday = todayHabits.filter(h => logs[h.id]?.completed).length;
  const todayProgress = todayHabits.length > 0 ? Math.round((completedToday / todayHabits.length) * 100) : 0;

  const chartData = [{ name: 'Done', value: todayProgress }, { name: 'Left', value: 100 - todayProgress }];
  const COLORS = ['#3B82F6', '#334155'];

  const groupedData = (['daily', 'weekly', 'monthly', 'interval'] as const).map(freq => {
    const freqGoals = goals.filter(g => g.frequency === freq).sort((a,b) => b.progress - a.progress);
    const freqHabits = habits.filter(h => !h.deletedAt && h.frequency === freq).sort((a,b) => (logs[a.id]?.completed ? 1 : 0) - (logs[b.id]?.completed ? 1 : 0));
    return { freq, goals: freqGoals, habits: freqHabits };
  });

  return (
    <div className="space-y-8 pb-32 normal-case">
      <header className="flex justify-between items-center px-1">
        <div className="flex flex-col">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)]">{format(new Date(), 'EEEE, d MMMM', { locale: es })}</h2>
        </div>
        <button onClick={handleOpenCreateGoal} className="bg-brand-blue/20 text-brand-blue p-2.5 sm:p-3 rounded-2xl border border-brand-blue/30 overflow-hidden active:scale-95 transition-all">
          <Plus size={24} />
        </button>
      </header>

      {/* Global Progress */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bento-card-green relative overflow-hidden">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={chartData} innerRadius={25} outerRadius={35} paddingAngle={5} dataKey="value" stroke="none">
                {chartData.map((e, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center font-extrabold text-brand-green text-sm sm:text-base">{todayProgress}%</div>
          </div>
          <div className="min-w-0">
            <div className="title-small !mb-0 text-[9px] sm:text-[11px]">Productividad</div>
            <h3 className="text-2xl sm:text-4xl font-bold text-[var(--text-main)] truncate">{todayProgress}%</h3>
            <p className="text-[10px] sm:text-sm text-text-muted">Cumplimiento total</p>
          </div>
        </div>
      </motion.div>

      {/* Sections Grouped by Frequency */}
      <div className="space-y-12">
        {groupedData.map(({ freq, habits: hList }) => hList.length > 0 && (
          <div key={freq} className="space-y-6">
            <div className="title-small flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Flame size={14} className={freq === 'daily' ? 'text-orange-500' : 'text-brand-blue'} />
                {freq === 'daily' ? 'Frecuencia Diaria' : 
                 freq === 'weekly' ? 'Frecuencia Semanal' : 
                 freq === 'monthly' ? 'Frecuencia Mensual' : 
                 'Frecuencia de Intervalos'}
              </div>
            </div>

            {/* Combined Goal-Habit Cards */}
            <div className="grid grid-cols-1 gap-4">
              {hList.map(habit => {
                const goal = goals.find(g => g.id === habit.goalId);
                const isDone = logs[habit.id]?.completed;
                const isScheduledToday = isHabitVisible(habit, new Date());
                
                return (
                  <div 
                    key={habit.id} 
                    onClick={() => openHabitStats(habit)}
                    className={`bento-card relative overflow-hidden transition-all cursor-pointer ${
                      isDone ? 'bg-brand-green/5 border-brand-green/30 opacity-90' : 'hover:border-brand-blue/30 shadow-md hover:shadow-lg scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center justify-between relative z-10 gap-4 mb-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="min-w-0">
                          <h4 className={`font-bold transition-all truncate ${isDone ? 'text-brand-green line-through' : 'text-[var(--text-main)]'}`}>
                            {habit.name.replace('Acción: ', '')}
                          </h4>
                          <div className="flex items-center gap-4 mt-1.5">
                            <div className="flex items-center gap-4 text-xs font-bold text-text-muted">
                              <span className="flex items-center gap-1.5 text-brand-blue"><ThumbsUp size={16} /> {habit.likes ?? 0}</span>
                              <span className="flex items-center gap-1.5 text-rose-500"><ThumbsDown size={16} /> {habit.dislikes ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {isScheduledToday ? (
                            <button 
                              onClick={(e) => handleToggleHabit(habit, e)}
                              className={`p-2.5 rounded-xl transition-all ${
                                isDone 
                                  ? 'bg-brand-green text-white shadow-lg shadow-brand-green/20 scale-110' 
                                  : 'bg-surface text-text-muted border border-card-border hover:border-brand-blue/30 active:scale-95'
                              }`}
                            >
                              <Check size={20} className={isDone ? 'stroke-[3px]' : 'stroke-[2px]'} />
                            </button>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-surface/30 text-text-muted/30 border border-dotted border-card-border">
                              <Check size={20} className="opacity-20" />
                            </div>
                          )}
                          {habit.streak > 0 && (
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black animate-pulse-subtle shadow-sm ${
                              habit.streak >= 10 ? 'bg-brand-blue text-white shadow-[0_0_10px_rgba(59,130,246,0.6)]' :
                              habit.streak >= 3 ? 'bg-orange-500 text-white shadow-[0_0_8px_rgba(249,115,22,0.4)]' :
                              'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                            }`}>
                              {habit.streak >= 10 ? <Zap size={12} fill="currentColor" /> : <Flame size={12} fill={habit.streak >= 3 ? "currentColor" : "none"} />}
                              {habit.streak}d
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenEditHabit(habit); }}
                              className="p-2.5 text-text-muted hover:text-brand-blue transition-colors bg-surface/50 rounded-xl border border-transparent hover:border-brand-blue/20"
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setHabitToDelete({id: habit.id, goalId: habit.goalId}); }}
                              className="p-2.5 text-text-muted hover:text-rose-500 transition-colors bg-surface/50 rounded-xl border border-transparent hover:border-rose-500/20"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedHabitForStats && (
          <HabitDetailModal 
            habit={selectedHabitForStats}
            goal={goals.find(g => g.id === selectedHabitForStats.goalId)}
            history={habitHistory}
            isLoading={isLoadingHistory}
            onClose={() => setSelectedHabitForStats(null)}
          />
        )}
        {isGoalModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGoalModalOpen(false)} className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-card-bg rounded-t-[40px] border-t border-card-border p-8 z-[70] shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-[var(--text-main)]">{editingGoal ? 'Editar Meta' : 'Nueva Meta'}</h3>
                <button onClick={() => setIsGoalModalOpen(false)} className="p-2 bg-surface rounded-full text-text-muted"><X size={20} /></button>
              </div>
              <form onSubmit={handleSaveGoal} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <label className="title-small block mb-2">Nombre de la Meta</label>
                  <input type="text" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} className="m3-input w-full" required />
                </div>
                <div>
                  <label className="title-small block mb-3">Frecuencia</label>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {(['daily', 'weekly', 'monthly', 'interval'] as const).map(freq => (
                      <button key={freq} type="button" onClick={() => setGoalFreq(freq)} className={`py-3 rounded-2xl font-bold text-[8px] border-2 transition-all ${goalFreq === freq ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' : 'bg-surface border-card-border text-text-muted'}`}>
                        {freq.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {goalFreq === 'interval' && (
                    <div className="mb-4 space-y-6">
                      <div>
                        <label className="title-small block mb-3">Cada cuántos días</label>
                        <div className="flex flex-col items-center">
                          <motion.div 
                            whileFocus={{ scale: 1.05 }}
                            className="relative w-full max-w-[200px]"
                          >
                            <input 
                              type="number" 
                              min="1" 
                              value={goalIntervalValue || ''} 
                              onChange={(e) => setGoalIntervalValue(parseInt(e.target.value))} 
                              className="w-full text-center text-4xl font-black bg-surface border-2 border-card-border rounded-3xl py-6 text-brand-blue focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 transition-all outline-none"
                              placeholder="?"
                            />
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-brand-blue text-white text-[10px] font-black rounded-full shadow-lg">
                              DÍAS
                            </div>
                          </motion.div>
                          <p className="text-[10px] font-bold text-text-muted mt-6 text-center uppercase tracking-widest">Toca el cuadro para cambiar</p>
                        </div>
                      </div>
                      <div className="pt-2">
                        <label className="title-small block mb-2">Fecha de inicio</label>
                        <input type="date" value={goalAnchorDate} onChange={(e) => setGoalAnchorDate(e.target.value)} className="m3-input w-full" />
                        <p className="text-[10px] text-text-muted mt-1 leading-tight">El intervalo se calculará a partir de esta fecha.</p>
                      </div>
                    </div>
                  )}

                  {goalFreq === 'weekly' && (
                    <div className="mb-4">
                      <label className="title-small block mb-2">Días de la semana</label>
                      <div className="flex justify-between gap-1">
                        {DAYS.map((day, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setGoalScheduledDays(prev => 
                                prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                              );
                            }}
                            className={`w-10 h-10 rounded-xl font-bold transition-all border ${goalScheduledDays.includes(i) ? 'bg-brand-blue text-white border-brand-blue' : 'bg-surface border-card-border text-text-muted'}`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {goalFreq === 'daily' && (
                    <div className="mb-4 space-y-3">
                      <label className="title-small block mb-2">Horas programadas</label>
                      {goalScheduledTimes.map((time, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="time" 
                            value={time} 
                            onChange={(e) => {
                              const newTimes = [...goalScheduledTimes];
                              newTimes[idx] = e.target.value;
                              setGoalScheduledTimes(newTimes);
                            }}
                            className="m3-input flex-1"
                          />
                          {goalScheduledTimes.length > 1 && (
                            <button type="button" onClick={() => setGoalScheduledTimes(prev => prev.filter((_, i) => i !== idx))} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setGoalScheduledTimes(prev => [...prev, ''])} className="w-full py-3 border-2 border-dashed border-card-border rounded-2xl text-text-muted font-bold text-xs hover:border-brand-blue hover:text-brand-blue transition-all">
                        + Añadir otra hora
                      </button>
                    </div>
                  )}

                  {goalFreq === 'monthly' && (
                    <div className="mb-4 space-y-4">
                      <div className="flex gap-2 p-1 bg-surface rounded-2xl border border-card-border">
                        <button type="button" onClick={() => setGoalMonthlyType('day_of_month')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold transition-all ${goalMonthlyType === 'day_of_month' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted'}`}>Por día</button>
                        <button type="button" onClick={() => setGoalMonthlyType('day_of_week')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold transition-all ${goalMonthlyType === 'day_of_week' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted'}`}>Por semana</button>
                      </div>

                      {goalMonthlyType === 'day_of_month' ? (
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                setGoalScheduledMonthDays(prev => 
                                  prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                );
                              }}
                              className={`h-9 flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${goalScheduledMonthDays.includes(day) ? 'bg-brand-green text-white border-brand-green' : 'bg-surface border-card-border text-text-muted'}`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-text-muted mb-2 block uppercase tracking-wider">Días de la semana</label>
                            <div className="flex justify-between gap-1">
                              {DAYS.map((day, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setGoalScheduledDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                                  className={`w-10 h-10 rounded-xl font-bold transition-all border ${goalScheduledDays.includes(i) ? 'bg-brand-blue text-white border-brand-blue' : 'bg-surface border-card-border text-text-muted'}`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-text-muted mb-2 block uppercase tracking-wider">Semanas del mes</label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map(week => (
                                <button
                                  key={week}
                                  type="button"
                                  onClick={() => setGoalScheduledWeeks(prev => prev.includes(week) ? prev.filter(w => w !== week) : [...prev, week])}
                                  className={`flex-1 py-3 rounded-xl font-bold border transition-all ${goalScheduledWeeks.includes(week) ? 'bg-brand-green text-white border-brand-green' : 'bg-surface border-card-border text-text-muted'}`}
                                >
                                  {week}ª
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button type="submit" disabled={isSubmitting} className="m3-button-primary w-full py-4 text-lg font-bold">{isSubmitting ? 'Guardando...' : 'Confirmar'}</button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Habit Modal */}
      <AnimatePresence>
        {isHabitModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHabitModalOpen(false)} className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-card-bg rounded-t-[40px] border-t border-card-border p-8 z-[70] shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-2xl font-bold text-[var(--text-main)]">Editar Acción</h3>
                 <button onClick={() => setIsHabitModalOpen(false)} className="p-2 bg-surface rounded-full text-text-muted"><X size={20} /></button>
               </div>
               <form onSubmit={handleSaveHabit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                 <div>
                   <label className="title-small block mb-2">Nombre de la Acción</label>
                   <input type="text" value={habitName} onChange={(e) => setHabitName(e.target.value)} className="m3-input w-full" required />
                 </div>
                 <div>
                   <label className="title-small block mb-3">Frecuencia / Objetivo</label>
                   <div className="grid grid-cols-4 gap-2 mb-4">
                      {['daily', 'weekly', 'monthly', 'interval'].map(f => (
                        <button key={f} type="button" onClick={() => setHabitFreq(f as HabitFrequency)} className={`flex-1 py-3 rounded-2xl font-bold text-[8px] border-2 transition-all ${habitFreq === f ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' : 'bg-surface border-card-border text-text-muted'}`}>{f.toUpperCase()}</button>
                      ))}
                   </div>

                    {habitFreq === 'interval' && (
                      <div className="mb-4 space-y-6">
                        <div>
                          <label className="title-small block mb-3">Cada cuántos días</label>
                          <div className="flex flex-col items-center">
                            <motion.div 
                              whileFocus={{ scale: 1.05 }}
                              className="relative w-full max-w-[200px]"
                            >
                              <input 
                                type="number" 
                                min="1" 
                                value={habitIntervalValue || ''} 
                                onChange={(e) => setHabitIntervalValue(parseInt(e.target.value))} 
                                className="w-full text-center text-4xl font-black bg-surface border-2 border-card-border rounded-3xl py-6 text-brand-blue focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 transition-all outline-none"
                                placeholder="?"
                              />
                              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-brand-blue text-white text-[10px] font-black rounded-full shadow-lg">
                                DÍAS
                              </div>
                            </motion.div>
                            <p className="text-[10px] font-bold text-text-muted mt-6 text-center uppercase tracking-widest">Toca el cuadro para cambiar</p>
                          </div>
                        </div>
                        <div className="pt-2">
                          <label className="title-small block mb-2">Fecha de inicio</label>
                          <input type="date" value={habitAnchorDate} onChange={(e) => setHabitAnchorDate(e.target.value)} className="m3-input w-full" />
                          <p className="text-[10px] text-text-muted mt-1 leading-tight">El intervalo se calculará a partir de esta fecha.</p>
                        </div>
                      </div>
                    )}

                   {habitFreq === 'weekly' && (
                    <div className="mb-4">
                      <label className="title-small block mb-2">Días de la semana</label>
                      <div className="flex justify-between gap-1">
                        {DAYS.map((day, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setHabitScheduledDays(prev => 
                                prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                              );
                            }}
                            className={`w-10 h-10 rounded-xl font-bold transition-all border ${habitScheduledDays.includes(i) ? 'bg-brand-blue text-white border-brand-blue' : 'bg-surface border-card-border text-text-muted'}`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {habitFreq === 'daily' && (
                    <div className="mb-4 space-y-3">
                      <label className="title-small block mb-2">Horas programadas</label>
                      {habitScheduledTimes.map((time, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="time" 
                            value={time} 
                            onChange={(e) => {
                              const newTimes = [...habitScheduledTimes];
                              newTimes[idx] = e.target.value;
                              setHabitScheduledTimes(newTimes);
                            }}
                            className="m3-input flex-1"
                          />
                          {habitScheduledTimes.length > 1 && (
                            <button type="button" onClick={() => setHabitScheduledTimes(prev => prev.filter((_, i) => i !== idx))} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setHabitScheduledTimes(prev => [...prev, ''])} className="w-full py-3 border-2 border-dashed border-card-border rounded-2xl text-text-muted font-bold text-xs hover:border-brand-blue hover:text-brand-blue transition-all">
                        + Añadir otra hora
                      </button>
                    </div>
                  )}

                  {habitFreq === 'monthly' && (
                    <div className="mb-4 space-y-4">
                       <div className="flex gap-2 p-1 bg-surface rounded-2xl border border-card-border">
                         <button type="button" onClick={() => setHabitMonthlyType('day_of_month')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold transition-all ${habitMonthlyType === 'day_of_month' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted'}`}>Por día</button>
                         <button type="button" onClick={() => setHabitMonthlyType('day_of_week')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold transition-all ${habitMonthlyType === 'day_of_week' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted'}`}>Por semana</button>
                       </div>

                       {habitMonthlyType === 'day_of_month' ? (
                         <div className="grid grid-cols-7 gap-1">
                           {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                             <button
                               key={day}
                               type="button"
                               onClick={() => {
                                 setHabitScheduledMonthDays(prev => 
                                   prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                 );
                               }}
                               className={`h-9 flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${habitScheduledMonthDays.includes(day) ? 'bg-brand-green text-white border-brand-green' : 'bg-surface border-card-border text-text-muted'}`}
                             >
                               {day}
                             </button>
                           ))}
                         </div>
                       ) : (
                         <div className="space-y-4">
                           <div>
                             <label className="text-[10px] font-bold text-text-muted mb-2 block uppercase tracking-wider">Días de la semana</label>
                             <div className="flex justify-between gap-1">
                               {DAYS.map((day, i) => (
                                 <button
                                   key={i}
                                   type="button"
                                   onClick={() => setHabitScheduledDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                                   className={`w-10 h-10 rounded-xl font-bold transition-all border ${habitScheduledDays.includes(i) ? 'bg-brand-blue text-white border-brand-blue' : 'bg-surface border-card-border text-text-muted'}`}
                                 >
                                   {day}
                                 </button>
                               ))}
                             </div>
                           </div>
                           <div>
                             <label className="text-[10px] font-bold text-text-muted mb-2 block uppercase tracking-wider">Semanas del mes</label>
                             <div className="flex gap-2">
                               {[1, 2, 3, 4, 5].map(week => (
                                 <button
                                   key={week}
                                   type="button"
                                   onClick={() => setHabitScheduledWeeks(prev => prev.includes(week) ? prev.filter(w => w !== week) : [...prev, week])}
                                   className={`flex-1 py-3 rounded-xl font-bold border transition-all ${habitScheduledWeeks.includes(week) ? 'bg-brand-green text-white border-brand-green' : 'bg-surface border-card-border text-text-muted'}`}
                                 >
                                   {week}ª
                                 </button>
                               ))}
                             </div>
                           </div>
                         </div>
                       )}
                    </div>
                  )}

                 </div>
                 <button type="submit" disabled={isSubmitting} className="m3-button-primary w-full py-4 text-lg font-bold">Actualizar Acción</button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {habitToDelete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setHabitToDelete(null)} className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-card-bg rounded-[32px] border border-card-border p-8 z-[110] shadow-2xl">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold">¿Eliminar hábito?</h3>
                <p className="text-text-muted text-sm pb-2">Esta acción no se puede deshacer y afectará al progreso de tu meta.</p>
                <div className="flex gap-3">
                  <button onClick={() => setHabitToDelete(null)} className="flex-1 py-3 bg-surface border border-card-border rounded-2xl font-bold text-text-muted">Cancelar</button>
                  <button onClick={() => handleDeleteHabit(habitToDelete.id, habitToDelete.goalId)} className="flex-1 py-3 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-colors">Eliminar</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
