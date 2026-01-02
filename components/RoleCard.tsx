import React, { useState } from 'react';
import { Role, RoleType, Alliance } from '../types';
import { Shield, Skull, EyeOff, Eye } from 'lucide-react';

interface RoleCardProps {
  role: Role;
  isRevealed: boolean;
  onReveal?: () => void;
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, isRevealed, onReveal }) => {
  const isGood = role.alliance === Alliance.GOOD;

  return (
    <div 
      className="group relative w-64 h-96 cursor-pointer perspective-1000"
      onClick={onReveal}
    >
      <div className={`relative w-full h-full transition-all duration-700 transform-style-3d ${isRevealed ? 'rotate-y-180' : ''}`}>
        
        {/* Front of Card (Hidden Identity) */}
        <div className="absolute w-full h-full backface-hidden rounded-xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-slate-800 flex flex-col items-center justify-center p-4">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-30"></div>
           <div className="w-full h-full border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-4">
              <Shield size={64} className="text-slate-500" />
              <h3 className="font-cinzel text-xl text-slate-400 tracking-widest text-center">
                身份确认<br/>PROJECT AVALON
              </h3>
              <p className="text-slate-500 text-xs mt-8">点击翻开查看身份</p>
           </div>
        </div>

        {/* Back of Card (Revealed Identity) */}
        <div className={`absolute w-full h-full backface-hidden rotate-y-180 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border-4 ${isGood ? 'border-blue-500' : 'border-red-600'} bg-slate-900`}>
          {/* Background Art */}
          <div className={`absolute inset-0 opacity-40 ${isGood ? 'bg-blue-900' : 'bg-red-900'}`}></div>
          
          <div className="relative h-full flex flex-col items-center p-6 text-center">
             <div className="flex-1 flex flex-col items-center justify-center">
                <div className={`p-4 rounded-full border-4 mb-4 ${isGood ? 'border-blue-400 bg-blue-900/50' : 'border-red-500 bg-red-900/50'}`}>
                  {isGood ? <Shield size={48} className="text-blue-200" /> : <Skull size={48} className="text-red-200" />}
                </div>
                
                <h2 className={`font-cinzel text-3xl font-bold mb-1 ${isGood ? 'text-blue-200' : 'text-red-200'}`}>
                  {role.name}
                </h2>
                <span className={`text-xs uppercase tracking-widest font-bold px-2 py-1 rounded mb-4 ${isGood ? 'bg-blue-900 text-blue-300' : 'bg-red-900 text-red-300'}`}>
                  {role.alliance === Alliance.GOOD ? '正义阵营' : '邪恶阵营'}
                </span>

                <p className="text-sm text-slate-300 leading-relaxed font-serif">
                  {role.description}
                </p>
             </div>
             
             <div className="mt-auto pt-4 border-t border-white/10 w-full">
                <p className="text-xs text-slate-400">点击卡片隐藏身份</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
