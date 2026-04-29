import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { updateProfile, deleteUser } from 'firebase/auth';
import { Goal, Habit, HabitLog, TimelinePost } from '../types';

export const DAL = {
  // User Profile
  async updateUserProfile(data: { displayName?: string, photoURL?: string }): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    await updateProfile(user, data);
    
    // Also update a public users collection for other users to see
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      displayName: data.displayName || user.displayName,
      photoURL: data.photoURL || user.photoURL,
      updatedAt: Date.now()
    }, { merge: true });
  },

  async deleteUserAccount(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    const userId = user.uid;

    console.log(`Starting thorough deletion for user: ${userId}`);

    // 1. Delete basic user-owned documents (Goals, Logs)
    const collectionsToDelete = ['goals', 'habitLogs'];
    for (const collName of collectionsToDelete) {
      const q = query(collection(db, collName), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 2. Delete Habits and their sub-collections (Reactions)
    const habitsQ = query(collection(db, 'habits'), where('userId', '==', userId));
    const habitsSnap = await getDocs(habitsQ);
    for (const habitDoc of habitsSnap.docs) {
      const reactionsSnap = await getDocs(collection(db, 'habits', habitDoc.id, 'reactions'));
      const batch = writeBatch(db);
      reactionsSnap.forEach(r => batch.delete(r.ref));
      batch.delete(habitDoc.ref);
      await batch.commit();
    }

    // 3. Delete Timeline Posts and their sub-collections (Reactions)
    const postsQ = query(collection(db, 'timeline'), where('userId', '==', userId));
    const postsSnap = await getDocs(postsQ);
    for (const postDoc of postsSnap.docs) {
      const reactionsSnap = await getDocs(collection(db, 'timeline', postDoc.id, 'reactions'));
      const batch = writeBatch(db);
      reactionsSnap.forEach(r => batch.delete(r.ref));
      batch.delete(postDoc.ref);
      await batch.commit();
    }

    // 4. CLEANUP: Delete reactions this user made on OTHER people's content
    // This removes their digital footprint from the community section completely.
    
    // a) Remove reactions from ALL timeline posts
    const timelinePosts = await getDocs(collection(db, 'timeline'));
    for (const postDoc of timelinePosts.docs) {
      const reactionRef = doc(db, 'timeline', postDoc.id, 'reactions', userId);
      const reactionSnap = await getDoc(reactionRef);
      if (reactionSnap.exists()) {
        const type = reactionSnap.data().type;
        const batch = writeBatch(db);
        batch.update(postDoc.ref, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(-1)
        });
        batch.delete(reactionRef);
        await batch.commit();
      }
    }

    // b) Remove reactions from ALL habits in the community
    const allHabits = await getDocs(collection(db, 'habits'));
    for (const habitDoc of allHabits.docs) {
      const reactionRef = doc(db, 'habits', habitDoc.id, 'reactions', userId);
      const reactionSnap = await getDoc(reactionRef);
      if (reactionSnap.exists()) {
        const type = reactionSnap.data().type;
        const batch = writeBatch(db);
        batch.update(habitDoc.ref, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(-1)
        });
        batch.delete(reactionRef);
        await batch.commit();
      }
    }

    // 5. Delete user profile doc and public record
    await deleteDoc(doc(db, 'users', userId));

    // 6. Finally delete the auth user
    await deleteUser(user);
    console.log('Account deletion completed successfully.');
  },
  // Goals
  async getGoals(): Promise<Goal[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    const q = query(collection(db, 'goals'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
  },

  async saveGoal(goal: Partial<Goal>): Promise<string> {
    const id = goal.id || doc(collection(db, 'goals')).id;
    const ref = doc(db, 'goals', id);
    const data = {
      ...goal,
      id,
      userId: auth.currentUser?.uid,
      updatedAt: Date.now(),
      createdAt: goal.createdAt || Date.now()
    };
    await setDoc(ref, data, { merge: true });
    return id;
  },

  async deleteGoal(id: string): Promise<void> {
    await deleteDoc(doc(db, 'goals', id));
    // Cleanup associated habits
    const habits = await this.getHabits();
    const relatedHabits = habits.filter(h => h.goalId === id);
    for (const habit of relatedHabits) {
      await this.deleteHabit(habit.id);
    }
  },

  // Habits
  async getHabits(): Promise<Habit[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    const q = query(collection(db, 'habits'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Habit));
  },

  subscribeToHabits(callback: (habits: Habit[]) => void) {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};
    const q = query(collection(db, 'habits'), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Habit)));
    });
  },

  async saveHabit(habit: Partial<Habit>): Promise<string> {
    const id = habit.id || doc(collection(db, 'habits')).id;
    const ref = doc(db, 'habits', id);
    
    const data: any = {
      ...habit,
      id,
      userId: auth.currentUser?.uid,
      updatedAt: Date.now(),
      createdAt: habit.createdAt || Date.now()
    };

    // Ensure likes/dislikes are initialized only for NEW habits
    if (!habit.id) {
      data.likes = 0;
      data.dislikes = 0;
    }

    await setDoc(ref, data, { merge: true });
    return id;
  },

  async deleteHabit(id: string): Promise<void> {
    await updateDoc(doc(db, 'habits', id), {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
  },

  // Habit Logs
  async getHabitLogs(date: string): Promise<HabitLog[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    const q = query(collection(db, 'habitLogs'), where('userId', '==', userId), where('date', '==', date));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitLog));
  },

  subscribeToHabitLogs(date: string, callback: (logs: HabitLog[]) => void) {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};
    const q = query(collection(db, 'habitLogs'), where('userId', '==', userId), where('date', '==', date));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitLog)));
    });
  },

  subscribeToAllActiveHabits(callback: (habits: Habit[]) => void) {
    const currentUserId = auth.currentUser?.uid;
    // We fetch all habits where deletedAt is null
    // In a real app we might want to limit this or use a 'public' flag
    const q = query(collection(db, 'habits'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const habits = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Habit))
        .filter(h => h.userId !== currentUserId && !h.deletedAt);
      callback(habits);
    });
  },

  async logHabit(habitId: string, date: string, completed: boolean, count?: number): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const id = `${habitId}_${date}`;
    const ref = doc(db, 'habitLogs', id);
    
    await setDoc(ref, {
      id,
      habitId,
      userId,
      date,
      count: count ?? 1,
      completed,
      createdAt: Date.now()
    }, { merge: true });
  },

  // Social Timeline
  subscribeToTimeline(callback: (posts: TimelinePost[]) => void) {
    const q = query(collection(db, 'timeline'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimelinePost));
      callback(posts);
    });
  },

  async createPost(post: Omit<TimelinePost, 'id' | 'likes' | 'dislikes' | 'createdAt'>): Promise<void> {
    const id = doc(collection(db, 'timeline')).id;
    const ref = doc(db, 'timeline', id);
    await setDoc(ref, {
      ...post,
      id,
      likes: 0,
      dislikes: 0,
      createdAt: Date.now()
    });
  },

  async reactToPost(postId: string, type: 'like' | 'dislike', habitId?: string): Promise<void> {
    const postRef = doc(db, 'timeline', postId);
    await updateDoc(postRef, {
      [type === 'like' ? 'likes' : 'dislikes']: increment(1)
    });

    if (habitId) {
      const habitRef = doc(db, 'habits', habitId);
      await updateDoc(habitRef, {
        [type === 'like' ? 'likes' : 'dislikes']: increment(1)
      });
    }
  }
};
