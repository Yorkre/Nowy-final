import { Habit } from '../types';
import { getDay, getDate, getWeekOfMonth, differenceInDays, startOfDay, endOfDay, isSameDay } from 'date-fns';

export const HabitUtils = {
  isHabitVisibleAtDate(habit: Habit, date: Date): boolean {
    const startOfTarget = startOfDay(date).getTime();
    const endOfTarget = endOfDay(date).getTime();
    
    // 1. Lifecycle: Created check (don't show before it was created)
    // We compare with endOfTarget to allow visibility on the day of creation
    if (habit.createdAt > endOfTarget) return false;

    // 2. Lifecycle: Deleted check (don't show after it was deleted)
    if (habit.deletedAt) {
      const startOfDeletion = startOfDay(new Date(habit.deletedAt)).getTime();
      // Hide if the target date is strictly after the deletion day
      if (startOfTarget > startOfDeletion) return false;
      
      // If it's the exact day of deletion, hide it from "active" views like Dashboard
      // But we might want to show it in Planner if we're looking at today.
      // To keep it simple and consistent: if deletedAt is set and it's >= today, 
      // we hide it from today onwards.
      if (isSameDay(date, new Date(habit.deletedAt))) return false;
    }

    if (habit.frequency === 'daily') return true;
    
    if (habit.frequency === 'weekly') {
      const dayOfWeek = getDay(date);
      return habit.scheduledDays?.includes(dayOfWeek) ?? false;
    }
    
    if (habit.frequency === 'monthly') {
      if (habit.monthlyType === 'day_of_week') {
        const isCorrectDay = habit.scheduledDays?.includes(getDay(date)) ?? false;
        const isCorrectWeek = !habit.scheduledWeeks?.length || habit.scheduledWeeks.includes(getWeekOfMonth(date));
        return isCorrectDay && isCorrectWeek;
      }
      const dayOfMonth = getDate(date);
      return habit.scheduledMonthDays?.includes(dayOfMonth) ?? false;
    }

    if (habit.frequency === 'interval') {
      const anchor = habit.anchorDate ? new Date(habit.anchorDate) : new Date(habit.createdAt);
      // Ensure we are working with midnight for comparison
      const diff = differenceInDays(startOfDay(date), startOfDay(anchor));
      return diff >= 0 && (diff % (habit.intervalValue || 1) === 0);
    }
    
    return false;
  }
};
