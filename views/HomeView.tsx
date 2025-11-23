import React from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { Crown, Swords, Users, Sparkles } from 'lucide-react';

interface Props {
  onNavigate: (view: ViewState) => void;
}

export const HomeView: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen px-6 py-12 relative">
      {/* Hero Section */}
      <div className="text-center mb-12 animate-[fadeIn_1s_ease-out]">
        <div className="inline-flex items-center justify-center p-4 bg-amber-500/10 rounded-full border border-amber-500/30 mb-6 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <Crown size={48} className="text-amber-400" />
        </div>
        <h1 className="font-cinzel text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 mb-2 drop-shadow-sm">
          王者圓桌
        </h1>
        <p className="font-cinzel text-amber-600/80 text-sm tracking-[0.3em] uppercase mb-4">
            Project Avalon
        </p>
        <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
          正義與邪惡的終極對決，誰能活著見到聖杯？
        </p>
      </div>

      {/* Main Actions */}
      <div className="w-full max-w-sm space-y-4 z-20">
        <Button variant="gold" fullWidth onClick={() => onNavigate(ViewState.LOBBY)}>
           <Swords size={20} /> 快速匹配
        </Button>
        <Button variant="secondary" fullWidth onClick={() => onNavigate(ViewState.LOBBY)}>
           <Users size={20} /> 創建房間
        </Button>
      </div>

      {/* Decorative Footer */}
      <div className="absolute bottom-24 text-center">
         <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
            <Sparkles size={12} />
            <span>S1 賽季：亞瑟王的召喚</span>
            <Sparkles size={12} />
         </div>
      </div>
    </div>
  );
};
