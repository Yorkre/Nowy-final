import { describe, it, expect } from 'vitest';
import { HabitUtils } from './HabitUtils';
import { Habit } from '../types';
import { startOfDay, addDays } from 'date-fns';

describe('HabitUtils', () => {
  const mockHabit: Habit = {
    id: '1',
    userId: 'u1',
    name: 'Test Habit',
    goalId: 'g1',
    frequency: 'daily',
    streak: 0,
    weight: 1,
    targetCount: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    likes: 0,
    dislikes: 0
  };

  it('should identify daily habits as always visible', () => {
    const habit = { ...mockHabit, frequency: 'daily' as const };
    expect(HabitUtils.isHabitVisibleAtDate(habit, new Date())).toBe(true);
  });

  it('should handle weekly habits correctly', () => {
    const habit = { ...mockHabit, frequency: 'weekly' as const, scheduledDays: [1, 3] }; // Mon, Wed
    
    const monday = new Date(2026, 3, 20); // 2026-04-20 is Monday
    const tuesday = new Date(2026, 3, 21);
    const wednesday = new Date(2026, 3, 22);
    
    expect(HabitUtils.isHabitVisibleAtDate(habit, monday)).toBe(true);
    expect(HabitUtils.isHabitVisibleAtDate(habit, tuesday)).toBe(false);
    expect(HabitUtils.isHabitVisibleAtDate(habit, wednesday)).toBe(true);
  });

  it('should handle interval habits correctly', () => {
    const anchorDate = '2026-04-01'; // Wednesday
    const habit = { 
      ...mockHabit, 
      frequency: 'interval' as const, 
      intervalValue: 3, 
      anchorDate 
    };
    
    const day0 = new Date(2026, 3, 1); // Apr 1
    const day1 = new Date(2026, 3, 2); // Apr 2
    const day3 = new Date(2026, 3, 4); // Apr 4
    const day6 = new Date(2026, 3, 7); // Apr 7
    
    expect(HabitUtils.isHabitVisibleAtDate(habit, day0)).toBe(true);
    expect(HabitUtils.isHabitVisibleAtDate(habit, day1)).toBe(false);
    expect(HabitUtils.isHabitVisibleAtDate(habit, day3)).toBe(true);
    expect(HabitUtils.isHabitVisibleAtDate(habit, day6)).toBe(true);
  });

  it('should not show habits that were deleted', () => {
    const habit = { ...mockHabit, deletedAt: Date.now() - 1000 };
    expect(HabitUtils.isHabitVisibleAtDate(habit, new Date())).toBe(false);
  });
});
