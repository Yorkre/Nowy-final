import { describe, it, expect, vi } from 'vitest';
import { DAL } from './DAL';
import { setDoc, doc } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({ id: 'mock-id' })),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  increment: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}));

describe('DAL Integration (Mocked)', () => {
  it('should call setDoc when saving a goal', async () => {
    const goalData = { title: 'Test Goal' };
    await DAL.saveGoal(goalData);
    
    expect(setDoc).toHaveBeenCalled();
  });

  it('should call setDoc when saving a habit', async () => {
    const habitData = { name: 'Test Habit', goalId: 'goal-1' };
    await DAL.saveHabit(habitData);
    
    expect(setDoc).toHaveBeenCalled();
  });
});
