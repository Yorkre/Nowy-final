import { DAL } from './DAL';
import { format, subDays, startOfDay } from 'date-fns';
import { Goal, Habit, HabitLog } from '../types';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { HabitUtils } from '../utils/HabitUtils';

export const ProgressEngine = {
  /**
   * Recalculates the progress of a goal based on its associated habits and their recent logs.
   */
  async recalculateGoalProgress(goalId: string): Promise<number> {
    const userId = auth.currentUser?.uid;
    if (!userId) return 0;

    const allHabits = await DAL.getHabits();
    const goalHabits = allHabits.filter(h => h.goalId === goalId);
    
    if (goalHabits.length === 0) return 0;

    const q = query(collection(db, 'habitLogs'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const allUserLogs = snapshot.docs.map(doc => doc.data() as HabitLog);

    let totalWeightedCompletion = 0;
    let totalWeight = 0;

    for (const habit of goalHabits) {
      const windowSize = habit.frequency === 'daily' ? 7 : habit.frequency === 'weekly' ? 28 : habit.frequency === 'interval' ? 28 : 90;
      const windowDates: Date[] = Array.from({ length: windowSize }, (_, i) => subDays(new Date(), i));
      
      const habitLogs = allUserLogs.filter(l => l.habitId === habit.id && windowDates.some(d => format(d, 'yyyy-MM-dd') === l.date));
      
      const completionCount = habitLogs.filter(l => l.completed).length;
      
      // Calculate how many times it SHOULD have been done in this window
      let expectedCompletions = 0;
      for (const date of windowDates) {
        if (HabitUtils.isHabitVisibleAtDate(habit, date)) {
          expectedCompletions += (habit.targetCount || 1);
        }
      }

      const completionRate = expectedCompletions > 0 ? Math.min(1, completionCount / expectedCompletions) : 1;
      const weight = habit.weight ?? 1.0;

      totalWeightedCompletion += completionRate * weight;
      totalWeight += weight;
    }

    const finalProgress = totalWeight > 0 ? (totalWeightedCompletion / totalWeight) * 100 : 0;
    const roundedProgress = Math.min(100, Math.round(finalProgress));

    await DAL.saveGoal({ id: goalId, progress: roundedProgress });
    return roundedProgress;
  },

  async updateHabitStreak(habitId: string): Promise<number> {
    const userId = auth.currentUser?.uid;
    if (!userId) return 0;

    const allHabits = await DAL.getHabits();
    const habit = allHabits.find(h => h.id === habitId);
    if (!habit) return 0;

    const q = query(collection(db, 'habitLogs'), where('habitId', '==', habitId), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => doc.data() as HabitLog);

    let streak = 0;
    let checkDate = new Date();
    const todayStr = format(checkDate, 'yyyy-MM-dd');
    
    for (let i = 0; i < 365; i++) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const isScheduled = HabitUtils.isHabitVisibleAtDate(habit, checkDate);
      const log = logs.find(l => l.date === dateStr);

      if (isScheduled) {
        if (log && log.completed) {
          streak++;
        } else if (dateStr === todayStr) {
          // Keep streak if today and not yet done
        } else {
          break;
        }
      } 
      
      checkDate = subDays(checkDate, 1);
    }

    const maxStreak = Math.max(habit.maxStreak || 0, streak);
    await DAL.saveHabit({ id: habitId, streak, maxStreak });
    return streak;
  },

  /**
   * Unit Test simulation for calculation logic
   */
  testCalculation(logs: boolean[], weights: number[]): number {
    if (logs.length === 0) return 0;
    const completionCount = logs.filter(l => l).length;
    const rate = completionCount / logs.length;
    // Simplified for unit test
    return Math.round(rate * 100);
  }
};
