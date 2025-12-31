import React, { useEffect, useMemo, useState } from 'react';
import { ViewState, Player } from '../types';
import { Button } from '../components/Button';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { AVATARS } from '../constants';
import { getSocket, NetRoomState, RoomErrorCode } from '../services/socket';

interface Props {
  onNavigate: (view: ViewState) => void;
  playerName: string;
  initialRoomCode: string | null;
}

export const LobbyView: React.FC<Props> = ({ onNavigate, playerName, initialRoomCode }) => {
  const socket = useMemo(() => getSocket(), []);
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<NetRoomState | null>(null);
  const [error, setError] = useState<RoomErrorCode | null>(null);
  const [meId, setMeId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [localName, setLocalName] = useState(playerName);

  useEffect(() => {
    const onConnect = () => {
      setMeId(socket.id ?? '');
    };

    const onJoined = (state: NetRoomState) => {
      setRoom(state);
      setRoomCode(state.roomCode);
      setMeId(socket.id ?? '');
      setError(null);

      const url = new URL(window.location.href);
      url.searchParams.set('room', state.roomCode);
      window.history.replaceState({}, '', url.toString());
    };

    const onRoomUpdate = (state: NetRoomState) => {
      setRoom(state);
      setRoomCode(state.roomCode);

      // If a new game starts and this client missed the broadcasted game_state,
      // proactively pull the latest state.
      if (state.inGame) {
        socket.emit('get_game_state', { roomCode: state.roomCode });
      }
    };

    const onRoomError = ({ code }: { code: RoomErrorCode }) => {
      setError(code);
    };

    const onGameState = () => {
      onNavigate(ViewState.GAME);
    };

    const onConnectError = (err: any) => {
      if (err?.message === 'UNAUTHORIZED') {
        window.alert('請先登入後再加入房間');
        onNavigate(ViewState.HOME);
      }
    };

    socket.on('room_joined', onJoined);
    socket.on('room_update', onRoomUpdate);
    socket.on('room_error', onRoomError);
    socket.on('game_state', onGameState);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);

    const codeFromUrl = initialRoomCode || new URLSearchParams(window.location.search).get('room');
    if (codeFromUrl) {
      socket.emit('join_room', { roomCode: codeFromUrl, name: playerName });
    } else {
      socket.emit('create_room', { name: playerName });
    }

    return () => {
      socket.off('room_joined', onJoined);
      socket.off('room_update', onRoomUpdate);
      socket.off('room_error', onRoomError);
      socket.off('game_state', onGameState);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };
  }, [initialRoomCode, onNavigate, playerName, socket]);

  useEffect(() => {
    setLocalName(playerName);
  }, [playerName]);

  const mappedPlayers: Player[] = useMemo(() => {
    if (!room) return [];
    return room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: AVATARS[p.avatarIndex % AVATARS.length],
      isLeader: false,
      isBot: false,
      isHost: p.isHost,
      vote: null,
      missionAction: null,
    }));
  }, [room]);

  const me = mappedPlayers.find((p) => p.id === meId) || null;
  const others = mappedPlayers.filter((p) => p.id !== meId);
  const totalPlayers = mappedPlayers.length;
  const isHost = Boolean(room?.hostId && room.hostId === meId);
  const maxPlayers = room?.maxPlayers ?? 5;

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
      try {
        const inviteUrl = `${window.location.origin}?room=${roomCode}`;
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedInvite(true);
        setTimeout(() => setCopiedInvite(false), 2000);
      } catch (err) {
          console.error('Share failed:', err);
        const inviteUrl = `${window.location.origin}?room=${roomCode}`;
        window.prompt('複製邀請連結：', inviteUrl);
      }
  };

  const clearRoomFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] pt-4 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => {
            clearRoomFromUrl();
            onNavigate(ViewState.HOME);
          }}
          className="p-2 text-slate-400 hover:text-white"
        >
          <ArrowLeft />
        </button>
        <h2 className="font-cinzel font-bold text-xl">準備大廳</h2>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* Room Info */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center mb-6">
         <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">房間號碼</p>
         <div className="flex items-center justify-center gap-3">
           <span className="text-4xl font-mono text-amber-400 font-bold tracking-wider">{roomCode || '----'}</span>
             <button
                onClick={handleCopyCode}
                className="text-slate-500 hover:text-amber-400 transition-colors p-1"
                title="複製房間號"
            disabled={!roomCode}
             >
                 {copiedCode ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
             </button>
         </div>
         <div className="mt-4 flex justify-center">
            <button
                onClick={handleInvite}
                className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/30 px-4 py-2 rounded-full border border-indigo-500/30 transition-all active:scale-95"
            >
              <Copy size={14} /> {copiedInvite ? '已複製邀請連結' : '複製邀請連結'}
            </button>
         </div>
      </div>

      {/* Nickname */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-2 text-center">你的暱稱</p>
        <div className="flex gap-2">
          <input
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            maxLength={20}
            placeholder="輸入你的名字"
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
          />
          <Button
            variant="secondary"
            onClick={() => {
              if (!roomCode) return;
              const trimmed = localName.trim();
              if (!trimmed) return;
              socket.emit('set_name', { roomCode, name: trimmed });
            }}
            disabled={!roomCode || !localName.trim()}
          >
            套用
          </Button>
        </div>
      </div>

      {/* Player List Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-4">
            {/* Myself */}
          {me && (
            <div className="flex flex-col items-center gap-2 animate-[popIn_0.3s]">
              <div className="w-16 h-16 rounded-full border-2 border-amber-500 p-1 relative">
                <img src={me.avatar} alt="Me" className="w-full h-full rounded-full object-cover" />
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-900">YOU</div>
              </div>
              <span className="text-xs text-slate-300 font-medium truncate w-full text-center">{me.name}</span>
            </div>
          )}

            {/* Other Players */}
            {others.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-2 animate-[popIn_0.3s]">
                <div className="w-16 h-16 rounded-full border-2 border-slate-600 p-1 bg-slate-800 relative">
                  <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover grayscale opacity-70" />
                  {p.isHost && (
                  <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-indigo-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-900">HOST</div>
                  )}
                </div>
                <span className="text-xs text-slate-400 truncate w-full text-center">{p.name}</span>
              </div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, maxPlayers - totalPlayers) }).map((_, i) => (
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
              至少需要 5 人才能開始遊戲（目前 {totalPlayers}/{maxPlayers}）
            </p>
          {error && (
            <p className="text-center text-xs text-rose-400">
              {error === 'ROOM_NOT_FOUND' && '房間不存在或已關閉'}
              {error === 'ROOM_FULL' && '房間已滿'}
              {error === 'GAME_ALREADY_STARTED' && '遊戲已開始，無法加入'}
              {error === 'NOT_ENOUGH_PLAYERS' && '人數不足，無法開始'}
            </p>
          )}
          <Button
            variant="gold"
            fullWidth
            onClick={() => socket.emit('start_game', { roomCode })}
            disabled={!isHost || totalPlayers < 5 || !roomCode}
          >
            {!isHost ? '等待房主開始...' : totalPlayers < 5 ? '等待玩家...' : '開始遊戲'}
          </Button>
      </div>
    </div>
  );
};