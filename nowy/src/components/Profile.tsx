import React, { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { DAL } from '../services/DAL';
import { Goal, Habit } from '../types';
import { motion } from 'motion/react';
import { User, Settings, LogOut, Award, Zap, Calendar, Globe, ChevronRight, X, Camera, Pencil, Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function Profile() {
  const user = auth.currentUser;
  const [stats, setStats] = useState({
    totalHabits: 0,
    completedToday: 0,
    highestStreak: 0
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const avatars = [
    'Felix', 'Aneka', 'Jack', 'Jasper', 'Milo', 
    'Luna', 'Bella', 'Zoe', 'Coco', 'Peanut',
    'Oliver', 'Willow', 'Shadow', 'Sasha', 'Bear'
  ];

  const updateAvatar = async (seed: string) => {
    setIsUpdating(true);
    const photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    try {
      await DAL.updateUserProfile({ photoURL });
      toast.success('Foto de perfil actualizada');
      setShowAvatarPicker(false);
    } catch (error) {
      toast.error('Error al actualizar');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsUpdating(true);
    try {
      await DAL.updateUserProfile({ displayName: newName.trim() });
      toast.success('Nombre actualizado');
      setIsEditingName(false);
    } catch (error) {
      toast.error('Error al actualizar nombre');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsUpdating(true);
    try {
      await DAL.deleteUserAccount();
      toast.success('Cuenta eliminada correctamente');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Por seguridad, cierra sesión e ingresa de nuevo antes de eliminar tu cuenta.');
      } else {
        toast.error('No se pudo eliminar la cuenta. Inténtalo de nuevo.');
      }
    } finally {
      setIsUpdating(false);
      setShowDeleteConfirm(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const habits = await DAL.getHabits();
    const activeHabits = habits.filter(h => !h.deletedAt);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const logsData = await DAL.getHabitLogs(todayStr);
    
    const maxStreakValues = habits.map(h => h.maxStreak || 0);
    const highestStreak = maxStreakValues.length > 0 ? Math.max(...maxStreakValues, ...habits.map(h => h.streak)) : 0;

    setStats({
      totalHabits: activeHabits.length,
      completedToday: logsData.filter(l => l.completed).length,
      highestStreak: highestStreak
    });
  };

  const handleLogout = () => {
    auth.signOut();
  };

  if (!user) return null;

  return (
    <div className="space-y-8 pb-32 normal-case">
      <header className="px-2 flex justify-between items-center text-[var(--text-main)]">
        <h2 className="text-3xl font-bold">Perfil</h2>
      </header>

      {/* User Info Header */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bento-card flex flex-col items-center gap-4 text-center group"
      >
        <div className="relative cursor-pointer" onClick={() => setShowAvatarPicker(true)}>
          <img 
            src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
            className="w-24 h-24 rounded-full border-4 border-brand-blue/30 shadow-xl group-hover:border-brand-blue transition-all"
            alt={user.displayName || 'User'}
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-1 right-1 w-8 h-8 bg-brand-blue rounded-full border-2 border-card-bg flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-all">
            <Camera size={14} />
          </div>
        </div>
        
        <div className="space-y-2 w-full px-4">
          {isEditingName ? (
            <form onSubmit={handleUpdateName} className="flex gap-2 w-full">
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                className="m3-input flex-1 py-1.5 text-center text-lg font-bold"
                autoFocus
              />
              <button 
                type="submit" 
                disabled={isUpdating}
                className="p-2 bg-brand-blue text-white rounded-xl shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isUpdating ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Check size={20} />}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-2xl font-bold text-[var(--text-main)] truncate max-w-[200px]">
                {user.displayName || 'Explorador'}
              </h3>
              <button 
                onClick={() => setIsEditingName(true)}
                className="p-1.5 text-text-muted hover:text-brand-blue transition-colors"
                aria-label="Editar nombre"
              >
                <Pencil size={16} />
              </button>
            </div>
          )}
          <p className="text-sm text-text-muted truncate">{user.email}</p>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAvatarPicker && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowAvatarPicker(false)}
              className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-[60]" 
            />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-card-bg rounded-t-[40px] border-t border-card-border p-8 z-[70] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-[var(--text-main)]">Selecciona Avatar</h3>
                <button onClick={() => setShowAvatarPicker(false)} className="p-2 bg-surface rounded-full text-text-muted">
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar pb-8">
                {avatars.map((seed) => (
                  <button
                    key={seed}
                    onClick={() => updateAvatar(seed)}
                    disabled={isUpdating}
                    className="relative group active:scale-95 transition-all"
                  >
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                      className="w-full aspect-square rounded-2xl border-2 border-transparent hover:border-brand-blue group-hover:shadow-lg transition-all"
                      alt={seed}
                    />
                    {isUpdating && (
                       <div className="absolute inset-0 bg-surface/50 rounded-2xl flex items-center justify-center">
                         <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent animate-spin rounded-full" />
                       </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bento-card-blue !p-4 flex flex-col items-center justify-center text-center">
            <Check size={24} className="text-brand-blue mb-2" />
            <div className="text-2xl font-bold text-[var(--text-main)]">{stats.completedToday}</div>
            <div className="title-small !text-[8px] !mb-0 uppercase">Hoy</div>
        </div>
        <div className="bento-card-green !p-4 flex flex-col items-center justify-center text-center">
            <Zap size={24} className="text-brand-green mb-2" />
            <div className="text-2xl font-bold text-[var(--text-main)]">{stats.totalHabits}</div>
            <div className="title-small !text-[8px] !mb-0 uppercase">Hábitos</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-3xl !p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <Award size={24} className="text-orange-500 mb-2" />
            <div className="text-2xl font-bold text-orange-600">{stats.highestStreak}d</div>
            <div className="title-small !text-[8px] !mb-0 text-orange-600/70 uppercase">Record</div>
        </div>
      </div>

      {/* Account Section */}
      <div className="space-y-4">
        <div className="title-small px-2">Ajustes de cuenta</div>
        <div className="space-y-3">
          <button 
            onClick={handleLogout}
            className="bento-card !p-4 w-full flex items-center gap-4 text-rose-500 hover:bg-rose-500/5 transition-all border-rose-500/20 active:scale-[0.98]"
          >
            <LogOut size={20} />
            <span className="font-bold">Cerrar Sesión</span>
          </button>
          
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 p-4 text-[10px] font-bold text-text-muted hover:text-rose-500 transition-colors uppercase tracking-widest"
          >
            <Trash2 size={12} />
            Eliminar mi cuenta permanentemente
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => !isUpdating && setShowDeleteConfirm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: '-40%', x: '-50%' }} 
              animate={{ scale: 1, opacity: 1, y: '-50%', x: '-50%' }} 
              exit={{ scale: 0.9, opacity: 0, y: '-40%', x: '-50%' }}
              className="fixed top-1/2 left-1/2 w-[90%] max-w-sm bg-card-bg border border-card-border p-8 rounded-[32px] z-[110] shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">¿Estás absolutamente seguro?</h3>
              <p className="text-sm text-text-muted mb-8 leading-relaxed">
                Esta acción es permanente. Borraremos todas tus metas, hábitos, progresos y publicaciones de la comunidad. No hay marcha atrás.
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleDeleteAccount}
                  disabled={isUpdating}
                  className="w-full py-4 bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                      Eliminando...
                    </>
                  ) : (
                    'Sí, borrar cuenta'
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isUpdating}
                  className="w-full py-4 text-text-muted font-bold hover:text-[var(--text-main)] transition-colors disabled:opacity-30"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="text-center pb-8">
        <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-semibold opacity-50">
          Nowy Engine v2.1.0 • Build ID: {user.uid.slice(0, 8)}
        </p>
      </div>
    </div>
  );
}
