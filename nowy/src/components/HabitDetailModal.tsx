import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flame, Zap, Target, TrendingUp, Calendar as CalendarIcon, CheckCircle2, Circle } from 'lucide-react';
import { Habit, Goal } from '../types';
import { HabitUtils } from '../utils/HabitUtils';
import { format, subDays, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface HabitDetailModalProps {
  habit: Habit;
  goal?: Goal;
  history: any[];
  onClose: () => void;
  isLoading: boolean;
}

export default function HabitDetailModal({ habit, goal, history, onClose, isLoading }: HabitDetailModalProps) {
  const last30Days = Array.from({ length: 30 }, (_, i) => subDays(new Date(), i)).reverse();
  const today = new Date();
  
  const getLogForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return history.find(l => l.date === dateStr);
  };

  const activityData = last30Days.map(date => {
    const log = getLogForDate(date);
    const wasScheduled = HabitUtils.isHabitVisibleAtDate(habit, date);
    const isCompleted = log?.completed === true;
    return { date, wasScheduled, isCompleted };
  });

  const completionCount = activityData.filter(d => d.isCompleted).length;
  const scheduledCount = activityData.filter(d => d.wasScheduled).length;
  const completionRate = scheduledCount > 0 ? Math.round((completionCount / scheduledCount) * 100) : 0;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="fixed inset-0 bg-surface/80 backdrop-blur-md z-[100]" 
      />
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        exit={{ y: '100%' }} 
        className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-card-bg rounded-t-[40px] border-t border-card-border p-8 z-[110] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-brand-blue/10 text-brand-blue text-[10px] font-black rounded-full uppercase tracking-widest">Estadísticas</span>
              {habit.streak >= 3 && (
                <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 text-[10px] font-black rounded-full uppercase tracking-widest flex items-center gap-1">
                  <Flame size={10} /> En Racha
                </span>
              )}
            </div>
            <h3 className="text-3xl font-black text-[var(--text-main)] leading-tight">{habit.name.replace('Acción: ', '')}</h3>
            {goal && <p className="text-sm font-bold text-text-muted mt-1 uppercase tracking-tight">VINCULADO A: <span className="text-brand-blue">{goal.title}</span></p>}
          </div>
          <button onClick={onClose} className="p-3 bg-surface rounded-2xl text-text-muted hover:text-brand-blue transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
          <div className="bg-surface/50 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-card-border text-center">
            <div className="flex justify-center mb-2 text-orange-500">
              <Flame size={28} sm:size={32} fill="currentColor" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-main)] mb-1">{habit.streak}d</div>
            <div className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest">Racha Actual</div>
          </div>
          <div className="bg-surface/50 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-card-border text-center">
            <div className="flex justify-center mb-2 text-brand-blue">
              <Zap size={28} sm:size={32} fill="currentColor" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-main)] mb-1">{habit.maxStreak}d</div>
            <div className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest">Récord Máximo</div>
          </div>
        </div>

        {/* History Map (Mini Calendar) */}
        <div className="bento-card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h4 className="title-small flex items-center gap-2">
              <CalendarIcon size={16} /> Actividad (30 días)
            </h4>
            <div className="text-xs font-bold text-brand-green">{completionRate}% eficacia</div>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {activityData.map(({ date, wasScheduled, isCompleted }, i) => {
              const isToday = isSameDay(date, today);
              const isMissed = wasScheduled && !isCompleted && (date < startOfDay(today));

              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div 
                    title={format(date, 'PPP', { locale: es })}
                    className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all ${
                      isCompleted 
                        ? 'bg-brand-green text-white shadow-lg shadow-brand-green/20' 
                        : isMissed
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                          : isToday && wasScheduled
                            ? 'border-2 border-brand-blue bg-brand-blue/5' 
                            : 'bg-surface border border-card-border opacity-40'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={14} /> : isMissed ? <X size={14} /> : isToday && wasScheduled ? <Circle size={10} className="text-brand-blue animate-pulse" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-4 px-1">
            <span className="text-[10px] font-bold text-text-muted">HACE 30 DÍAS</span>
            <span className="text-[10px] font-bold text-text-muted">HOY</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
