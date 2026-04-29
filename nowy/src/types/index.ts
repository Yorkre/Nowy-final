export type GoalStatus = 'active' | 'completed' | 'abandoned';
export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'interval';
export type PostType = 'milestone' | 'status' | 'goal_achieved' | 'habit_status';
export type ReactionType = 'like' | 'dislike';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string;
  createdAt: number;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  progress: number;
  status: GoalStatus;
  frequency: HabitFrequency;
  createdAt: number;
  updatedAt: number;
}

export interface Habit {
  id: string;
  userId: string;
  goalId: string;
  name: string;
  frequency: HabitFrequency;
  targetCount: number; // e.g. 8 glasses of water / day
  streak: number;
  maxStreak?: number;
  weight: number; // 0.0 to 1.0 (impact on goal)
  scheduledDays?: number[]; // [0, 1, 2, 3, 4, 5, 6] for Sunday-Saturday
  scheduledTimes?: string[]; // ["08:00", "14:00"]
  scheduledMonthDays?: number[]; // [1, 15, 31]
  scheduledWeeks?: number[]; // [1, 2, 3, 4, 5] (1st to 5th week of month)
  intervalValue?: number; // for 'interval' frequency (every X days)
  anchorDate?: string; // YYYY-MM-DD for 'interval' calculation
  monthlyType?: 'day_of_month' | 'day_of_week';
  likes?: number;
  dislikes?: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  count: number; // e.g. how many times done today
  createdAt: number;
}

export interface TimelinePost {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  content: string;
  type: PostType;
  likes: number;
  dislikes: number;
  streak?: number;
  habitId?: string;
  habitFrequency?: HabitFrequency;
  createdAt: number;
}

export interface Reaction {
  userId: string;
  postId: string;
  type: ReactionType;
  createdAt: number;
}
