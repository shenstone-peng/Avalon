import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const setSocketAuthToken = (token: string | null) => {
  if (!socket) return;
  socket.auth = token ? { token } : {};
  // Force reconnect to apply auth changes.
  try {
    socket.disconnect();
  } catch {
    // ignore
  }
  try {
    socket.connect();
  } catch {
    // ignore
  }
};

export const getSocket = (): Socket => {
  if (socket) return socket;

  // In dev, Vite proxies /socket.io to http://localhost:3000
  // In prod, this connects to same-origin where server.js serves dist.
  socket = io({
    auth: {
      token: localStorage.getItem('auth_token') || undefined,
    },
    // Allow fallback when WebSockets are disabled/limited (common on some hosts/plans).
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 5000,
  });

  return socket;
};

export type RoomErrorCode = 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_ALREADY_STARTED' | 'NOT_ENOUGH_PLAYERS';

export type NetVote = 'APPROVE' | 'REJECT';
export type NetMissionAction = 'SUCCESS' | 'FAIL';

export type NetGamePhase =
  | 'ROLE_REVEAL'
  | 'TEAM_SELECTION'
  | 'VOTING'
  | 'MISSION_EXECUTION'
  | 'MISSION_REVEAL'
  | 'ASSASSINATION'
  | 'GAME_OVER';

export interface NetRoomPlayer {
  id: string;
  name: string;
  avatarIndex: number;
  isHost: boolean;
}

export interface NetRoomState {
  roomCode: string;
  hostId: string;
  players: NetRoomPlayer[];
  maxPlayers: number;
  inGame: boolean;
}

export interface NetGamePlayer {
  id: string;
  name: string;
  avatarIndex: number;
  isHost: boolean;
  roleKey: string | null;
  alliance: 'GOOD' | 'EVIL' | null;
  isLeader: boolean;
  vote: NetVote | null;
  missionAction: NetMissionAction | null;
}

export interface NetMissionRound {
  roundNumber: number;
  playersRequired: number;
  failsRequired: number;
  status: 'PENDING' | 'SUCCESS' | 'FAIL' | 'CURRENT';
  selectedTeam: string[];
  votes: Record<string, NetVote>;
  missionResults: NetMissionAction[];
}

export interface NetGameState {
  roomCode: string;
  phase: NetGamePhase;
  proposalAttempt?: number;
  players: NetGamePlayer[];
  leaderId: string;
  leaderIndex: number;
  currentRoundIndex: number;
  rounds: NetMissionRound[];
  selectedTeam: string[];
  manualWinner: 'GOOD' | 'EVIL' | null;
  assassinationTargetId?: string | null;
}
