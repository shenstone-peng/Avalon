import React, { useState, useEffect } from 'react';
import { ViewState, Player } from '../types';
import { Button } from '../components/Button';
import { ArrowLeft, Share2, Copy, Check } from 'lucide-react';
import { AVATARS } from '../constants';

interface Props {
  onNavigate: (view: ViewState) => void;
}

export const LobbyView: React.FC<Props> = ({ onNavigate }) => {
  const [players, setPlayers] = useState<Partial<Player>[]>([]);
  const [roomCode] = useState("AV-9527");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    // Simulate players joining
    const interval = setInterval(() => {
      setPlayers(prev => {
        if (prev.length >= 5) {
          clearInterval(interval);
          return prev;
        }
        return [...prev, {
            id: `p-${prev.length}`,
            name: `玩家 ${prev.length + 1}`,
            avatar: AVATARS[prev.length % AVATARS.length]
        }];
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  const handleCopyCode = async () => {
      try {
          await navigator.clipboard.writeText(roomCode);
          setCopiedCode(true);
          setTimeout(() => setCopiedCode(false), 2000);
      } catch (err) {
          console.error('Failed to copy', err);
      }
  };

  const handleInvite = async () => {
      const inviteUrl = `${window.location.origin}?room=${roomCode}`;
      const shareData = {
          title: '王者圓桌 - 邀請函',
          text: `👑 誠摯邀請您加入《王者圓桌》的對決！\n🔑 房間號碼：${roomCode}\n\n點擊下方連結立即加入：`,
          url: inviteUrl
      };

      try {
          // Try using Web Share API (Mobile friendly)
          if (navigator.share) {
              await navigator.share(shareData);
          } else {
              // Fallback to clipboard
              const fullText = `${shareData.text}\n${inviteUrl}`;
              await navigator.clipboard.writeText(fullText);
              alert('✅ 邀請連結已複製到剪貼簿！\n快去分享給好友吧。');
          }
      } catch (err) {
          console.error('Share failed:', err);
      }
  };

  return (
    <div className="flex flex-col h-screen pt-4 px-4 pb-24">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => onNavigate(ViewState.HOME)} className="p-2 text-slate-400 hover:text-white">
          <ArrowLeft />
        </button>
        <h2 className="font-cinzel font-bold text-xl">準備大廳</h2>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* Room Info */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center mb-6">
         <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">房間號碼</p>
         <div className="flex items-center justify-center gap-3">
             <span className="text-4xl font-mono text-amber-400 font-bold tracking-wider">{roomCode}</span>
             <button 
                onClick={handleCopyCode}
                className="text-slate-500 hover:text-amber-400 transition-colors p-1"
                title="複製房間號"
             >
                 {copiedCode ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
             </button>
         </div>
         <div className="mt-4 flex justify-center">
            <button 
                onClick={handleInvite}
                className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/30 px-4 py-2 rounded-full border border-indigo-500/30 transition-all active:scale-95"
            >
                <Share2 size={14} /> 邀請好友 / 生成連結
            </button>
         </div>
      </div>

      {/* Player List Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-4">
            {/* Myself */}
            <div className="flex flex-col items-center gap-2 animate-[popIn_0.3s]">
                <div className="w-16 h-16 rounded-full border-2 border-amber-500 p-1 relative">
                    <img src={AVATARS[7]} alt="Me" className="w-full h-full rounded-full object-cover" />
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-900">YOU</div>
                </div>
                <span className="text-xs text-slate-300 font-medium truncate w-full text-center">我</span>
            </div>

            {/* Other Players */}
            {players.map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-2 animate-[popIn_0.3s]">
                    <div className="w-16 h-16 rounded-full border-2 border-slate-600 p-1 bg-slate-800">
                        <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover grayscale opacity-70" />
                    </div>
                    <span className="text-xs text-slate-400 truncate w-full text-center">{p.name}</span>
                </div>
            ))}
            
            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex flex-col items-center gap-2 opacity-30">
                     <div className="w-16 h-16 rounded-full border-2 border-slate-700 border-dashed flex items-center justify-center">
                        <span className="text-2xl text-slate-600">+</span>
                     </div>
                     <span className="text-xs text-slate-600">等待中...</span>
                </div>
            ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
          <p className="text-center text-xs text-slate-500">
              至少需要 5 人才能開始遊戲 ({players.length + 1}/5)
          </p>
          <Button 
            variant="gold" 
            fullWidth 
            onClick={() => onNavigate(ViewState.GAME)}
            disabled={players.length < 4}
          >
            {players.length < 4 ? '等待玩家...' : '開始遊戲'}
          </Button>
      </div>
    </div>
  );
};