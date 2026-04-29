import React from 'react';
import { Home, ListChecks, Users, User, CalendarDays } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navigation({ activeTab, setActiveTab }: Props) {
  const tabs = [
    { id: 'dashboard', icon: Home, label: 'Inicio' },
    { id: 'planner', icon: CalendarDays, label: 'Hoy' },
    { id: 'timeline', icon: Users, label: 'Comunidad' },
    { id: 'profile', icon: User, label: 'Perfil' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-lg bg-card-bg/95 backdrop-blur-md border-t border-card-border px-8 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex justify-between items-center shadow-[0_-8px_30px_rgb(0,0,0,0.12)] pointer-events-auto">
        {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center gap-1 relative"
          >
            <div className={`p-1 rounded-2xl transition-colors ${isActive ? 'bg-brand-blue/20 text-brand-blue' : 'text-slate-500'}`}>
              <Icon size={24} />
            </div>
            <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-brand-blue' : 'text-slate-500'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute -top-1 w-1 h-1 bg-brand-blue rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"
              />
            )}
          </button>
        ); })}
      </div>
    </nav>
  );
}
