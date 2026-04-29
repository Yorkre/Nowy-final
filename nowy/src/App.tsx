/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import Timeline from './components/Timeline';
import Profile from './components/Profile';
import Auth from './components/Auth';
import { Toaster } from 'react-hot-toast';
import { DAL } from './services/DAL';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      
      if (u) {
        if (u.email === "pedroperezsandoval48@gmail.com") {
          const { SocialManager } = await import('./services/SocialManager');
          SocialManager.healAllSocialData();
        }

        // Initial setup for new users (Mock Data)
        const habits = await DAL.getHabits();
        if (habits.length === 0) {
          console.log("Initializing mock data...");
          try {
            const goalId = await DAL.saveGoal({
              title: 'Dominar Nowy App',
              description: 'Exprimir al máximo la productividad',
              progress: 30,
              status: 'active',
              frequency: 'daily'
            });
            
            await DAL.saveHabit({
              name: 'Completar 1 Tarea Crítica',
              goalId,
              frequency: 'daily',
              streak: 0,
              maxStreak: 0,
              weight: 0.6
            });

            await DAL.saveHabit({
              name: 'Planificar el día siguiente',
              goalId,
              frequency: 'daily',
              streak: 0,
              maxStreak: 0,
              weight: 0.4
            });
          } catch (e) {
            console.error("Mock data init failed", e);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface max-w-lg mx-auto overflow-x-hidden relative sm:border-x border-card-border pb-safe-bottom">
      <Toaster position="top-center" />
      
      {!user ? (
        <Auth />
      ) : (
        <>
          <main className="p-4 sm:p-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'planner' && <Planner />}
            {activeTab === 'timeline' && <Timeline />}
            {activeTab === 'profile' && <Profile />}
          </main>
          <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        </>
      )}
    </div>
  );
}

