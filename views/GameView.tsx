import React, { useEffect, useMemo, useState } from 'react';
import { ViewState, GamePhase, Player, RoleType, Alliance, ROLES_CONFIG, MissionRound } from '../types';
import { AVATARS, MISSION_CONFIG_5_PLAYERS } from '../constants';
import { Button } from '../components/Button';
import { RoleCard } from '../components/RoleCard';
import { generateMissionStory, generateEndGameAnalysis } from '../services/geminiService';
import { ScrollText, Swords, XCircle, CheckCircle, Crown, Eye, EyeOff, Gavel, ShieldAlert, HelpCircle, Skull, User, Info, Waves } from 'lucide-react';
import { getSocket, NetGameState } from '../services/socket';

interface Props {
  onNavigate: (view: ViewState) => void;
  playerName: string;
    initialRoomCode: string | null;
}

export const GameView: React.FC<Props> = ({ onNavigate, playerName, initialRoomCode }) => {
    const socket = useMemo(() => getSocket(), []);
    const [roomCode, setRoomCode] = useState<string>('');
    const [phase, setPhase] = useState<GamePhase>(GamePhase.SETUP);
    const [proposalAttempt, setProposalAttempt] = useState(1);
    const [players, setPlayers] = useState<Player[]>([]);
    const [myPlayerId, setMyPlayerId] = useState<string>('');
    const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
    const [rounds, setRounds] = useState<MissionRound[]>([]);
    const [leaderIndex, setLeaderIndex] = useState(0);
    const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
    const [narrative, setNarrative] = useState<string>('');
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [showRole, setShowRole] = useState(false);
    const [showVisionOnBoard, setShowVisionOnBoard] = useState(true);
    const [manualWinner, setManualWinner] = useState<Alliance | null>(null);
    const [roleAcked, setRoleAcked] = useState(false);
    const [netError, setNetError] = useState<string | null>(null);
    const [assassinationTargetId, setAssassinationTargetId] = useState<string | null>(null);

    // Lady of the Lake state (server-authoritative)
    const [ladyOfLakeHolderId, setLadyOfLakeHolderId] = useState<string>('');
    const [ladyOfLakeHistory, setLadyOfLakeHistory] = useState<string[]>([]);
    const [ladyOfLakeTargetId, setLadyOfLakeTargetId] = useState<string | null>(null);
    const [ladyOfLakeResult, setLadyOfLakeResult] = useState<'GOOD' | 'EVIL' | null>(null);

    const clearRoomFromUrl = () => {
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('room');
            window.history.replaceState({}, '', url.toString());
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        const codeFromUrl = initialRoomCode || new URLSearchParams(window.location.search).get('room');
        if (codeFromUrl) setRoomCode(codeFromUrl);
        setMyPlayerId(socket.id ?? '');

        const onConnect = () => {
            setMyPlayerId(socket.id ?? '');
            if (codeFromUrl) socket.emit('get_game_state', { roomCode: codeFromUrl });
        };

        const onGameState = (state: NetGameState) => {
            setNetError(null);
            setRoomCode(state.roomCode);
            setProposalAttempt((state as any).proposalAttempt ?? 1);

            if (state.phase === 'ROLE_REVEAL') {
                setRoleAcked(false);
                setShowRole(false);
                setNarrative('');
                setManualWinner(null);
                setAssassinationTargetId(null);
            }

            const mappedPlayers: Player[] = state.players.map((p) => {
                const role = p.roleKey ? (ROLES_CONFIG as any)[p.roleKey] : undefined;
                return {
                    id: p.id,
                    name: p.name,
                    avatar: AVATARS[p.avatarIndex % AVATARS.length],
                    isLeader: p.isLeader,
                    isBot: false,
                    isHost: p.isHost,
                    role,
                    vote: p.vote,
                    missionAction: p.missionAction,
                };
            });

            setPlayers(mappedPlayers);
            setLeaderIndex(Math.max(0, state.leaderIndex));
            setCurrentRoundIndex(state.currentRoundIndex);
            setRounds(state.rounds as unknown as MissionRound[]);
            setSelectedTeam(state.selectedTeam);
            setAssassinationTargetId((state as any).assassinationTargetId ?? null);

            setLadyOfLakeHolderId((state as any).ladyOfLakeHolderId ?? '');
            setLadyOfLakeHistory(Array.isArray((state as any).ladyOfLakeHistory) ? (state as any).ladyOfLakeHistory : []);
            setLadyOfLakeTargetId((state as any).ladyOfLakeTargetId ?? null);
            setLadyOfLakeResult((state as any).ladyOfLakeResult ?? null);

            // Phase mapping
            const phaseMap: Record<string, GamePhase> = {
                ROLE_REVEAL: GamePhase.ROLE_REVEAL,
                TEAM_SELECTION: GamePhase.TEAM_SELECTION,
                VOTING: GamePhase.VOTING,
                MISSION_EXECUTION: GamePhase.MISSION_EXECUTION,
                MISSION_REVEAL: GamePhase.MISSION_REVEAL,
                LADY_OF_THE_LAKE: GamePhase.LADY_OF_THE_LAKE,
                ASSASSINATION: GamePhase.ASSASSINATION,
                GAME_OVER: GamePhase.GAME_OVER,
            };
            setPhase(phaseMap[state.phase] ?? GamePhase.SETUP);

            if (state.manualWinner) setManualWinner(state.manualWinner === 'GOOD' ? Alliance.GOOD : Alliance.EVIL);
            else setManualWinner(null);
        };

        socket.on('game_state', onGameState);
        socket.on('connect', onConnect);

        const onRoomUpdate = (state: { roomCode: string; inGame: boolean }) => {
            // Safety net: if we missed the broadcasted game_state (rare but possible),
            // room_update tells us a new game is live; pull the current game state.
            if (!state?.inGame) return;
            if (phase !== GamePhase.GAME_OVER && phase !== GamePhase.SETUP) return;
            const targetCode = codeFromUrl || roomCode;
            if (!targetCode) return;
            if (state.roomCode !== targetCode) return;
            socket.emit('get_game_state', { roomCode: targetCode });
        };
        socket.on('room_update', onRoomUpdate);

        const onRoomError = ({ code }: { code: string }) => {
            setNetError(code);
        };
        socket.on('room_error', onRoomError);

        // If user hits /game directly, try to join room (no-op if already in room).
        if (codeFromUrl) {
            socket.emit('join_room', { roomCode: codeFromUrl, name: playerName });
            socket.emit('get_game_state', { roomCode: codeFromUrl });
        }

        return () => {
            socket.off('game_state', onGameState);
            socket.off('connect', onConnect);
            socket.off('room_error', onRoomError);
            socket.off('room_update', onRoomUpdate);
        };
    }, [initialRoomCode, playerName, phase, roomCode, socket]);

  // --- VISION LOGIC ---
  const getVisionInfo = (observer: Player, target: Player): { icon: React.ReactNode, text: string, type: 'evil' | 'good' | 'unknown' } | null => {
      if (observer.id === target.id) return null;
      if (!observer.role || !target.role) return null;

      const obsType = observer.role.type;
      const targetType = target.role.type;
      const targetAlliance = target.role.alliance;

      // 1. 梅林 (Merlin)
      // 看到：Morgana, Assassin, Minion, Oberon 為壞人 (但看不到 Mordred)
      if (obsType === RoleType.MERLIN) {
          if (targetAlliance === Alliance.EVIL && targetType !== RoleType.MORDRED) {
              return { icon: <Skull size={16} />, text: '邪惡陣營', type: 'evil' };
          }
      }

      // 2. 派西維爾 (Percival)
      // 看到：Merlin 和 Morgana 為「梅林？」
      if (obsType === RoleType.PERCIVAL) {
          if (targetType === RoleType.MERLIN || targetType === RoleType.MORGANA) {
              return { icon: <HelpCircle size={16} />, text: '梅林?', type: 'unknown' };
          }
      }

      // 3. 壞人視野 (Evil)
      // 看到：其他壞人 (除了 Oberon)
      // Oberon 看不到隊友
      if (observer.role.alliance === Alliance.EVIL && obsType !== RoleType.OBERON) {
          if (targetAlliance === Alliance.EVIL && targetType !== RoleType.OBERON) {
              return { icon: <Skull size={16} />, text: '同夥', type: 'evil' };
          }
      }

      return null;
  };

  const getRoleDescription = (roleType: RoleType) => {
      switch (roleType) {
          case RoleType.MERLIN: return "你能看穿大部分邪惡陣營的偽裝（除了莫德雷德）。";
          case RoleType.PERCIVAL: return "你能看到梅林與莫甘娜，但無法區分誰是真梅林。";
          case RoleType.OBERON: return "你無法看到你的邪惡隊友，隊友也看不到你。";
          case RoleType.MORDRED:
          case RoleType.MORGANA:
          case RoleType.ASSASSIN:
          case RoleType.MINION:
              return "你能看到你的邪惡同夥（除了奧伯倫）。";
          default: return "你沒有特殊視野，只能依靠信任與邏輯。";
      }
  };

  // -- Multiplayer action emitters --

  const handleTeamSelection = (playerId: string) => {
        if (!roomCode) return;
        if (phase !== GamePhase.TEAM_SELECTION) return;
    socket.emit('select_team_toggle', { roomCode, playerId });
  };

  const submitTeam = () => {
    if (!roomCode) return;
    socket.emit('submit_team', { roomCode });
  };

  const handleVote = (vote: 'APPROVE' | 'REJECT') => {
    if (!roomCode) return;
    socket.emit('vote', { roomCode, vote });
  };

  const handleMissionAction = (action: 'SUCCESS' | 'FAIL') => {
    if (!roomCode) return;
    socket.emit('mission_action', { roomCode, action });
  };

    const handleLadyOfLakeTarget = (targetId: string) => {
        if (!roomCode) return;
        socket.emit('lady_of_the_lake_target', { roomCode, targetId });
    };

  const nextRound = async () => {
    if (!roomCode) return;
    // Optional local story generation (cosmetic). In multiplayer, every client can generate its own.
    // Keep existing UX without making server depend on Gemini API.
    try {
      const current = rounds[currentRoundIndex];
      if (current && current.missionResults.length > 0) {
        const teamObjs = players.filter((p) => selectedTeam.includes(p.id));
        const failCount = current.missionResults.filter((r) => r === 'FAIL').length;
        const isSuccess = failCount < current.failsRequired;
        setIsProcessingAI(true);
        const story = await generateMissionStory(current, teamObjs, isSuccess);
        setNarrative(story);
      }
    } finally {
      setIsProcessingAI(false);
      socket.emit('next_round', { roomCode });
    }
  };

    const handleManualEndGame = async (winner: Alliance) => {
        setManualWinner(winner);
        setPhase(GamePhase.GAME_OVER);

        setIsProcessingAI(true);
        const analysis = await generateEndGameAnalysis(
            winner === Alliance.GOOD ? "正義陣營 (藍方)" : "邪惡陣營 (紅方)",
            players,
            rounds
        );
        setNarrative(analysis);
        setIsProcessingAI(false);

        if (roomCode) {
          socket.emit('manual_endgame', { roomCode, winner: winner === Alliance.GOOD ? 'GOOD' : 'EVIL' });
        }
    };

  // -- Render Helpers --

  const renderLadyOfLake = () => {
      const isMeHolder = ladyOfLakeHolderId === myPlayerId;
      const holder = players.find(p => p.id === ladyOfLakeHolderId);
      const target = players.find(p => p.id === ladyOfLakeTargetId);

      return (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-[fadeIn_0.5s]">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(37,99,235,0.5)]">
                <Waves size={40} className="text-white" />
            </div>

            <h2 className="text-3xl font-cinzel font-bold text-blue-400 mb-2">湖中仙女的啟示</h2>

            {!ladyOfLakeTargetId ? (
                <div className="max-w-md w-full">
                    <p className="text-slate-300 mb-8">
                        {isMeHolder ? '你是湖中仙女的持有者。請選擇一名未曾持有過令牌的玩家，窺視其陣營。' : `等待持有者 ${holder?.name || '玩家'} 選擇窺視目標...`}
                    </p>

                    {isMeHolder && (
                        <div className="grid grid-cols-2 gap-4">
                            {players
                              .filter(p => p.id !== myPlayerId)
                              .filter(p => !ladyOfLakeHistory.includes(p.id))
                              .map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleLadyOfLakeTarget(p.id)}
                                    className="bg-slate-800 border-2 border-slate-700 p-4 rounded-xl flex flex-col items-center gap-2 hover:border-blue-500 transition-all active:scale-95"
                                >
                                    <img src={p.avatar} className="w-14 h-14 rounded-full border-2 border-slate-700" alt="" />
                                    <span className="text-slate-200 font-bold text-sm">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="max-w-md w-full animate-[popIn_0.4s]">
                    <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl mb-8 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10 bg-gradient-to-b from-blue-500 to-transparent"></div>
                        <img src={target?.avatar} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-800" alt="" />
                        <h3 className="text-xl font-bold text-white mb-6">目標：{target?.name}</h3>

                        {isMeHolder ? (
                            <div className={`py-4 px-6 rounded-full font-bold text-xl inline-flex items-center gap-3 shadow-lg border-2
                                ${ladyOfLakeResult === 'GOOD' ? 'bg-blue-900/50 border-blue-400 text-blue-300' : 'bg-red-900/50 border-red-500 text-red-300'}
                            `}>
                                <Waves size={20} />
                                {ladyOfLakeResult === 'GOOD' ? '正義陣營' : '邪惡陣營'}
                            </div>
                        ) : (
                            <div className="py-4 px-6 rounded-full bg-slate-800 border border-slate-700 text-slate-400 italic">
                                你無法得知其陣營…
                            </div>
                        )}

                        <p className="mt-6 text-sm text-slate-400">
                            令牌將自動移交給 {target?.name}。
                        </p>
                    </div>
                </div>
            )}
        </div>
      );
  };

  const renderRoleReveal = () => {
      const myPlayer = players.find(p => p.id === myPlayerId);
      if (!myPlayer) return null;

      // Calculate vision info list
      const visionList = players
        .map(p => ({ player: p, info: getVisionInfo(myPlayer, p) }))
        .filter(item => item.info !== null);

      return (
        <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto overscroll-contain animate-[fadeIn_0.5s]">
            <div className="min-h-[100dvh] flex flex-col items-center px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <h2 className="text-2xl font-cinzel text-amber-500 mb-6">確認你的身份</h2>

            <div className="flex flex-col md:flex-row items-center gap-8 max-w-5xl w-full justify-center">
                {/* My Card */}
                <div className="flex-shrink-0 transform hover:scale-105 transition-transform duration-300">
                    <RoleCard
                        role={myPlayer.role || ROLES_CONFIG.LOYAL_SERVANT}
                        isRevealed={showRole}
                        onReveal={() => setShowRole(!showRole)}
                    />
                </div>

                {/* Vision Info Panel - Only visible when role is revealed or confirmed */}
                <div className={`w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl transition-all duration-500 ${showRole ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
                    <h3 className="font-cinzel text-xl text-slate-300 mb-2 flex items-center gap-2 border-b border-slate-700 pb-3">
                        <Eye size={24} className="text-amber-500" />
                        <span>視野情報</span>
                    </h3>
                    <p className="text-sm text-slate-400 mb-4 italic">
                        {myPlayer.role ? getRoleDescription(myPlayer.role.type) : ''}
                    </p>

                    {visionList.length > 0 ? (
                        <div className="space-y-4">
                            {visionList.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full border border-slate-500 overflow-hidden">
                                            <img src={item.player.avatar} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <span className="text-base text-slate-200 font-medium">{item.player.name}</span>
                                    </div>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm
                                        ${item.info?.type === 'evil' ? 'bg-red-950 text-red-400 border border-red-900' : 'bg-amber-950 text-amber-400 border border-amber-900'}
                                    `}>
                                        {item.info?.icon}
                                        {item.info?.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-slate-800/50 rounded-lg border border-slate-800 border-dashed">
                            <Eye size={32} className="text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-500 italic">
                                你的視野一片漆黑...<br/>
                                <span className="text-xs mt-1 block">你無法確認任何人的身份</span>
                            </p>
                        </div>
                    )}

                    <div className="mt-6 p-4 bg-indigo-900/20 rounded border border-indigo-500/30">
                        <h4 className="text-indigo-400 font-bold text-sm mb-1">獲勝條件</h4>
                        <p className="text-sm text-indigo-300 leading-relaxed">
                            {myPlayer.role?.alliance === Alliance.GOOD
                                ? "協助隊伍完成 3 個任務，並確保梅林不被刺客識破。"
                                : "破壞 3 個任務，或在任務失敗後找出並刺殺梅林。"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1" />

            <div className="sticky bottom-0 w-full max-w-5xl pt-6 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-950/90 backdrop-blur">
                <div className="flex justify-center">
                    <Button
                        variant="gold"
                        onClick={() => {
                            if (!roomCode) return;
                            setRoleAcked(true);
                            socket.emit('ack_role', { roomCode });
                        }}
                        disabled={!showRole || roleAcked}
                        className="px-12 text-lg"
                    >
                        {!showRole ? '請翻開卡片查看身份' : roleAcked ? '等待其他玩家...' : '進入遊戲'}
                    </Button>
                </div>
            </div>
            </div>
        </div>
      );
  };

  const renderMissionReveal = () => (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-[fadeIn_0.5s]">
        {isProcessingAI ? (
             <div className="animate-pulse flex flex-col items-center gap-4">
                 <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="font-cinzel text-xl text-amber-400 tracking-widest">吟遊詩人正在撰寫史詩...</p>
             </div>
        ) : phase === GamePhase.GAME_OVER ? (
            // GAME OVER SCREEN
            <div className="max-w-lg w-full relative">
                <div className="mb-6 animate-[bounce_1s]">
                    {manualWinner === Alliance.GOOD ? <Crown size={80} className="text-blue-400 mx-auto drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" /> : <Skull size={80} className="text-red-500 mx-auto drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />}
                </div>
                <h2 className={`text-6xl font-cinzel font-bold mb-2 ${manualWinner === Alliance.GOOD ? 'text-blue-400' : 'text-red-500'}`}>
                    {manualWinner === Alliance.GOOD ? '正義獲勝' : '邪惡獲勝'}
                </h2>

                <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 shadow-2xl mb-8 max-h-60 overflow-y-auto">
                    <p className="font-serif text-slate-300 italic text-lg leading-relaxed text-left">
                        {narrative || "歷史已經蓋棺論定。"}
                    </p>
                </div>

                <div className="space-y-3">
                    {amHost && (
                        <Button
                            variant="gold"
                            fullWidth
                            onClick={() => {
                                if (!roomCode) return;
                                socket.emit('restart_game', { roomCode });
                            }}
                        >
                            再來一局
                        </Button>
                    )}
                    <Button
                        variant="gold"
                        fullWidth
                        onClick={() => {
                            clearRoomFromUrl();
                            onNavigate(ViewState.HOME);
                        }}
                    >
                        返回主頁
                    </Button>

                    {!amHost && (
                        <p className="text-center text-xs text-slate-400 italic">等待房主開始下一局…</p>
                    )}
                    {/* Allow Host to change result if needed even after game over */}
                    {amHost && (
                        <div className="pt-4 border-t border-slate-800">
                             <p className="text-xs text-slate-500 mb-2">房主判定修正</p>
                             <div className="flex gap-2 justify-center">
                                 <button onClick={() => handleManualEndGame(Alliance.GOOD)} className="text-xs px-3 py-1 bg-blue-900 text-blue-300 rounded hover:bg-blue-800">改判正義勝</button>
                                 <button onClick={() => handleManualEndGame(Alliance.EVIL)} className="text-xs px-3 py-1 bg-red-900 text-red-300 rounded hover:bg-red-800">改判邪惡勝</button>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        ) : (
            // MISSION REVEAL SCREEN
            <div className="max-w-md w-full">
                <h2 className={`text-5xl font-cinzel font-bold mb-8 ${rounds[currentRoundIndex].status === 'SUCCESS' ? 'text-blue-400' : 'text-red-500'}`}>
                    {rounds[currentRoundIndex].status === 'SUCCESS' ? '任務成功' : '任務失敗'}
                </h2>

                <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 shadow-2xl mb-8">
                    <div className="flex justify-center gap-4 mb-8">
                        {rounds[currentRoundIndex].missionResults.map((res, i) => (
                            <div key={i} className={`p-4 rounded-full border-2 ${res === 'SUCCESS' ? 'bg-blue-950 border-blue-800 text-blue-400' : 'bg-red-950 border-red-800 text-red-400'}`}>
                                {res === 'SUCCESS' ? <CheckCircle size={32} /> : <XCircle size={32} />}
                            </div>
                        ))}
                    </div>
                    <div className="prose prose-invert">
                        <p className="font-serif text-slate-300 italic text-lg leading-relaxed">
                            "{narrative}"
                        </p>
                    </div>
                </div>

                <div className="mt-8">
                    <Button variant="gold" fullWidth onClick={nextRound}>
                        {rounds.filter(r => r.status === 'SUCCESS').length >= 3 || rounds.filter(r => r.status === 'FAIL').length >= 3 ? '查看最終結果' : '下一回合'}
                    </Button>
                </div>
            </div>
        )}
    </div>
  );

  // Circular layout calculator
  const getPlayerPosition = (index: number, total: number) => {
      const angle = (index / total) * 2 * Math.PI - Math.PI / 2; // Start at top
      const radius = 130;
      return {
          left: `calc(50% + ${Math.cos(angle) * radius}px)`,
          top: `calc(40% + ${Math.sin(angle) * radius}px)`
      };
  };

    const myPlayer = players.find(p => p.id === myPlayerId);
    const amHost = Boolean(myPlayer?.isHost);
  if (phase === GamePhase.ROLE_REVEAL) return renderRoleReveal();
    if (phase === GamePhase.LADY_OF_THE_LAKE) return renderLadyOfLake();

  const isStateReady = players.length > 0 && rounds.length > 0 && phase !== GamePhase.SETUP;
  if (!isStateReady) {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-slate-950 px-6 text-center">
              <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-6" />
              <h2 className="font-cinzel text-xl text-amber-400 mb-2">正在同步遊戲狀態…</h2>
              <p className="text-sm text-slate-400">
                  {netError
                      ? `連線錯誤：${netError}`
                      : roomCode
                          ? `房間：${roomCode}`
                          : '尚未取得房間資訊'}
              </p>
              <div className="mt-6 w-full max-w-xs space-y-3">
                  <Button variant="gold" fullWidth onClick={() => roomCode && socket.emit('get_game_state', { roomCode })} disabled={!roomCode}>
                      重新取得狀態
                  </Button>
                  <Button variant="secondary" fullWidth onClick={() => onNavigate(ViewState.LOBBY)}>
                      返回大廳
                  </Button>
              </div>
          </div>
      );
  }

    const leaderId = players[leaderIndex]?.id;
    const iAmLeader = phase === GamePhase.TEAM_SELECTION && leaderId === myPlayerId;
    const iAmAssassin = phase === GamePhase.ASSASSINATION && myPlayer?.role?.type === RoleType.ASSASSIN;
    const hasAssassin = players.some((p) => p.role?.type === RoleType.ASSASSIN);

    return (
        <div className="h-[100dvh] flex flex-col relative overflow-hidden bg-slate-950">
       {/* Top Bar: Rounds Tracker */}
       <div className="pt-4 px-2 pb-2 bg-slate-900/90 border-b border-slate-800 z-20 shadow-lg">
           <div className="flex justify-center gap-3">
               {rounds.map((r, i) => (
                   <div key={i} className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 text-sm font-bold transition-all relative
                        ${r.status === 'SUCCESS' ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' :
                          r.status === 'FAIL' ? 'bg-red-600 border-red-400 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                          r.status === 'CURRENT' ? 'bg-amber-500/20 border-amber-500 text-amber-500 animate-pulse' :
                          'bg-slate-800 border-slate-700 text-slate-600'
                        }
                   `}>
                       {r.status === 'SUCCESS' ? <CheckCircle size={16} /> :
                        r.status === 'FAIL' ? <XCircle size={16} /> :
                        r.playersRequired}
                   </div>
               ))}
           </div>
           <div className="text-center mt-3 flex justify-center gap-4 text-[10px] text-slate-400 font-cinzel uppercase tracking-widest">
               <span>Round {currentRoundIndex + 1}</span>
               <span>•</span>
               <span>Team Size: {rounds[currentRoundIndex].playersRequired}</span>
               <span>•</span>
               <span>Fails Needed: {rounds[currentRoundIndex].failsRequired}</span>
           </div>
       </div>

       {/* Game Board Area */}
       <div className="flex-1 relative mt-4">
           {/* Center Status */}
           <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-4 border-amber-900/50 bg-slate-900/80 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center text-center p-4 backdrop-blur-sm z-0">
               {phase === GamePhase.TEAM_SELECTION && (
                   <>
                        <Swords size={32} className="text-amber-600 mb-2 animate-pulse" />
                        <span className="text-amber-200 text-sm font-cinzel">等待隊長<br/>選擇隊伍</span>
                   </>
               )}
               {phase === GamePhase.VOTING && (
                   <>
                        <Gavel size={32} className="text-slate-300 mb-2 animate-bounce" />
                        <span className="text-white font-bold text-lg">全員投票中</span>
                        <span className="text-[10px] text-slate-400 mt-1">提案投票：第 {proposalAttempt}/5 次</span>
                   </>
               )}
               {phase === GamePhase.MISSION_EXECUTION && (
                   <>
                        <ShieldAlert size={32} className="text-red-400 mb-2 animate-pulse" />
                        <span className="text-red-300 font-bold text-lg">任務執行中</span>
                   </>
               )}
               {phase === GamePhase.ASSASSINATION && (
                   <>
                        <Skull size={40} className="text-red-600 mb-2 animate-pulse" />
                        <span className="text-red-500 font-bold text-lg font-cinzel">刺客現身</span>
                        <span className="text-xs text-red-300 mt-1">尋找梅林...</span>
                   </>
               )}

               {/* Team selection indicators */}
               <div className="flex flex-wrap justify-center gap-1 mt-3">
                    {selectedTeam.map(id => (
                        <div key={id} className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_5px_#fbbf24]"></div>
                    ))}
               </div>
           </div>

           {/* Players */}
           {players.map((p, i) => {
               const pos = getPlayerPosition(i, players.length);
               const isSelected = selectedTeam.includes(p.id);
               const isLeader = i === leaderIndex;
               const isMe = p.id === myPlayerId;
               const isLadyHolder = p.id === ladyOfLakeHolderId;
               const currentRound = rounds[currentRoundIndex];
               const roundVote = currentRound?.votes?.[p.id] ?? p.vote ?? null;
               const allVotesIn = Boolean(currentRound && players.length > 0 && players.every((pp) => Boolean(currentRound.votes?.[pp.id])));
               const isAssassinationTarget = phase === GamePhase.ASSASSINATION && assassinationTargetId === p.id;

               // Calculate Vision for current player relative to me
               const visionInfo = myPlayer ? getVisionInfo(myPlayer, p) : null;

               return (
                   <div
                        key={p.id}
                    className={`absolute w-20 h-20 transition-all duration-300 -translate-x-1/2 -translate-y-1/2 z-10
                        ${phase === GamePhase.TEAM_SELECTION ? (iAmLeader ? 'cursor-pointer' : 'cursor-not-allowed opacity-80') : ''}
                             ${isSelected ? 'scale-110' : ''}
                                      ${isAssassinationTarget ? 'scale-110' : ''}
                        `}
                        style={pos}
                    onClick={() => {
                       if (phase !== GamePhase.TEAM_SELECTION) return;
                       if (!iAmLeader) {
                          setNetError('只有隊長可以選人');
                          setTimeout(() => setNetError(null), 1500);
                          return;
                       }
                       handleTeamSelection(p.id);
                    }}
                   >
                        {/* Avatar */}
                            <div className={`w-full h-full rounded-full border-2 overflow-hidden relative shadow-2xl bg-slate-800
                                ${isSelected ? 'border-amber-400 ring-4 ring-amber-400/30' : 'border-slate-600'}
                                ${isLeader ? 'ring-2 ring-purple-500 border-purple-400' : ''}
                                ${isAssassinationTarget ? 'border-red-500 ring-4 ring-red-500/30' : ''}
                            `}>
                             <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />

                             {/* Vision Overlay on Board */}
                             {visionInfo && showVisionOnBoard && (
                                 <div className={`absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] border-2
                                    ${visionInfo.type === 'evil' ? 'border-red-500' : 'border-amber-400'}
                                    rounded-full
                                 `}>
                                     <div className="flex flex-col items-center">
                                         {visionInfo.type === 'evil' && <Skull size={24} className="text-red-500 animate-pulse drop-shadow-md" />}
                                         {visionInfo.type === 'unknown' && <HelpCircle size={24} className="text-amber-400 drop-shadow-md" />}
                                     </div>
                                 </div>
                             )}
                        </div>

                        {/* Leader Crown */}
                        {isLeader && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-purple-400 drop-shadow-[0_2px_10px_rgba(168,85,247,0.8)] z-20">
                                <Crown size={24} fill="currentColor" strokeWidth={1} />
                            </div>
                        )}

                        {/* Lady of the Lake marker */}
                        {isLadyHolder && (
                            <div className="absolute -top-6 -right-2 bg-blue-600 p-1.5 rounded-full border-2 border-slate-900 shadow-lg z-20">
                                <Waves size={18} className="text-white" />
                            </div>
                        )}

                        {/* Vote Result */}
                        {(phase === GamePhase.VOTING || phase === GamePhase.MISSION_EXECUTION || phase === GamePhase.TEAM_SELECTION) && roundVote && (
                            allVotesIn ? (
                                <div
                                    className={`absolute -right-2 -top-2 w-7 h-7 flex items-center justify-center rounded-full border shadow-lg z-20
                                        ${roundVote === 'APPROVE'
                                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                            : 'bg-rose-950 text-rose-300 border-rose-700'
                                        }
                                    `}
                                    title={roundVote === 'APPROVE' ? '贊成' : '否決'}
                                >
                                    {roundVote === 'APPROVE' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                </div>
                            ) : (
                                phase === GamePhase.VOTING ? (
                                    <div
                                        className="absolute -right-2 -top-2 w-7 h-7 flex items-center justify-center rounded-full border shadow-lg z-20 bg-slate-800 text-slate-200 border-slate-600"
                                        title="已投票"
                                    >
                                        <ScrollText size={14} />
                                    </div>
                                ) : null
                            )
                        )}

                        {/* Name Label */}
                        <div className={`absolute top-full left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap mt-2 border font-bold shadow-lg
                            ${isMe ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}
                        `}>
                            {p.name}
                        </div>
                   </div>
               );
           })}
       </div>

       {/* ASSASSINATION interaction: Assassin chooses a target */}
       {phase === GamePhase.ASSASSINATION && iAmAssassin && (
           <div className="absolute inset-0 z-10" aria-hidden="true" />
       )}

       {/* HOST JUDGMENT PANEL (fallback only when no Assassin exists) */}
       {(phase === GamePhase.ASSASSINATION) && amHost && !hasAssassin && (
           <div className="absolute bottom-36 left-0 w-full z-40 px-4 animate-[slideUp_0.5s]">
               <div className="bg-slate-900/95 border border-amber-500/50 rounded-xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-center">
                   <h3 className="font-cinzel text-amber-500 font-bold text-lg mb-2 flex items-center justify-center gap-2">
                       <Gavel size={20} /> 房主裁決時刻
                   </h3>

                   <p className="text-slate-300 text-sm mb-4">
                       未偵測到刺客角色。請由房主手動判定最終勝負。
                   </p>

                   <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleManualEndGame(Alliance.EVIL)}
                            className="bg-red-900/80 hover:bg-red-800 text-red-100 border border-red-600 py-3 rounded-lg font-bold flex flex-col items-center gap-1"
                        >
                            <span>⚔️ 刺殺成功</span>
                            <span className="text-[10px] opacity-70">邪惡陣營獲勝</span>
                        </button>
                        <button
                            onClick={() => handleManualEndGame(Alliance.GOOD)}
                            className="bg-blue-900/80 hover:bg-blue-800 text-blue-100 border border-blue-500 py-3 rounded-lg font-bold flex flex-col items-center gap-1"
                        >
                            <span>🛡️ 刺殺失敗</span>
                            <span className="text-[10px] opacity-70">正義陣營獲勝</span>
                        </button>
                   </div>
               </div>
           </div>
       )}

       {/* Waiting message */}
       {(phase === GamePhase.ASSASSINATION) && !iAmAssassin && (
           <div className="absolute bottom-36 left-0 w-full z-40 px-4 text-center">
               <div className="bg-black/60 backdrop-blur-md rounded-lg p-3 inline-block border border-slate-700">
                   <p className="text-amber-400 animate-pulse font-cinzel">等待刺客刺殺梅林...</p>
               </div>
           </div>
       )}

       {/* Bottom Actions Area */}
    <div className="bg-slate-900/90 backdrop-blur-lg border-t border-slate-700 p-4 pb-safe z-30 min-h-[160px] flex flex-col justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
           <div className="max-w-md mx-auto w-full">
               {netError && (
                   <div className="mb-3 text-center">
                       <span className="inline-flex items-center gap-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 px-3 py-2 rounded-full">
                           <Info size={14} /> {netError}
                       </span>
                   </div>
               )}
               {/* Team Selection Actions */}
               {phase === GamePhase.TEAM_SELECTION && players[leaderIndex].id === myPlayerId && (
                   <div className="flex flex-col gap-3 animate-[slideUp_0.3s]">
                       <p className="text-center text-sm text-amber-500 font-bold flex items-center justify-center gap-2">
                           <Crown size={16} />
                           你是隊長，請選擇 {rounds[currentRoundIndex].playersRequired} 名隊員
                       </p>
                       <Button
                        variant="gold"
                        fullWidth
                        onClick={submitTeam}
                        disabled={selectedTeam.length !== rounds[currentRoundIndex].playersRequired}
                       >
                           確認派出 ({selectedTeam.length}/{rounds[currentRoundIndex].playersRequired})
                       </Button>
                   </div>
               )}
               {phase === GamePhase.TEAM_SELECTION && players[leaderIndex].id !== myPlayerId && (
                   <div className="text-center space-y-2 animate-pulse">
                        <p className="text-slate-400 text-sm">等待隊長 {players[leaderIndex].name} 進行決策...</p>
                        <div className="flex justify-center gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></span>
                            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                        </div>
                   </div>
               )}

               {/* Voting Actions */}
               {phase === GamePhase.VOTING && players.find(p => p.id === myPlayerId)?.vote === null && (() => {
                   const myAlliance = players.find(p => p.id === myPlayerId)?.role?.alliance;
                   const isForced = proposalAttempt >= 5;
                   const mustApprove = isForced && myAlliance === Alliance.GOOD;
                   return (
                       <div className="space-y-3 animate-[slideUp_0.3s]">
                           {isForced && (
                               <div className="text-center text-xs text-rose-200 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2">
                                   <span className="font-bold">強制輪（第 5 次提案）</span>：好人必須投「贊成」。若第 5 次仍被否決，邪惡陣營直接獲勝。
                               </div>
                           )}
                           <div className="grid grid-cols-2 gap-4">
                               <Button variant="primary" onClick={() => handleVote('APPROVE')} className="bg-indigo-600 hover:bg-indigo-500">
                                   <CheckCircle size={20} className="mr-2"/> 贊成出發
                               </Button>
                               <Button
                                   variant="danger"
                                   onClick={() => handleVote('REJECT')}
                                   disabled={mustApprove}
                                   className={mustApprove ? 'bg-slate-800 opacity-50 cursor-not-allowed' : 'bg-rose-700 hover:bg-rose-600'}
                               >
                                   <XCircle size={20} className="mr-2"/> 否決提案
                               </Button>
                           </div>
                           {mustApprove && (
                               <p className="text-center text-xs text-slate-400 italic">你是好人：本輪被規則強制投贊成。</p>
                           )}
                       </div>
                   );
               })()}
               {phase === GamePhase.VOTING && players.find(p => p.id === myPlayerId)?.vote !== null && (
                   <p className="text-center text-slate-400 italic">已投票，等待其他人...</p>
               )}

               {/* Mission Actions */}
               {phase === GamePhase.MISSION_EXECUTION && selectedTeam.includes(myPlayerId) && players.find(p => p.id === myPlayerId)?.missionAction === null && (
                   <div className="animate-[slideUp_0.3s]">
                        <p className="text-center text-sm text-slate-300 mb-3 font-bold">請秘密執行任務卡</p>
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="primary" onClick={() => handleMissionAction('SUCCESS')} className="h-16 text-lg bg-blue-700 border-blue-500">
                                任務成功
                            </Button>
                            {/* Only Evil can fail */}
                            {players.find(p => p.id === myPlayerId)?.role?.alliance === Alliance.EVIL ? (
                                <Button variant="danger" onClick={() => handleMissionAction('FAIL')} className="h-16 text-lg bg-red-700 border-red-500">
                                    任務失敗
                                </Button>
                            ) : (
                                <Button variant="secondary" disabled className="h-16 opacity-40 cursor-not-allowed border-dashed">
                                    <span className="line-through text-sm">任務失敗</span>
                                    <span className="block text-[10px] text-slate-400">(好人無法失敗)</span>
                                </Button>
                            )}
                        </div>
                   </div>
               )}
               {phase === GamePhase.MISSION_EXECUTION && (!selectedTeam.includes(myPlayerId) || players.find(p => p.id === myPlayerId)?.missionAction !== null) && (
                   <div className="text-center space-y-3">
                       <ShieldAlert size={40} className="mx-auto text-amber-600 animate-pulse" />
                       <p className="text-slate-400 font-cinzel">任務執行中，請保持肅靜...</p>
                   </div>
               )}

               {/* Assassination/Game Over placeholder for Bottom Bar */}
               {phase === GamePhase.ASSASSINATION && (
                   iAmAssassin ? (
                       <div className="space-y-3 animate-[slideUp_0.3s]">
                           <p className="text-center text-sm text-red-300 font-bold">你是刺客：請選擇要刺殺的目標</p>
                           <div className="grid grid-cols-1 gap-2">
                               <select
                                   value={assassinationTargetId ?? ''}
                                   onChange={(e) => setAssassinationTargetId(e.target.value || null)}
                                   className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40"
                               >
                                   <option value="">選擇玩家…</option>
                                   {players
                                       .filter((p) => p.id !== myPlayerId)
                                       .map((p) => (
                                           <option key={p.id} value={p.id}>
                                               {p.name}
                                           </option>
                                       ))}
                               </select>
                               <Button
                                   variant="danger"
                                   fullWidth
                                   onClick={() => {
                                       if (!roomCode || !assassinationTargetId) return;
                                       socket.emit('assassinate', { roomCode, targetId: assassinationTargetId });
                                   }}
                                   disabled={!assassinationTargetId}
                               >
                                   確認刺殺
                               </Button>
                           </div>
                       </div>
                   ) : (
                       <div className="text-center space-y-2">
                           <p className="text-slate-400 text-sm">刺客正在做出選擇...</p>
                       </div>
                   )
               )}

               {phase === GamePhase.GAME_OVER && (
                   <div className="text-center">
                       <p className="text-slate-500 text-xs">Project Avalon</p>
                   </div>
               )}
           </div>
       </div>

       {/* Global Overlays */}
       {(phase === GamePhase.MISSION_REVEAL || phase === GamePhase.GAME_OVER) && renderMissionReveal()}

       <button
        className="absolute top-4 left-4 p-2.5 bg-slate-800/90 rounded-full border border-slate-600 text-slate-400 z-50 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
        onClick={() => {
            if (confirm('確定要離開遊戲？')) {
                clearRoomFromUrl();
                onNavigate(ViewState.HOME);
            }
        }}
       >
           <Swords size={20} />
       </button>

       {/* Vision Toggle (On Board) */}
       <button
        className={`absolute top-16 right-4 p-2.5 rounded-full border shadow-lg z-50 transition-all ${showVisionOnBoard ? 'bg-amber-600/90 text-white border-amber-400' : 'bg-slate-800/90 text-slate-400 border-slate-600'}`}
        onClick={() => setShowVisionOnBoard(!showVisionOnBoard)}
        title="切換視野標記"
       >
           {showVisionOnBoard ? <Eye size={18} /> : <EyeOff size={18} />}
       </button>

       {/* Identity & Vision Button */}
       <button
        className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-indigo-100 rounded-full border border-indigo-400/50 shadow-lg z-50 transition-all active:scale-95 backdrop-blur-sm"
        onClick={() => setShowRole(true)}
       >
           <User size={18} />
           <span className="font-bold text-sm">身份與視野</span>
       </button>

       {/* In-Game Role & Vision Modal */}
       {showRole && (
           <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4 animate-[fadeIn_0.2s]" onClick={() => setShowRole(false)}>
               <div onClick={e => e.stopPropagation()} className="relative max-w-sm w-full flex flex-col items-center">
                    <div className="scale-90 origin-bottom">
                        <RoleCard
                            role={myPlayer?.role || ROLES_CONFIG.LOYAL_SERVANT}
                            isRevealed={true}
                        />
                    </div>

                    <div className="mt-6 w-full bg-slate-900/90 p-5 rounded-xl border border-slate-600 backdrop-blur-xl shadow-2xl">
                        <h4 className="text-amber-500 font-cinzel text-lg mb-2 border-b border-slate-700 pb-2 flex items-center gap-2">
                            <Eye size={18} /> 視野情報
                        </h4>

                        <div className="mb-3 flex items-start gap-2 bg-slate-800/50 p-2 rounded text-xs text-slate-300">
                             <Info size={14} className="mt-0.5 text-blue-400 flex-shrink-0" />
                             <p>{myPlayer?.role ? getRoleDescription(myPlayer.role.type) : ''}</p>
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                            {players.map(p => {
                                const info = myPlayer ? getVisionInfo(myPlayer, p) : null;
                                if (!info) return null;
                                return (
                                    <div key={p.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <img src={p.avatar} className="w-6 h-6 rounded-full" alt="" />
                                            <span className="text-slate-300 text-sm">{p.name}</span>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${info.type === 'evil' ? 'bg-red-900/50 text-red-400' : 'bg-amber-900/50 text-amber-400'}`}>
                                            {info.icon} {info.text}
                                        </span>
                                    </div>
                                );
                            })}
                            {!players.some(p => myPlayer && getVisionInfo(myPlayer, p)) && (
                                <div className="text-center py-4 text-slate-500 italic text-sm">
                                    此角色沒有可見的特殊身份資訊
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="text-slate-500 mt-6 text-sm flex items-center gap-2 animate-pulse">
                        <User size={14} /> 點擊背景關閉
                    </p>
               </div>
           </div>
       )}
    </div>
  );
};