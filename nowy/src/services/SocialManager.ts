import { DAL } from './DAL';
import { auth, db } from '../lib/firebase';
import { TimelinePost, ReactionType, HabitFrequency } from '../types';
import { doc, updateDoc, increment, setDoc, deleteDoc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';

export const SocialManager = {
  async shareMilestone(content: string, type: 'milestone' | 'goal_achieved' | 'habit_status') {
    const user = auth.currentUser;
    if (!user) return;

    await DAL.createPost({
      userId: user.uid,
      userName: user.displayName || 'Nowy User',
      userPhoto: user.photoURL,
      content,
      type
    });
  },

  async shareHabitCompletion(habitName: string, habitId: string, streak: number, frequency: HabitFrequency) {
    const user = auth.currentUser;
    if (!user) return;

    await DAL.createPost({
      userId: user.uid,
      userName: user.displayName || 'Nowy User',
      userPhoto: user.photoURL,
      content: `Ha completado: ${habitName}`,
      type: 'habit_status' as any,
      streak: streak,
      habitId: habitId,
      habitFrequency: frequency
    } as any);
  },

  async toggleHabitReaction(habitId: string, type: ReactionType) {
    const user = auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión para reaccionar');

    const reactionRef = doc(db, 'habits', habitId, 'reactions', user.uid);
    const habitRef = doc(db, 'habits', habitId);

    const [existingReaction, habitSnap] = await Promise.all([
      getDoc(reactionRef),
      getDoc(habitRef)
    ]);
    
    const habitData = habitSnap.data();
    const batch = writeBatch(db);

    if (existingReaction.exists()) {
      const oldType = existingReaction.data().type;
      if (oldType === type) {
        // Toggle OFF
        console.log(`Toggling OFF ${type} for habit ${habitId}. Current count in DB: ${habitData?.[type === 'like' ? 'likes' : 'dislikes']}`);
        batch.delete(reactionRef);
        batch.update(habitRef, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(-1)
        });
      } else {
        // Switch reaction
        console.log(`Switching from ${oldType} to ${type} for habit ${habitId}`);
        batch.update(reactionRef, { type, updatedAt: Date.now() });
        batch.update(habitRef, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1),
          [oldType === 'like' ? 'likes' : 'dislikes']: increment(-1)
        });
      }
    } else {
      // New reaction
      console.log(`Adding NEW ${type} for habit ${habitId}. Current DB count: ${habitData?.[type === 'like' ? 'likes' : 'dislikes']}`);
      batch.set(reactionRef, {
        userId: user.uid,
        habitId,
        type,
        createdAt: Date.now()
      });
      batch.update(habitRef, {
        [type === 'like' ? 'likes' : 'dislikes']: increment(1)
      });
    }

    try {
      await batch.commit();
    } catch (e: any) {
      console.error("Error in toggleHabitReaction batch commit:", e);
      throw e;
    }
  },

  async toggleReaction(postId: string, type: ReactionType) {
    const user = auth.currentUser;
    if (!user) return;

    const reactionRef = doc(db, 'timeline', postId, 'reactions', user.uid);
    const postRef = doc(db, 'timeline', postId);

    const existingReaction = await getDoc(reactionRef);
    const postSnap = await getDoc(postRef);
    const postData = postSnap.data() as TimelinePost;
    const habitId = postData?.habitId;

    if (existingReaction.exists()) {
      const oldType = existingReaction.data().type;
      if (oldType === type) {
        // Remove reaction
        await deleteDoc(reactionRef);
        await updateDoc(postRef, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(-1)
        });
        if (habitId) {
          await updateDoc(doc(db, 'habits', habitId), {
            [type === 'like' ? 'likes' : 'dislikes']: increment(-1)
          });
        }
      } else {
        // Change reaction type
        await updateDoc(reactionRef, { type, updatedAt: Date.now() });
        await updateDoc(postRef, {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1),
          [oldType === 'like' ? 'likes' : 'dislikes']: increment(-1)
        });
        if (habitId) {
          await updateDoc(doc(db, 'habits', habitId), {
            [type === 'like' ? 'likes' : 'dislikes']: increment(1),
            [oldType === 'like' ? 'likes' : 'dislikes']: increment(-1)
          });
        }
      }
    } else {
      // New reaction
      await setDoc(reactionRef, {
        userId: user.uid,
        postId,
        type,
        createdAt: Date.now()
      });
      await updateDoc(postRef, {
        [type === 'like' ? 'likes' : 'dislikes']: increment(1)
      });
      if (habitId) {
        await updateDoc(doc(db, 'habits', habitId), {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1)
        });
      }
    }
  },

  async resetSocialStats() {
    const habitsSnap = await getDocs(collection(db, 'habits'));
    const timelineSnap = await getDocs(collection(db, 'timeline'));

    const promises: Promise<any>[] = [];

    // Reset counters and clear reactions for habits
    for (const h of habitsSnap.docs) {
      promises.push(updateDoc(h.ref, { likes: 0, dislikes: 0 }));
      const reactions = await getDocs(collection(db, 'habits', h.id, 'reactions'));
      reactions.forEach(r => promises.push(deleteDoc(r.ref)));
    }

    // Reset counters and clear reactions for timeline posts
    for (const p of timelineSnap.docs) {
      promises.push(updateDoc(p.ref, { likes: 0, dislikes: 0 }));
      const reactions = await getDocs(collection(db, 'timeline', p.id, 'reactions'));
      reactions.forEach(r => promises.push(deleteDoc(r.ref)));
    }

    await Promise.all(promises);
    console.log('Social stats reset complete (Thorough)');
  },

  async healAllSocialData() {
    console.log('Starting global social data healing process...');
    const habitsSnap = await getDocs(collection(db, 'habits'));
    const timelineSnap = await getDocs(collection(db, 'timeline'));
    const batch = writeBatch(db);
    let count = 0;

    const healDocs = (snap: any, label: string) => {
      snap.forEach((h: any) => {
        const data = h.data();
        const likes = typeof data.likes === 'number' ? data.likes : 0;
        const dislikes = typeof data.dislikes === 'number' ? data.dislikes : 0;
        
        const needsHealing = 
          data.likes === undefined || 
          data.dislikes === undefined || 
          likes < 0 || 
          dislikes < 0 ||
          data.maxStreak === undefined ||
          data.streak === 5 || // Identify mock data
          data.streak === 3;

        if (needsHealing) {
          console.log(`Healing ${label} ${h.id} (User: ${data.userId})`);
          batch.update(h.ref, {
            likes: Math.max(0, likes),
            dislikes: Math.max(0, dislikes),
            streak: 0, // Reset to real start
            maxStreak: 0 // Reset to real start
          });
          count++;
        }
      });
    };

    healDocs(habitsSnap, 'habit');
    healDocs(timelineSnap, 'post');

    if (count > 0) {
      await batch.commit();
      console.log(`Healed ${count} social items with missing or negative stats.`);
    } else {
      console.log('No social data required healing.');
    }
  }
};
