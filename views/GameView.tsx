import React, { useState, useEffect } from 'react';
import { ViewState, GamePhase, Player, RoleType, Alliance, ROLES_CONFIG, MissionRound, Role } from '../types';
import { AVATARS, MISSION_CONFIG_5_PLAYERS } from '../constants';
import { Button } from '../components/Button';
import { RoleCard } from '../components/RoleCard';
import { generateMissionStory, generateEndGameAnalysis } from '../services/geminiService';
import { ScrollText, Swords, XCircle, CheckCircle, Crown, Eye, Gavel, ShieldAlert, HelpCircle, Skull } from 'lucide-react';

interface Props {
  onNavigate: (view: ViewState) => void;
  playerName: string;
}

export const GameView: React.FC<Props> = ({ onNavigate, playerName }) => {
  // Game State
  const [phase, setPhase] = useState<GamePhase>(GamePhase.SETUP);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [rounds, setRounds] = useState<MissionRound[]>([]);
  const [leaderIndex, setLeaderIndex] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [narrative, setNarrative] = useState<string>('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [manualWinner, setManualWinner] = useState<Alliance | null>(null);

  // Initialize Game
  useEffect(() => {
    initializeGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeGame = () => {
    // 1. Create Players
    const newPlayers: Player[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `p${i}`,
      name: i === 0 ? playerName : `玩家 ${i + 1}`, // Clean names
      isLeader: i === 0, // Player starts as leader for demo
      avatar: AVATARS[i],
      isBot: i !== 0,
      vote: null,
      missionAction: null
    }));

    setMyPlayerId(newPlayers[0].id);

    // 2. Assign Roles (Simplified 5-player setup: Merlin, Percival, Servant | Morgana, Assassin)
    // Note: In a real app, Mordred/Oberon logic handles different vision rules. 
    // Here we use a standard setup to demonstrate vision.
    const roles: Role[] = [
        ROLES_CONFIG.MERLIN,
        ROLES_CONFIG.PERCIVAL,
        ROLES_CONFIG.LOYAL_SERVANT,
        ROLES_CONFIG.MORGANA,
        ROLES_CONFIG.ASSASSIN
    ];
    
    // Shuffle roles
    const shuffledRoles = roles.sort(() => Math.random() - 0.5);
    newPlayers.forEach((p, i) => {
        p.role = shuffledRoles[i];
    });

    setPlayers(newPlayers);

    // 3. Setup Rounds
    const newRounds: MissionRound[] = MISSION_CONFIG_5_PLAYERS.map((cfg, i) => ({
      roundNumber: i + 1,
      playersRequired: cfg.players,
      failsRequired: cfg.fails,
      status: i === 0 ? 'CURRENT' : 'PENDING',
      selectedTeam: [],
      votes: {},
      missionResults: []
    }));
    setRounds(newRounds);

    // 4. Start
    setPhase(GamePhase.ROLE_REVEAL);
  };

  // --- VISION LOGIC ---
  const getVisionInfo = (observer: Player, target: Player): { icon: React.ReactNode, text: string, type: 'evil' | 'good' | 'unknown' } | null => {
      if (observer.id === target.id) return null;
      if (!observer.role || !target.role) return null;

      const obsType = observer.role.type;
      const targetType = target.role.type;
      const targetAlliance = target.role.alliance;

      // 1. 梅林 (Merlin)
      // 看到：Morgana, Assassin, Minion, Oberon 為壞人
      // 看不到：Mordred (顯示為好人/未知)
      if (obsType === RoleType.MERLIN) {
          if (targetAlliance === Alliance.EVIL && targetType !== RoleType.MORDRED) {
              return { icon: <Skull size={14} />, text: '邪惡陣營', type: 'evil' };
          }
      }

      // 2. 派西維爾 (Percival)
      // 看到：Merlin 和 Morgana 為「梅林？」(分不出來)
      if (obsType === RoleType.PERCIVAL) {
          if (targetType === RoleType.MERLIN || targetType === RoleType.MORGANA) {
              return { icon: <HelpCircle size={14} />, text: '梅林?', type: 'unknown' };
          }
      }

      // 3. 壞人視野 (Evil)
      // 看到：其他壞人 (除了 Oberon)
      // Oberon：看不到隊友，隊友也看不到他
      if (observer.role.alliance === Alliance.EVIL && obsType !== RoleType.OBERON) {
          if (targetAlliance === Alliance.EVIL && targetType !== RoleType.OBERON) {
              return { icon: <Skull size={14} />, text: '同夥', type: 'evil' };
          }
      }

      return null;
  };

  // Bot Logic Helpers
  const simulateBotVotes = () => {
     setPlayers(prev => prev.map(p => {
         if (p.isBot) {
             return { ...p, vote: Math.random() > 0.3 ? 'APPROVE' : 'REJECT' };
         }
         return p;
     }));
  };

  const simulateBotMissionActions = (teamIds: string[]) => {
      setPlayers(prev => prev.map(p => {
          if (p.isBot && teamIds.includes(p.id)) {
              const isEvil = p.role?.alliance === Alliance.EVIL;
              // Evil bots fail most of the time
              const action = (isEvil && Math.random() > 0.1) ? 'FAIL' : 'SUCCESS';
              return { ...p, missionAction: action };
          }
          return p;
      }));
  };

  // -- Phase Handlers --

  const handleTeamSelection = (playerId: string) => {
      if (phase !== GamePhase.TEAM_SELECTION) return;
      const currentLeader = players[leaderIndex];
      // Note: In local pass-and-play or simplified online, we might enforce leader only
      if (currentLeader.id !== myPlayerId) return; 

      const required = rounds[currentRoundIndex].playersRequired;
      
      setSelectedTeam(prev => {
          if (prev.includes(playerId)) {
              return prev.filter(id => id !== playerId);
          }
          if (prev.length < required) {
              return [...prev, playerId];
          }
          return prev;
      });
  };

  const submitTeam = () => {
      setPhase(GamePhase.VOTING);
      setPlayers(prev => prev.map(p => ({...p, vote: null})));
      setTimeout(() => simulateBotVotes(), 1000);
  };

  const handleVote = (vote: 'APPROVE' | 'REJECT') => {
      setPlayers(prev => prev.map(p => p.id === myPlayerId ? { ...p, vote } : p));
  };

  // Check if all voted
  useEffect(() => {
      if (phase === GamePhase.VOTING) {
          const allVoted = players.every(p => p.vote !== null);
          if (allVoted) {
              setTimeout(finalizeVotes, 1500);
          }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, phase]);

  const finalizeVotes = () => {
      const approves = players.filter(p => p.vote === 'APPROVE').length;
      const rejects = players.filter(p => p.vote === 'REJECT').length;

      if (approves > rejects) {
          setPhase(GamePhase.MISSION_EXECUTION);
          setPlayers(prev => prev.map(p => ({ ...p, missionAction: null })));
          simulateBotMissionActions(selectedTeam);
      } else {
          setPhase(GamePhase.TEAM_SELECTION);
          setLeaderIndex((leaderIndex + 1) % players.length);
          setSelectedTeam([]);
          // Show toast: Vote Failed
      }
  };

  const handleMissionAction = (action: 'SUCCESS' | 'FAIL') => {
      setPlayers(prev => prev.map(p => p.id === myPlayerId ? { ...p, missionAction: action } : p));
  };

   // Check if all mission participants acted
   useEffect(() => {
    if (phase === GamePhase.MISSION_EXECUTION) {
        const teamPlayers = players.filter(p => selectedTeam.includes(p.id));
        const allActed = teamPlayers.every(p => p.missionAction !== null);
        if (allActed && teamPlayers.length > 0) {
            setTimeout(finalizeMission, 1500);
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [players, phase]);

    const finalizeMission = async () => {
        const teamActions = players
            .filter(p => selectedTeam.includes(p.id))
            .map(p => p.missionAction as 'SUCCESS' | 'FAIL');
        
        const failCount = teamActions.filter(a => a === 'FAIL').length;
        const requiredFails = rounds[currentRoundIndex].failsRequired;
        const isSuccess = failCount < requiredFails;

        // AI Story Generation
        setIsProcessingAI(true);
        const teamObjs = players.filter(p => selectedTeam.includes(p.id));
        const currentRound = { ...rounds[currentRoundIndex], missionResults: teamActions };
        
        const story = await generateMissionStory(currentRound, teamObjs, isSuccess);
        setNarrative(story);
        setIsProcessingAI(false);

        // Update Round History
        setRounds(prev => prev.map((r, i) => {
            if (i === currentRoundIndex) {
                return { ...r, status: isSuccess ? 'SUCCESS' : 'FAIL', missionResults: teamActions };
            }
            if (i === currentRoundIndex + 1) {
                return { ...r, status: 'CURRENT' };
            }
            return r;
        }));

        setPhase(GamePhase.MISSION_REVEAL);
    };

    const nextRound = () => {
        // Check auto win conditions (3 success or 3 fails)
        const successes = rounds.filter(r => r.status === 'SUCCESS').length;
        const fails = rounds.filter(r => r.status === 'FAIL').length;

        if (successes >= 3 || fails >= 3) {
            // Auto determine provisional winner, but let host confirm
            setManualWinner(successes >= 3 ? Alliance.GOOD : Alliance.EVIL);
            setPhase(GamePhase.GAME_OVER);
            return;
        }

        if (currentRoundIndex < 4) {
            setCurrentRoundIndex(prev => prev + 1);
            setPhase(GamePhase.TEAM_SELECTION);
            setSelectedTeam([]);
            setLeaderIndex((leaderIndex + 1) % players.length);
            setNarrative('');
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
    };

  // -- Render Helpers --

  const renderRoleReveal = () => {
      const myPlayer = players.find(p => p.id === myPlayerId);
      if (!myPlayer) return null;

      // Calculate vision info list
      const visionList = players
        .map(p => ({ player: p, info: getVisionInfo(myPlayer, p) }))
        .filter(item => item.info !== null);

      return (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 animate-[fadeIn_0.5s]">
            <h2 className="text-2xl font-cinzel text-amber-500 mb-4">確認你的身份</h2>
            
            <div className="flex flex-col md:flex-row items-center gap-8 max-w-4xl w-full justify-center">
                {/* My Card */}
                <div className="flex-shrink-0">
                    <RoleCard 
                        role={myPlayer.role || ROLES_CONFIG.LOYAL_SERVANT} 
                        isRevealed={showRole} 
                        onReveal={() => setShowRole(!showRole)} 
                    />
                </div>

                {/* Vision Info Panel */}
                {showRole && (
                    <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-xl animate-[slideInRight_0.5s]">
                        <h3 className="font-cinzel text-lg text-slate-300 mb-4 flex items-center gap-2">
                            <Eye size={18} />
                            你的視野情報
                        </h3>
                        {visionList.length > 0 ? (
                            <div className="space-y-3">
                                {visionList.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <img src={item.player.avatar} className="w-8 h-8 rounded-full" alt="" />
                                            <span className="text-sm text-slate-200">{item.player.name}</span>
                                        </div>
                                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded
                                            ${item.info?.type === 'evil' ? 'bg-red-900/50 text-red-400' : 'bg-amber-900/50 text-amber-400'}
                                        `}>
                                            {item.info?.icon}
                                            {item.info?.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm italic">
                                你的視野一片漆黑，你不知道誰是誰。<br/>
                                (除非你是奧伯倫，或者是普通的忠臣)
                            </p>
                        )}
                        <div className="mt-6 p-3 bg-indigo-900/20 rounded border border-indigo-500/30">
                            <p className="text-xs text-indigo-300">
                                <span className="font-bold">任務目標：</span>
                                {myPlayer.role?.alliance === Alliance.GOOD 
                                    ? "成功執行 3 個任務，並保護梅林不被刺殺。" 
                                    : "破壞 3 個任務，或在最後刺殺梅林。"}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8">
                <Button onClick={() => setPhase(GamePhase.TEAM_SELECTION)} disabled={!showRole}>
                    {showRole ? '開始遊戲' : '請先翻開卡片'}
                </Button>
            </div>
        </div>
      );
  };

  const renderMissionReveal = () => (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-[fadeIn_0.5s]">
        {isProcessingAI ? (
             <div className="animate-pulse flex flex-col items-center gap-4">
                 <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="font-cinzel text-amber-400">吟遊詩人正在撰寫史詩...</p>
             </div>
        ) : phase === GamePhase.GAME_OVER ? (
            // GAME OVER SCREEN
            <div className="max-w-md w-full">
                <div className="mb-6 animate-[bounce_1s]">
                    {manualWinner === Alliance.GOOD ? <Crown size={64} className="text-blue-400 mx-auto" /> : <Skull size={64} className="text-red-500 mx-auto" />}
                </div>
                <h2 className={`text-5xl font-cinzel font-bold mb-2 ${manualWinner === Alliance.GOOD ? 'text-blue-400' : 'text-red-500'}`}>
                    {manualWinner === Alliance.GOOD ? '正義獲勝' : '邪惡獲勝'}
                </h2>
                <p className="text-slate-400 mb-8 font-cinzel tracking-widest uppercase">Game Over</p>
                
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-600 shadow-2xl mb-8 max-h-60 overflow-y-auto">
                    <p className="font-serif text-slate-300 italic text-sm leading-relaxed text-left">
                        {narrative || "歷史已經蓋棺論定。"}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <Button variant="gold" onClick={() => onNavigate(ViewState.HOME)}>返回主頁</Button>
                </div>
            </div>
        ) : (
            // MISSION REVEAL SCREEN
            <>
                <h2 className={`text-4xl font-cinzel font-bold mb-6 ${rounds[currentRoundIndex].status === 'SUCCESS' ? 'text-blue-400' : 'text-red-500'}`}>
                    {rounds[currentRoundIndex].status === 'SUCCESS' ? '任務成功' : '任務失敗'}
                </h2>
                
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-600 max-w-md shadow-2xl">
                    <div className="flex justify-center gap-4 mb-6">
                        {rounds[currentRoundIndex].missionResults.map((res, i) => (
                            <div key={i} className={`p-3 rounded-full ${res === 'SUCCESS' ? 'bg-blue-900/50 text-blue-400' : 'bg-red-900/50 text-red-400'}`}>
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
                    <Button variant="gold" onClick={nextRound}>繼續</Button>
                </div>
            </>
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
  if (phase === GamePhase.ROLE_REVEAL) return renderRoleReveal();

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-slate-950">
       {/* Top Bar: Rounds Tracker */}
       <div className="pt-4 px-2 pb-2 bg-slate-900/80 z-20 shadow-md">
           <div className="flex justify-center gap-2">
               {rounds.map((r, i) => (
                   <div key={i} className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 text-sm font-bold transition-all
                        ${r.status === 'SUCCESS' ? 'bg-blue-600 border-blue-400 text-white' : 
                          r.status === 'FAIL' ? 'bg-red-600 border-red-400 text-white' :
                          r.status === 'CURRENT' ? 'bg-amber-500/20 border-amber-500 text-amber-500 animate-pulse' :
                          'bg-slate-800 border-slate-600 text-slate-500'
                        }
                   `}>
                       {r.status === 'SUCCESS' ? <div className="w-2 h-2 bg-white rounded-full"/> : 
                        r.status === 'FAIL' ? <div className="w-2 h-2 bg-black rounded-full"/> :
                        r.playersRequired}
                   </div>
               ))}
           </div>
           <div className="text-center mt-2 text-xs text-slate-400 font-cinzel">
               任務 {currentRoundIndex + 1} • 需 {rounds[currentRoundIndex].playersRequired} 人 • {rounds[currentRoundIndex].failsRequired} 失敗票
           </div>
       </div>

       {/* Game Board Area */}
       <div className="flex-1 relative mt-4">
           {/* Center Status */}
           <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-4 border-amber-800 bg-amber-900/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center text-center p-2 backdrop-blur-sm z-0">
               {phase === GamePhase.TEAM_SELECTION && (
                   <span className="text-amber-200 text-xs animate-bounce font-cinzel">等待隊長<br/>選擇隊伍</span>
               )}
               {phase === GamePhase.VOTING && (
                   <span className="text-white font-bold text-lg animate-pulse">投票中</span>
               )}
               {phase === GamePhase.MISSION_EXECUTION && (
                   <span className="text-red-300 font-bold text-lg">任務進行</span>
               )}
               
               {/* Team selection indicators */}
               <div className="flex flex-wrap justify-center gap-1 mt-2">
                    {selectedTeam.map(id => (
                        <div key={id} className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]"></div>
                    ))}
               </div>
           </div>

           {/* Players */}
           {players.map((p, i) => {
               const pos = getPlayerPosition(i, players.length);
               const isSelected = selectedTeam.includes(p.id);
               const isLeader = i === leaderIndex;
               const isMe = p.id === myPlayerId;
               
               // Calculate Vision for current player relative to me
               const visionInfo = myPlayer ? getVisionInfo(myPlayer, p) : null;
               
               return (
                   <div 
                        key={p.id} 
                        className={`absolute w-16 h-16 transition-all duration-300 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10
                             ${isSelected ? 'scale-110' : ''}
                        `}
                        style={pos}
                        onClick={() => handleTeamSelection(p.id)}
                   >
                        {/* Avatar */}
                        <div className={`w-full h-full rounded-full border-2 overflow-hidden relative shadow-lg bg-slate-800
                             ${isSelected ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-slate-500'}
                             ${isLeader ? 'ring-2 ring-purple-500' : ''}
                        `}>
                             <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                             
                             {/* Vision Overlay (Very important) */}
                             {visionInfo && (
                                 <div className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]
                                    ${visionInfo.type === 'evil' ? 'border-red-500' : 'border-amber-500'}
                                 `}>
                                     {visionInfo.type === 'evil' && <Skull size={24} className="text-red-500 animate-pulse" />}
                                     {visionInfo.type === 'unknown' && <HelpCircle size={24} className="text-amber-400" />}
                                 </div>
                             )}
                        </div>
                        
                        {/* Indicators */}
                        {isLeader && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-purple-400 drop-shadow-md bg-slate-900 rounded-full p-0.5 border border-purple-900">
                                <Crown size={16} fill="currentColor" />
                            </div>
                        )}

                        {/* Vote Result (Only show after voting) */}
                        {/* Simplified: Show who voted what briefly or just status */}
                        {phase === GamePhase.VOTING && p.vote && (
                             <div className="absolute -right-2 top-0 text-xs bg-slate-700 rounded-full p-1 border border-slate-500">
                                 🗳️
                             </div>
                        )}
                        
                        {/* Name Label */}
                        <div className={`absolute top-full left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] whitespace-nowrap mt-1 border
                            ${isMe ? 'bg-amber-900/80 border-amber-700 text-amber-100' : 'bg-black/60 border-slate-700 text-slate-300'}
                        `}>
                            {p.name}
                        </div>
                   </div>
               );
           })}
       </div>

       {/* HOST CONTROLS (Only for Leader/Creator - p0) */}
       {myPlayerId === 'p0' && phase !== GamePhase.GAME_OVER && (
           <div className="absolute top-16 right-2 z-40 flex flex-col gap-2">
               <button 
                onClick={() => {
                    if (confirm('確定要強制結束遊戲並判定正義陣營獲勝嗎？')) handleManualEndGame(Alliance.GOOD);
                }}
                className="p-2 bg-blue-900/80 rounded-full border border-blue-500 text-blue-200 hover:bg-blue-800 shadow-lg"
                title="判定正義獲勝"
               >
                   <Gavel size={16} />
               </button>
               <button 
                onClick={() => {
                    if (confirm('確定要強制結束遊戲並判定邪惡陣營獲勝嗎？')) handleManualEndGame(Alliance.EVIL);
                }}
                className="p-2 bg-red-900/80 rounded-full border border-red-500 text-red-200 hover:bg-red-800 shadow-lg"
                title="判定邪惡獲勝"
               >
                   <Gavel size={16} />
               </button>
           </div>
       )}

       {/* Bottom Actions */}
       <div className="bg-slate-900/90 backdrop-blur-md border-t border-slate-700 p-4 pb-safe z-30 min-h-[160px] flex flex-col justify-center">
           <div className="max-w-md mx-auto w-full">
               {/* Team Selection Actions */}
               {phase === GamePhase.TEAM_SELECTION && players[leaderIndex].id === myPlayerId && (
                   <div className="flex flex-col gap-3 animate-[slideUp_0.3s]">
                       <p className="text-center text-sm text-amber-500 font-bold">
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
                   <p className="text-center text-slate-400">等待隊長 {players[leaderIndex].name} 進行決策...</p>
               )}

               {/* Voting Actions */}
               {phase === GamePhase.VOTING && players.find(p => p.id === myPlayerId)?.vote === null && (
                   <div className="grid grid-cols-2 gap-4 animate-[slideUp_0.3s]">
                       <Button variant="primary" onClick={() => handleVote('APPROVE')}>
                           <CheckCircle size={18} className="mr-1"/> 贊成
                       </Button>
                       <Button variant="danger" onClick={() => handleVote('REJECT')}>
                           <XCircle size={18} className="mr-1"/> 否決
                       </Button>
                   </div>
               )}
               {phase === GamePhase.VOTING && players.find(p => p.id === myPlayerId)?.vote !== null && (
                   <p className="text-center text-slate-400">已投票，等待其他人...</p>
               )}

               {/* Mission Actions */}
               {phase === GamePhase.MISSION_EXECUTION && selectedTeam.includes(myPlayerId) && players.find(p => p.id === myPlayerId)?.missionAction === null && (
                   <div className="animate-[slideUp_0.3s]">
                        <p className="text-center text-sm text-slate-300 mb-2">請執行任務卡</p>
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="primary" onClick={() => handleMissionAction('SUCCESS')}>任務成功</Button>
                            {/* Only Evil can fail */}
                            {players.find(p => p.id === myPlayerId)?.role?.alliance === Alliance.EVIL ? (
                                <Button variant="danger" onClick={() => handleMissionAction('FAIL')}>任務失敗</Button>
                            ) : (
                                <Button variant="secondary" disabled className="opacity-50 cursor-not-allowed">
                                    <span className="line-through">任務失敗</span>
                                </Button>
                            )}
                        </div>
                   </div>
               )}
               {phase === GamePhase.MISSION_EXECUTION && (!selectedTeam.includes(myPlayerId) || players.find(p => p.id === myPlayerId)?.missionAction !== null) && (
                   <div className="text-center space-y-2">
                       <ShieldAlert size={32} className="mx-auto text-amber-600 animate-pulse" />
                       <p className="text-slate-400">任務執行中，請保持肅靜...</p>
                   </div>
               )}
           </div>
       </div>

       {/* Global Overlays */}
       {(phase === GamePhase.MISSION_REVEAL || phase === GamePhase.GAME_OVER) && renderMissionReveal()}

       <button 
        className="absolute top-4 left-4 p-2 bg-slate-800/80 rounded-full border border-slate-600 text-slate-400 z-50 hover:text-white"
        onClick={() => { if(confirm('確定要離開遊戲？')) onNavigate(ViewState.HOME); }}
       >
           <Swords size={16} />
       </button>
       
       {/* Info Button */}
       <button
        className="absolute top-4 right-14 p-2 bg-slate-800/80 rounded-full border border-slate-600 text-slate-400 z-50 hover:text-amber-400"
        onClick={() => setShowRole(true)}
       >
           <Eye size={16} />
       </button>
       
       {/* In-Game Role Peek Overlay */}
       {showRole && (
           <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setShowRole(false)}>
               <div onClick={e => e.stopPropagation()} className="relative">
                    <RoleCard 
                        role={myPlayer?.role || ROLES_CONFIG.LOYAL_SERVANT} 
                        isRevealed={true} 
                    />
                    <div className="mt-4 bg-slate-800 p-4 rounded-lg border border-slate-700 max-w-xs mx-auto">
                        <h4 className="text-amber-500 font-cinzel mb-2 border-b border-slate-600 pb-1">視野情報</h4>
                        <ul className="text-xs text-slate-300 space-y-1">
                            {players.map(p => {
                                const info = myPlayer ? getVisionInfo(myPlayer, p) : null;
                                if (!info) return null;
                                return (
                                    <li key={p.id} className="flex justify-between">
                                        <span>{p.name}:</span>
                                        <span className={info.type === 'evil' ? 'text-red-400' : 'text-amber-400'}>{info.text}</span>
                                    </li>
                                );
                            })}
                            {!players.some(p => myPlayer && getVisionInfo(myPlayer, p)) && (
                                <li className="italic text-slate-500">無特殊視野</li>
                            )}
                        </ul>
                    </div>
               </div>
               <p className="text-slate-500 mt-4 text-sm">點擊背景關閉</p>
           </div>
       )}
    </div>
  );
};