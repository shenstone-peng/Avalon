
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Azure App Service 會透過環境變數注入 PORT
const port = process.env.PORT || 3000;

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
});

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 10;

/**
 * In-memory rooms. Production should persist to DB/Redis.
 * room = {
 *  code: string,
 *  hostId: string,
 *  players: Map<socketId, {id,name,avatarIndex}>,
 *  game: GameState | null,
 * }
 */
const rooms = new Map();

const PLAYER_COUNT_CONFIG = {
  5: { good: 3, evil: 2, questSizes: [2, 3, 2, 3, 3] },
  6: { good: 4, evil: 2, questSizes: [2, 3, 4, 3, 4] },
  7: { good: 4, evil: 3, questSizes: [2, 3, 3, 4, 4] },
  8: { good: 5, evil: 3, questSizes: [3, 4, 4, 5, 5] },
  9: { good: 6, evil: 3, questSizes: [3, 4, 4, 5, 5] },
  10: { good: 6, evil: 4, questSizes: [3, 4, 4, 5, 5] },
};

const getMissionConfigForCount = (playerCount) => {
  const cfg = PLAYER_COUNT_CONFIG[playerCount];
  if (!cfg) throw new Error('UNSUPPORTED_PLAYER_COUNT');
  return cfg.questSizes.map((players, idx) => ({
    players,
    // Standard Avalon: 4th mission requires 2 fails when playerCount >= 7
    fails: playerCount >= 7 && idx === 3 ? 2 : 1,
  }));
};

const getRolesDeckForCount = (playerCount) => {
  const cfg = PLAYER_COUNT_CONFIG[playerCount];
  if (!cfg) throw new Error('UNSUPPORTED_PLAYER_COUNT');

  // Always include core specials (stable, matches current client vision rules)
  const baseGood = ['MERLIN', 'PERCIVAL'];
  // Per rule.md:
  // - 5–6: Morgana + Assassin
  // - 7–9: + Mordred
  // - 10: + Mordred + Oberon
  const baseEvil = ['MORGANA', 'ASSASSIN'];
  if (playerCount >= 7) baseEvil.push('MORDRED');
  if (playerCount >= 10) baseEvil.push('OBERON');

  const loyalCount = Math.max(0, cfg.good - baseGood.length);
  const minionCount = Math.max(0, cfg.evil - baseEvil.length);

  const deck = [
    ...baseGood,
    ...Array.from({ length: loyalCount }).map(() => 'LOYAL_SERVANT'),
    ...baseEvil,
    ...Array.from({ length: minionCount }).map(() => 'MINION'),
  ];

  if (deck.length !== playerCount) throw new Error('ROLE_DECK_MISMATCH');
  return deck;
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateRoomCode = () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `AV-${randomInt(1000, 9999)}`;
    if (!rooms.has(code)) return code;
  }
  return `AV-${Date.now().toString().slice(-4)}`;
};

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getRoomPublicState = (room) => {
  const players = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    avatarIndex: p.avatarIndex,
    isHost: p.id === room.hostId,
  }));
  return {
    roomCode: room.code,
    hostId: room.hostId,
    players,
    maxPlayers: MAX_PLAYERS,
    inGame: Boolean(room.game),
  };
};

const getGamePublicState = (room) => {
  if (!room.game) return null;
  const game = room.game;
  const players = Array.from(room.players.values()).map((p) => {
    const gp = game.players[p.id];
    return {
      id: p.id,
      name: p.name,
      avatarIndex: p.avatarIndex,
      isHost: p.id === room.hostId,
      roleKey: gp?.roleKey ?? null,
      alliance: gp?.alliance ?? null,
      isLeader: p.id === game.leaderId,
      vote: gp?.vote ?? null,
      missionAction: gp?.missionAction ?? null,
    };
  });

  return {
    roomCode: room.code,
    phase: game.phase,
    players,
    leaderId: game.leaderId,
    leaderIndex: players.findIndex((p) => p.id === game.leaderId),
    currentRoundIndex: game.currentRoundIndex,
    rounds: game.rounds,
    selectedTeam: game.selectedTeam,
    manualWinner: game.manualWinner,
    assassinationTargetId: game.assassinationTargetId ?? null,
  };
};

const broadcastRoomUpdate = (room) => {
  io.to(room.code).emit('room_update', getRoomPublicState(room));
};

const broadcastGameUpdate = (room) => {
  const state = getGamePublicState(room);
  if (state) io.to(room.code).emit('game_state', state);
};

const ensureRoom = (code) => {
  const room = rooms.get(code);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  return room;
};

const ensureGame = (room) => {
  if (!room.game) throw new Error('GAME_NOT_STARTED');
  return room.game;
};

const isHost = (room, socketId) => room.hostId === socketId;

const computeAlliance = (roleKey) => {
  if (
    roleKey === 'MORGANA' ||
    roleKey === 'ASSASSIN' ||
    roleKey === 'MORDRED' ||
    roleKey === 'OBERON' ||
    roleKey === 'MINION'
  ) {
    return 'EVIL';
  }
  return 'GOOD';
};

const startGameForRoom = (room) => {
  const playerIds = Array.from(room.players.keys());
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) throw new Error('INVALID_PLAYER_COUNT');

  const roles = shuffle(getRolesDeckForCount(playerIds.length));

  const players = {};
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[i];
    const roleKey = roles[i];
    players[id] = {
      id,
      roleKey,
      alliance: computeAlliance(roleKey),
      vote: null,
      missionAction: null,
      roleAcked: false,
    };
  }

  const missionCfg = getMissionConfigForCount(playerIds.length);

  room.game = {
    phase: 'ROLE_REVEAL',
    leaderId: room.hostId,
    currentRoundIndex: 0,
    selectedTeam: [],
    manualWinner: null,
    assassinationTargetId: null,
    players,
    rounds: missionCfg.map((cfg, idx) => ({
      roundNumber: idx + 1,
      playersRequired: cfg.players,
      failsRequired: cfg.fails,
      status: idx === 0 ? 'CURRENT' : 'PENDING',
      selectedTeam: [],
      votes: {},
      missionResults: [],
    })),
  };
};

const allPlayers = (room) => Array.from(room.players.keys());

const tallyVotesAndAdvance = (room) => {
  const game = ensureGame(room);
  const ids = allPlayers(room);
  const approves = ids.filter((id) => game.players[id]?.vote === 'APPROVE').length;
  const rejects = ids.filter((id) => game.players[id]?.vote === 'REJECT').length;

  if (approves > rejects) {
    game.phase = 'MISSION_EXECUTION';
    for (const id of ids) game.players[id].missionAction = null;
  } else {
    game.phase = 'TEAM_SELECTION';
    const idx = ids.indexOf(game.leaderId);
    game.leaderId = ids[(idx + 1) % ids.length];
    game.selectedTeam = [];
    for (const id of ids) game.players[id].vote = null;
  }
};

const finalizeMissionAndAdvance = (room) => {
  const game = ensureGame(room);
  const round = game.rounds[game.currentRoundIndex];
  const team = [...game.selectedTeam];
  const actions = team.map((id) => game.players[id].missionAction);

  const failCount = actions.filter((a) => a === 'FAIL').length;
  const isSuccess = failCount < round.failsRequired;

  round.status = isSuccess ? 'SUCCESS' : 'FAIL';
  round.selectedTeam = team;
  round.missionResults = shuffle(actions);

  game.phase = 'MISSION_REVEAL';
};

const computeWins = (rounds) => ({
  successes: rounds.filter((r) => r.status === 'SUCCESS').length,
  fails: rounds.filter((r) => r.status === 'FAIL').length,
});

const nextRoundFromReveal = (room) => {
  const game = ensureGame(room);
  const { successes, fails } = computeWins(game.rounds);
  const ids = allPlayers(room);

  if (successes >= 3) {
    game.phase = 'ASSASSINATION';
    game.assassinationTargetId = null;
    return;
  }

  if (fails >= 3) {
    game.phase = 'GAME_OVER';
    game.manualWinner = 'EVIL';
    return;
  }

  if (game.currentRoundIndex >= game.rounds.length - 1) {
    game.phase = 'GAME_OVER';
    game.manualWinner = successes >= fails ? 'GOOD' : 'EVIL';
    return;
  }

  game.currentRoundIndex += 1;
  game.rounds = game.rounds.map((r, idx) => {
    if (idx === game.currentRoundIndex) return { ...r, status: 'CURRENT' };
    return r;
  });

  const leaderIdx = ids.indexOf(game.leaderId);
  game.leaderId = ids[(leaderIdx + 1) % ids.length];
  game.selectedTeam = [];
  for (const id of ids) {
    game.players[id].vote = null;
    game.players[id].missionAction = null;
  }
  game.phase = 'TEAM_SELECTION';
};

io.on('connection', (socket) => {
  socket.on('create_room', ({ name }) => {
    const code = generateRoomCode();
    const room = {
      code,
      hostId: socket.id,
      players: new Map(),
      game: null,
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: typeof name === 'string' && name.trim() ? name.trim() : '玩家',
      avatarIndex: 0,
    });

    rooms.set(code, room);
    socket.join(code);

    socket.emit('room_joined', getRoomPublicState(room));
    broadcastRoomUpdate(room);
  });

  socket.on('join_room', ({ roomCode, name }) => {
    try {
      const room = ensureRoom(roomCode);

      // Idempotent re-join: if this socket is already a member, just ensure it is in the socket.io room
      // and resend the current public state.
      if (room.players.has(socket.id)) {
        socket.join(room.code);
        socket.emit('room_joined', getRoomPublicState(room));
        broadcastRoomUpdate(room);
        broadcastGameUpdate(room);
        return;
      }

      if (room.players.size >= MAX_PLAYERS) {
        socket.emit('room_error', { code: 'ROOM_FULL' });
        return;
      }
      if (room.game) {
        socket.emit('room_error', { code: 'GAME_ALREADY_STARTED' });
        return;
      }

      room.players.set(socket.id, {
        id: socket.id,
        name: typeof name === 'string' && name.trim() ? name.trim() : '玩家',
        avatarIndex: room.players.size,
      });

      socket.join(room.code);
      socket.emit('room_joined', getRoomPublicState(room));
      broadcastRoomUpdate(room);
    } catch {
      socket.emit('room_error', { code: 'ROOM_NOT_FOUND' });
    }
  });

  socket.on('set_name', ({ roomCode, name }) => {
    try {
      const room = ensureRoom(roomCode);
      const player = room.players.get(socket.id);
      if (!player) return;
      const nextName = typeof name === 'string' ? name.trim() : '';
      if (!nextName) return;
      player.name = nextName;
      room.players.set(socket.id, player);
      broadcastRoomUpdate(room);
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('start_game', ({ roomCode }) => {
    try {
      const room = ensureRoom(roomCode);
      if (!isHost(room, socket.id)) return;
      if (room.players.size < MIN_PLAYERS) {
        socket.emit('room_error', { code: 'NOT_ENOUGH_PLAYERS' });
        return;
      }
      if (room.game) return;
      startGameForRoom(room);
      broadcastRoomUpdate(room);
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('get_game_state', ({ roomCode }) => {
    try {
      if (typeof roomCode !== 'string' || !roomCode) return;
      const room = ensureRoom(roomCode);
      if (!room.players.has(socket.id)) return;
      if (!room.game) return;
      socket.emit('game_state', getGamePublicState(room));
    } catch {
      // ignore
    }
  });

  socket.on('ack_role', ({ roomCode }) => {
    try {
      const room = ensureRoom(roomCode);
      const game = ensureGame(room);
      if (game.phase !== 'ROLE_REVEAL') return;
      if (!game.players[socket.id]) return;
      game.players[socket.id].roleAcked = true;
      const ids = allPlayers(room);
      const allAcked = ids.every((id) => game.players[id]?.roleAcked);
      if (allAcked) game.phase = 'TEAM_SELECTION';
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('select_team_toggle', ({ roomCode, playerId }) => {
    try {
      const room = ensureRoom(roomCode);
      const game = ensureGame(room);
      if (game.phase !== 'TEAM_SELECTION') return;
      if (socket.id !== game.leaderId) return;
      if (typeof playerId !== 'string') return;
      if (!room.players.has(playerId)) return;

      const round = game.rounds[game.currentRoundIndex];
      const required = round.playersRequired;
      const exists = game.selectedTeam.includes(playerId);
      if (exists) {
        game.selectedTeam = game.selectedTeam.filter((id) => id !== playerId);
      } else if (game.selectedTeam.length < required) {
        game.selectedTeam = [...game.selectedTeam, playerId];
      }
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('submit_team', ({ roomCode }) => {
    try {
      const room = ensureRoom(roomCode);
      const game = ensureGame(room);
      if (game.phase !== 'TEAM_SELECTION') return;
      if (socket.id !== game.leaderId) return;

      const round = game.rounds[game.currentRoundIndex];
      if (game.selectedTeam.length !== round.playersRequired) return;

      round.selectedTeam = [...game.selectedTeam];
      round.votes = {};
      game.phase = 'VOTING';
      for (const id of allPlayers(room)) game.players[id].vote = null;
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('vote', ({ roomCode, vote }) => {
    try {
      const room = ensureRoom(roomCode);
      const game = ensureGame(room);
      if (game.phase !== 'VOTING') return;
      if (!game.players[socket.id]) return;
      if (vote !== 'APPROVE' && vote !== 'REJECT') return;
      game.players[socket.id].vote = vote;

      const round = game.rounds[game.currentRoundIndex];
      round.votes = round.votes || {};
      round.votes[socket.id] = vote;

      const ids = allPlayers(room);
      const allVoted = ids.every((id) => game.players[id]?.vote);
      if (allVoted) tallyVotesAndAdvance(room);
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('mission_action', ({ roomCode, action }) => {
    try {
      const room = ensureRoom(roomCode);
      const game = ensureGame(room);
      if (game.phase !== 'MISSION_EXECUTION') return;
      if (!game.players[socket.id]) return;
      if (!game.selectedTeam.includes(socket.id)) return;
      if (action !== 'SUCCESS' && action !== 'FAIL') return;

      const isEvil = game.players[socket.id].alliance === 'EVIL';
      game.players[socket.id].missionAction = isEvil ? action : 'SUCCESS';

      const team = game.selectedTeam;
      const allActed = team.every((id) => game.players[id]?.missionAction);
      if (allActed && team.length > 0) finalizeMissionAndAdvance(room);
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('next_round', ({ roomCode }) => {
    try {
      const room = ensureRoom(roomCode);
      if (!isHost(room, socket.id)) return;
      const game = ensureGame(room);
      if (game.phase !== 'MISSION_REVEAL') return;
      nextRoundFromReveal(room);
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('manual_endgame', ({ roomCode, winner }) => {
    try {
      const room = ensureRoom(roomCode);
      if (!isHost(room, socket.id)) return;
      const game = ensureGame(room);
      if (winner !== 'GOOD' && winner !== 'EVIL') return;
      game.manualWinner = winner;
      game.phase = 'GAME_OVER';
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('assassinate', ({ roomCode, targetId }) => {
    try {
      const room = ensureRoom(roomCode);
      const game = ensureGame(room);
      if (game.phase !== 'ASSASSINATION') return;
      if (!game.players[socket.id]) return;
      if (game.players[socket.id].roleKey !== 'ASSASSIN') return;
      if (typeof targetId !== 'string' || !targetId) return;
      if (!game.players[targetId]) return;

      game.assassinationTargetId = targetId;

      const targetRole = game.players[targetId].roleKey;
      game.manualWinner = targetRole === 'MERLIN' ? 'EVIL' : 'GOOD';
      game.phase = 'GAME_OVER';
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('leave_room', ({ roomCode }) => {
    try {
      const room = ensureRoom(roomCode);
      room.players.delete(socket.id);
      socket.leave(room.code);

      if (room.players.size === 0) {
        rooms.delete(room.code);
        return;
      }

      if (room.hostId === socket.id) {
        room.hostId = room.players.keys().next().value;
      }

      // If a game is running and a player leaves, keep the state but remove player.
      if (room.game) {
        delete room.game.players[socket.id];
        if (room.game.leaderId === socket.id) {
          room.game.leaderId = room.hostId;
        }
      }

      broadcastRoomUpdate(room);
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      if (!room.players.has(socket.id)) continue;
      room.players.delete(socket.id);

      if (room.players.size === 0) {
        rooms.delete(room.code);
        break;
      }

      if (room.hostId === socket.id) {
        room.hostId = room.players.keys().next().value;
      }

      if (room.game) {
        delete room.game.players[socket.id];
        if (room.game.leaderId === socket.id) {
          room.game.leaderId = room.hostId;
        }
      }

      broadcastRoomUpdate(room);
      broadcastGameUpdate(room);
      break;
    }
  });
});

// 託管編譯後的靜態檔案 (Vite 預設輸出資料夾為 dist)
app.use(express.static(path.join(__dirname, 'dist')));

// 處理 SPA 路由：所有請求都回傳 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

httpServer.listen(port, () => {
  console.log(`王者圓桌伺服器已啟動，監聽端口：${port}`);
});
