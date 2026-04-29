import React, { useEffect, useState } from 'react';
import { DAL } from '../services/DAL';
import { SocialManager } from '../services/SocialManager';
import { Habit, UserProfile } from '../types';
import { ThumbsUp, ThumbsDown, Share2, Flame, User, Clock, Zap, ArrowDownAZ, SortDesc, Filter, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function Timeline() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [userReactions, setUserReactions] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recency' | 'likes'>('recency');
  const [filterType, setFilterType] = useState<string>('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubHabits = DAL.subscribeToAllActiveHabits(async (allHabits) => {
      setHabits(allHabits);
      
      // Fetch missing profiles and reactions without triggering re-subscription
      const userIds = [...new Set(allHabits.map(h => h.userId))];
      
      setUserProfiles(currentProfiles => {
        const missingIds = userIds.filter(id => !currentProfiles[id]);
        if (missingIds.length > 0) {
          Promise.all(
            missingIds.map(async (id) => {
              try {
                const snap = await getDoc(doc(db, 'users', id));
                return snap.exists() ? { id, profile: snap.data() as UserProfile } : null;
              } catch (e) {
                return null;
              }
            })
          ).then(results => {
            const updates: Record<string, UserProfile> = {};
            results.forEach(r => { if (r) updates[r.id] = r.profile; });
            if (Object.keys(updates).length > 0) {
              setUserProfiles(prev => ({ ...prev, ...updates }));
            }
          });
        }
        return currentProfiles;
      });

      // Fetch user's reactions for these habits
      setUserReactions(currentReactions => {
        const missingReactionsIds = allHabits.filter(h => currentReactions[h.id] === undefined).map(h => h.id);
        if (missingReactionsIds.length > 0) {
          Promise.all(
            missingReactionsIds.map(async (id) => {
               try {
                 const reactionSnap = await getDoc(doc(db, 'habits', id, 'reactions', user.uid));
                 return { id, type: reactionSnap.exists() ? reactionSnap.data().type : null };
               } catch (e) {
                 return { id, type: null };
               }
            })
          ).then(results => {
            const updates: Record<string, 'like' | 'dislike' | null> = {};
            results.forEach(r => { updates[r.id] = r.type; });
            setUserReactions(prev => ({ ...prev, ...updates }));
          });
        }
        return currentReactions;
      });
      
      setLoading(false);
    });
    
    return () => unsubHabits();
  }, []);

  const [isReacting, setIsReacting] = useState<Record<string, boolean>>({});

  const handleToggleReaction = async (habitId: string, type: 'like' | 'dislike') => {
    if (isReacting[habitId]) return;
    
    const current = userReactions[habitId];
    let next: 'like' | 'dislike' | null = type;
    
    if (current === type) {
      next = null; // Toggle off
    }

    // Optimistic UI
    setUserReactions(prev => ({ ...prev, [habitId]: next }));
    setIsReacting(prev => ({ ...prev, [habitId]: true }));
    
    try {
      await SocialManager.toggleHabitReaction(habitId, type);
    } catch (error) {
      toast.error('Error al reaccionar');
      setUserReactions(prev => ({ ...prev, [habitId]: current }));
    } finally {
      setIsReacting(prev => ({ ...prev, [habitId]: false }));
    }
  };

  const getStreakUnit = (freq?: string) => {
    if (freq === 'daily') return 'DÍAS';
    if (freq === 'weekly') return 'SEMANAS';
    if (freq === 'monthly') return 'MESES';
    return 'DÍAS';
  };

  const processedHabits = habits
    .filter(h => filterType === 'all' || h.frequency === filterType)
    .sort((a, b) => {
      if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="space-y-8 pb-32">
      <header className="px-2 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Comunidad</h2>
          <p className="text-text-muted">Apoya los hábitos de otros</p>
        </div>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-3 rounded-2xl transition-all border ${
            isMenuOpen 
              ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/20' 
              : 'bg-card-bg text-text-muted border-card-border hover:border-brand-blue/30'
          }`}
        >
          <SlidersHorizontal size={20} />
        </button>
      </header>

      {/* Filters & Sorting Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-2 mb-4"
          >
            <div className="p-5 rounded-3xl bg-surface border border-brand-blue/20 space-y-6 shadow-xl shadow-black/20">
              <div className="space-y-3">
                <span className="title-small !mb-0 flex items-center gap-2 text-brand-blue">
                  <Filter size={14} /> Filtrar por Tipo
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {['all', 'daily', 'weekly', 'monthly', 'interval'].map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all border ${
                        filterType === type 
                          ? 'bg-brand-blue border-brand-blue text-white shadow-md' 
                          : 'bg-card-bg border-card-border text-text-muted hover:border-brand-blue/30'
                      }`}
                    >
                      {type === 'all' ? 'TODOS' : 
                       type === 'daily' ? 'DIARIO' : 
                       type === 'weekly' ? 'SEMANAL' : 
                       type === 'monthly' ? 'MENSUAL' : 'INTERVALO'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <span className="title-small !mb-0 flex items-center gap-2 text-brand-blue">
                  <SortDesc size={14} /> Ordenar por
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortBy('recency')}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition-all ${
                      sortBy === 'recency' 
                        ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' 
                        : 'bg-card-bg border-card-border text-text-muted'
                    }`}
                  >
                    <Clock size={12} /> RECIENTES
                  </button>
                  <button
                    onClick={() => setSortBy('likes')}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition-all ${
                      sortBy === 'likes' 
                        ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' 
                        : 'bg-card-bg border-card-border text-text-muted'
                    }`}
                  >
                    <ThumbsUp size={12} /> POPULARES
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-2 flex items-center justify-center text-text-muted hover:text-white transition-colors"
              >
                <ChevronDown size={20} className="rotate-180" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <AnimatePresence>
          {processedHabits.map((habit, index) => {
            const profile = userProfiles[habit.userId];
            return (
              <motion.div
                key={habit.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="bento-card !p-0 overflow-hidden"
              >
                <div className="p-4 flex items-center gap-3 border-b border-card-border bg-card-bg">
                  <img 
                    src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${habit.userId}`} 
                    className="w-10 h-10 rounded-full bg-surface border border-card-border"
                    alt={profile?.displayName || 'Usuario'}
                    referrerPolicy="no-referrer"
                  />
                  <div style={{ flex: 1 }}>
                    <h4 className="font-bold text-sm text-white">{profile?.displayName || 'Usuario Activo'}</h4>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                      Hábito activo desde {new Date(habit.createdAt).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  {habit.streak > 0 ? (
                    <div className={`text-white text-[10px] px-4 py-2 rounded-full font-black uppercase tracking-wider shadow-lg flex items-center gap-2 border-2 transition-all ${
                      habit.streak >= 10 ? 'bg-brand-blue border-brand-blue/50 animate-pulse-subtle shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 
                      habit.streak >= 3 ? 'bg-orange-500 border-orange-400 animate-pulse-subtle shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 
                      'bg-orange-500/80 border-orange-400'
                    }`}>
                      {habit.streak >= 10 ? <Zap size={14} fill="white" /> : <Flame size={14} fill="white" />}
                      {habit.streak} {getStreakUnit(habit.frequency)}
                    </div>
                  ) : (
                    <div className="bg-slate-700/50 text-slate-400 text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider border border-slate-600 flex items-center gap-1.5">
                      <Clock size={12} />
                      EMPEZANDO RACHA
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <p className="text-slate-200 leading-relaxed font-bold text-lg">
                    {habit.name.replace('Acción: ', '')}
                  </p>
                  <p className="text-xs text-text-muted mt-1 uppercase font-bold tracking-tighter">
                    Meta de cumplimiento: {habit.frequency === 'daily' ? 'Diaria' : habit.frequency === 'weekly' ? 'Semanal' : 'Mensual'}
                  </p>
                </div>

                <div className="px-4 py-3 bg-surface/50 border-t border-card-border flex items-center gap-6">
                  <button 
                    onClick={() => handleToggleReaction(habit.id, 'like')}
                    className={`flex items-center gap-1.5 transition-colors ${userReactions[habit.id] === 'like' ? 'text-brand-blue' : 'text-text-muted hover:text-brand-blue'}`}
                  >
                    <ThumbsUp size={18} />
                    <span className="text-xs font-bold">{habit.likes ?? 0}</span>
                  </button>
                  <button 
                    onClick={() => handleToggleReaction(habit.id, 'dislike')}
                    className={`flex items-center gap-1.5 transition-colors ${userReactions[habit.id] === 'dislike' ? 'text-rose-400' : 'text-text-muted hover:text-rose-400'}`}
                  >
                    <ThumbsDown size={18} />
                    <span className="text-xs font-bold">{habit.dislikes ?? 0}</span>
                  </button>
                  <button className="ml-auto text-text-muted hover:text-white">
                    <Share2 size={18} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!loading && processedHabits.length === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 bg-card-bg border border-card-border rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted opacity-50">
               <Zap size={32} />
            </div>
            <p className="text-slate-400 font-bold">No se encontraron hábitos</p>
            <p className="text-xs text-text-muted mt-1">Prueba con otros filtros o criterios de búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
