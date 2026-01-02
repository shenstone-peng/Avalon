
import 'dotenv/config';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

import { User } from './models/User.js';
import { Match } from './models/Match.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Azure App Service 會透過環境變數注入 PORT
const port = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing required env var JWT_SECRET in production');
  }
  // Dev fallback only.
  return 'dev-only-jwt-secret-change-me';
};

const signToken = (user) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ sub: user._id.toString(), name: user.name }, secret, { expiresIn });
};

const requireHttpAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [kind, token] = header.split(' ');
    if (kind !== 'Bearer' || !token) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    const payload = jwt.verify(token, getJwtSecret());
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
};

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
});

mongoose.set('bufferCommands', false);

const isDbReady = () => mongoose.connection.readyState === 1;

const ensureDbReady = (res) => {
  if (isDbReady()) return true;
  res.status(503).json({ ok: false, message: 'Database not ready' });
  return false;
};

// Require JWT for all socket connections (login required before entering rooms)
io.use((socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('UNAUTHORIZED'));
    }
    const payload = jwt.verify(token, getJwtSecret());
    socket.user = payload;
    socket.data.userId = payload?.sub?.toString?.() || payload?.sub;
    socket.data.userName = payload?.name;
    return next();
  } catch {
    return next(new Error('UNAUTHORIZED'));
  }
});

const getUserId = (socket) => {
  const userId = socket?.data?.userId;
  return typeof userId === 'string' && userId.trim() ? userId : null;
};

const migrateGameSocketId = (game, oldId, newId) => {
  if (!game || !oldId || !newId || oldId === newId) return;
  if (game.players?.[oldId]) {
    game.players[newId] = { ...game.players[oldId], id: newId };
    delete game.players[oldId];
  }
  if (game.leaderId === oldId) game.leaderId = newId;
  if (game.assassinationTargetId === oldId) game.assassinationTargetId = newId;

  if (game.ladyOfLakeHolderId === oldId) game.ladyOfLakeHolderId = newId;
  if (game.ladyOfLakeTargetId === oldId) game.ladyOfLakeTargetId = newId;
  if (Array.isArray(game.ladyOfLakeHistory)) {
    game.ladyOfLakeHistory = game.ladyOfLakeHistory.map((id) => (id === oldId ? newId : id));
  }

  if (Array.isArray(game.selectedTeam)) {
    game.selectedTeam = game.selectedTeam.map((id) => (id === oldId ? newId : id));
  }

  if (Array.isArray(game.rounds)) {
    for (const round of game.rounds) {
      if (Array.isArray(round.selectedTeam)) {
        round.selectedTeam = round.selectedTeam.map((id) => (id === oldId ? newId : id));
      }
      if (round.votes && typeof round.votes === 'object' && round.votes[oldId]) {
        round.votes[newId] = round.votes[oldId];
        delete round.votes[oldId];
      }
    }
  }
};

// --- Auth APIs (Mongo/Cosmos via Mongoose) ---
app.post('/api/register', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name || name.length > 20) {
      return res.status(400).json({ ok: false, message: 'Invalid name' });
    }
    if (!password || password.length < 6 || password.length > 200) {
      return res.status(400).json({ ok: false, message: 'Invalid password' });
    }

    const existing = await User.findOne({ name }).lean();
    if (existing) {
      return res.status(409).json({ ok: false, message: 'User already exists' });
    }

    const user = await User.create({ name, password });
    const token = signToken(user);
    return res.status(201).json({ ok: true, message: 'Registered', token, user: { name: user.name } });
  } catch (err) {
    // Duplicate key (race condition)
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
      return res.status(409).json({ ok: false, message: 'User already exists' });
    }
    console.error('POST /api/register failed:', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name || !password) {
      return res.status(400).json({ ok: false, message: 'Missing credentials' });
    }

    const user = await User.findOne({ name });
    if (!user) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    }

    const ok = await user.verifyPassword(password);
    if (!ok) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    }

    const token = signToken(user);
    return res.json({ ok: true, message: 'Logged in', token, user: { name: user.name } });
  } catch (err) {
    console.error('POST /api/login failed:', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// --- Profile / Stats ---
app.get('/api/profile', requireHttpAuth, async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;
    const userId = req.user?.sub?.toString?.() || req.user?.sub;
    if (!userId) return res.status(401).json({ ok: false, message: 'Unauthorized' });

    const matches = await Match.find({ 'players.userId': userId })
      .sort({ endedAt: -1 })
      .limit(20)
      .lean();

    const total = matches.length;
    let wins = 0;
    let losses = 0;
    let goodGames = 0;
    let goodWins = 0;
    let evilGames = 0;
    let evilWins = 0;

    const roleAgg = new Map();

    const recent = matches.map((m) => {
      const me = (m.players || []).find((p) => p.userId === userId);
      if (me?.won) wins += 1;
      else losses += 1;

      if (me?.alliance === 'GOOD') {
        goodGames += 1;
        if (me.won) goodWins += 1;
      }
      if (me?.alliance === 'EVIL') {
        evilGames += 1;
        if (me.won) evilWins += 1;
      }

      if (me?.roleKey) {
        const r = roleAgg.get(me.roleKey) || { roleKey: me.roleKey, games: 0, wins: 0 };
        r.games += 1;
        if (me.won) r.wins += 1;
        roleAgg.set(me.roleKey, r);
      }

      return {
        endedAt: m.endedAt,
        winner: m.winner,
        roomCode: m.roomCode,
        playerCount: m.playerCount,
        me: me
          ? {
              roleKey: me.roleKey,
              alliance: me.alliance,
              won: me.won,
              name: me.name,
            }
          : null,
      };
    });

    const roles = Array.from(roleAgg.values())
      .map((r) => ({
        roleKey: r.roleKey,
        games: r.games,
        wins: r.wins,
        winRate: r.games ? Math.round((r.wins / r.games) * 100) : 0,
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 10);

    return res.json({
      ok: true,
      user: {
        id: userId,
        name: req.user?.name || null,
      },
      stats: {
        total,
        wins,
        losses,
        winRate: total ? Math.round((wins / total) * 100) : 0,
        good: {
          games: goodGames,
          wins: goodWins,
          winRate: goodGames ? Math.round((goodWins / goodGames) * 100) : 0,
        },
        evil: {
          games: evilGames,
          wins: evilWins,
          winRate: evilGames ? Math.round((evilWins / evilGames) * 100) : 0,
        },
        roles,
      },
      recent,
    });
  } catch (err) {
    console.error('GET /api/profile failed:', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    dbReady: isDbReady(),
    nodeEnv: process.env.NODE_ENV || 'unknown',
  });
});

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 10;
const MAX_PROPOSAL_ATTEMPTS = 5;

// Grace periods to reduce "room disappeared" issues caused by transient disconnects.
// - When a socket disconnects, we keep its seat for a short time to allow quick reconnect.
// - When a room becomes empty, keep it for a while before deleting (useful on flaky mobile networks).
const DISCONNECT_GRACE_MS = Number.parseInt(process.env.DISCONNECT_GRACE_MS || '15000', 10);
const EMPTY_ROOM_TTL_MS = Number.parseInt(process.env.EMPTY_ROOM_TTL_MS || '300000', 10);

const pendingDisconnectCleanup = new Map();
const pendingRoomCleanup = new Map();

const clearDisconnectCleanup = (socketId) => {
  const t = pendingDisconnectCleanup.get(socketId);
  if (t) clearTimeout(t);
  pendingDisconnectCleanup.delete(socketId);
};

const clearRoomCleanup = (roomCode) => {
  const t = pendingRoomCleanup.get(roomCode);
  if (t) clearTimeout(t);
  pendingRoomCleanup.delete(roomCode);
};

const scheduleRoomCleanupIfEmpty = (room) => {
  if (!room || room.players.size !== 0) return;
  if (pendingRoomCleanup.has(room.code)) return;
  const timer = setTimeout(() => {
    const current = rooms.get(room.code);
    if (current && current.players.size === 0) {
      rooms.delete(room.code);
    }
    pendingRoomCleanup.delete(room.code);
  }, EMPTY_ROOM_TTL_MS);
  pendingRoomCleanup.set(room.code, timer);
};

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
    inGame: Boolean(room.game && room.game.phase !== 'GAME_OVER'),
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
    proposalAttempt: game.proposalAttempt ?? 1,
    players,
    leaderId: game.leaderId,
    leaderIndex: players.findIndex((p) => p.id === game.leaderId),
    currentRoundIndex: game.currentRoundIndex,
    rounds: game.rounds,
    selectedTeam: game.selectedTeam,
    manualWinner: game.manualWinner,
    assassinationTargetId: game.assassinationTargetId ?? null,
    ladyOfLakeHolderId: game.ladyOfLakeHolderId ?? null,
    ladyOfLakeHistory: Array.isArray(game.ladyOfLakeHistory) ? game.ladyOfLakeHistory : [],
    ladyOfLakeTargetId: game.ladyOfLakeTargetId ?? null,
    ladyOfLakeResult: game.ladyOfLakeResult ?? null,
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

const removePlayerFromRoom = (room, socketId) => {
  if (!room.players.has(socketId)) return;
  room.players.delete(socketId);

  if (room.players.size === 0) {
    scheduleRoomCleanupIfEmpty(room);
    return;
  }

  if (room.hostId === socketId) {
    room.hostId = room.players.keys().next().value;
  }

  // If a game is running and a player leaves, keep the state but remove player.
  if (room.game) {
    delete room.game.players[socketId];
    if (room.game.leaderId === socketId) {
      room.game.leaderId = room.hostId;
    }
  }
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

const recordMatchIfNeeded = async (room, reason = null) => {
  const game = room?.game;
  if (!room || !game) return;
  if (game.matchRecorded) return;
  if (game.phase !== 'GAME_OVER') return;
  if (game.manualWinner !== 'GOOD' && game.manualWinner !== 'EVIL') return;

  const endedAt = new Date();
  const startedAt = game.startedAt ? new Date(game.startedAt) : endedAt;

  const players = [];
  for (const socketId of Object.keys(game.players || {})) {
    const gp = game.players[socketId];
    if (!gp) continue;
    const userId = gp.userId || room.players.get(socketId)?.userId || null;
    if (!userId) continue;
    const name = room.players.get(socketId)?.name || gp.name || '玩家';
    const alliance = gp.alliance;
    const won = alliance === game.manualWinner;
    players.push({ userId, name, roleKey: gp.roleKey, alliance, won });
  }

  if (players.length === 0) return;

  game.matchRecorded = true;
  try {
    await Match.create({
      roomCode: room.code,
      startedAt,
      endedAt,
      winner: game.manualWinner,
      reason,
      playerCount: players.length,
      players,
    });
  } catch (e) {
    console.error('Failed to record match:', e);
    // Allow retry on next broadcast if needed
    game.matchRecorded = false;
  }
};

const setGameOver = (room, winner, reason = null) => {
  const game = ensureGame(room);
  game.phase = 'GAME_OVER';
  game.manualWinner = winner;
  // Fire and forget (do not block game loop)
  recordMatchIfNeeded(room, reason);
};

const startGameForRoom = (room) => {
  const playerIds = Array.from(room.players.keys());
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) throw new Error('INVALID_PLAYER_COUNT');

  const roles = shuffle(getRolesDeckForCount(playerIds.length));

  const players = {};
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[i];
    const roleKey = roles[i];
    const userId = room.players.get(id)?.userId || null;
    players[id] = {
      id,
      userId,
      roleKey,
      alliance: computeAlliance(roleKey),
      vote: null,
      missionAction: null,
      roleAcked: false,
    };
  }

  const missionCfg = getMissionConfigForCount(playerIds.length);

  room.game = {
    startedAt: new Date().toISOString(),
    matchRecorded: false,
    phase: 'ROLE_REVEAL',
    leaderId: room.hostId,
    currentRoundIndex: 0,
    selectedTeam: [],
    proposalAttempt: 1,
    manualWinner: null,
    assassinationTargetId: null,
    ladyOfLakeHolderId: null,
    ladyOfLakeHistory: [],
    ladyOfLakeTargetId: null,
    ladyOfLakeResult: null,
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

  // Lady of the Lake: initial holder is the player before the first leader (host).
  const ids = Array.from(room.players.keys());
  const leaderIdx = ids.indexOf(room.hostId);
  const initialIdx = (leaderIdx - 1 + ids.length) % ids.length;
  const initialHolderId = ids[initialIdx];
  room.game.ladyOfLakeHolderId = initialHolderId;
  room.game.ladyOfLakeHistory = [initialHolderId];
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
    // Proposal rejected. Rule: if the 5th proposal is also rejected,
    // EVIL wins the whole game immediately.
    if ((game.proposalAttempt ?? 1) >= MAX_PROPOSAL_ATTEMPTS) {
      setGameOver(room, 'EVIL', 'FIFTH_PROPOSAL_REJECTED');
      return;
    }

    game.proposalAttempt = (game.proposalAttempt ?? 1) + 1;
    game.phase = 'TEAM_SELECTION';
    const idx = ids.indexOf(game.leaderId);
    game.leaderId = ids[(idx + 1) % ids.length];
    game.selectedTeam = [];
    for (const id of ids) game.players[id].vote = null;
  }
};

const applyForcedApprovalsIfNeeded = (room) => {
  const game = ensureGame(room);
  if (game.phase !== 'VOTING') return;
  if ((game.proposalAttempt ?? 1) !== MAX_PROPOSAL_ATTEMPTS) return;

  const round = game.rounds[game.currentRoundIndex];
  round.votes = round.votes || {};

  for (const id of allPlayers(room)) {
    const gp = game.players[id];
    if (!gp) continue;
    if (gp.alliance === 'GOOD') {
      gp.vote = 'APPROVE';
      round.votes[id] = 'APPROVE';
    }
  }
};

const LADY_OF_THE_LAKE_ROUND_INDEXES = [1, 2, 3];
const AUTO_LADY_OF_THE_LAKE_DELAY_MS = 2200;

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

  // Auto-enter Lady of the Lake after mission results are revealed (rounds 2/3/4), if game is not ended.
  if (game._autoLadyTimeout) {
    try {
      clearTimeout(game._autoLadyTimeout);
    } catch {
      // ignore
    }
    game._autoLadyTimeout = null;
  }

  const { successes, fails } = computeWins(game.rounds);
  const shouldEnd = successes >= 3 || fails >= 3;
  const shouldLady = !shouldEnd && LADY_OF_THE_LAKE_ROUND_INDEXES.includes(game.currentRoundIndex);

  if (shouldLady) {
    const roomCode = room.code;
    const roundIndex = game.currentRoundIndex;
    game._autoLadyTimeout = setTimeout(() => {
      try {
        const latestRoom = ensureRoom(roomCode);
        const latestGame = ensureGame(latestRoom);

        // Only transition if we are still showing this round's reveal.
        if (latestGame.phase !== 'MISSION_REVEAL') return;
        if (latestGame.currentRoundIndex !== roundIndex) return;

        const latestWins = computeWins(latestGame.rounds);
        if (latestWins.successes >= 3) return;
        if (latestWins.fails >= 3) return;

        latestGame.phase = 'LADY_OF_THE_LAKE';
        latestGame.ladyOfLakeTargetId = null;
        latestGame.ladyOfLakeResult = null;

        broadcastGameUpdate(latestRoom);
      } catch {
        // ignore
      }
    }, AUTO_LADY_OF_THE_LAKE_DELAY_MS);
  }
};

const computeWins = (rounds) => ({
  successes: rounds.filter((r) => r.status === 'SUCCESS').length,
  fails: rounds.filter((r) => r.status === 'FAIL').length,
});

const nextRoundFromReveal = (room, { skipLadyOfLake = false } = {}) => {
  const game = ensureGame(room);
  const { successes, fails } = computeWins(game.rounds);
  const ids = allPlayers(room);

  if (successes >= 3) {
    game.phase = 'ASSASSINATION';
    game.assassinationTargetId = null;
    return;
  }

  if (fails >= 3) {
    setGameOver(room, 'EVIL', 'THREE_MISSIONS_FAILED');
    return;
  }

  // Lady of the Lake triggers after missions 2, 3, 4 (round indexes 1,2,3) are revealed.
  if (!skipLadyOfLake && LADY_OF_THE_LAKE_ROUND_INDEXES.includes(game.currentRoundIndex)) {
    game.phase = 'LADY_OF_THE_LAKE';
    game.ladyOfLakeTargetId = null;
    game.ladyOfLakeResult = null;
    return;
  }

  if (game.currentRoundIndex >= game.rounds.length - 1) {
    setGameOver(room, successes >= fails ? 'GOOD' : 'EVIL', 'ROUNDS_COMPLETE');
    return;
  }

  game.currentRoundIndex += 1;
  game.proposalAttempt = 1;
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
    const userId = getUserId(socket);
    if (!userId) {
      socket.emit('room_error', { code: 'ROOM_NOT_FOUND' });
      return;
    }
    const authedName = typeof socket.data?.userName === 'string' ? socket.data.userName.trim() : '';
    const room = {
      code,
      hostId: socket.id,
      players: new Map(),
      game: null,
    };

    room.players.set(socket.id, {
      id: socket.id,
      userId,
      name: authedName || (typeof name === 'string' && name.trim() ? name.trim() : '玩家'),
      avatarIndex: 0,
    });

    rooms.set(code, room);
    clearRoomCleanup(code);
    socket.join(code);

    socket.emit('room_joined', getRoomPublicState(room));
    broadcastRoomUpdate(room);
  });

  socket.on('join_room', ({ roomCode, name }) => {
    try {
      const room = ensureRoom(roomCode);
      clearRoomCleanup(room.code);
      const userId = getUserId(socket);
      if (!userId) {
        socket.emit('room_error', { code: 'ROOM_NOT_FOUND' });
        return;
      }

      const authedName = typeof socket.data?.userName === 'string' ? socket.data.userName.trim() : '';

      // If this logged-in user is already in the room under a different socket,
      // migrate their player + game state to this new socket to avoid "new identity" duplicates.
      let existingSocketId = null;
      let existingPlayer = null;
      for (const [sid, p] of room.players.entries()) {
        if (p?.userId === userId) {
          existingSocketId = sid;
          existingPlayer = p;
          break;
        }
      }

      if (existingSocketId && existingPlayer && existingSocketId !== socket.id) {
        clearDisconnectCleanup(existingSocketId);
        // Disconnect old socket to enforce single active session per user per room.
        try {
          const oldSocket = io.sockets.sockets.get(existingSocketId);
          oldSocket?.disconnect(true);
        } catch {
          // ignore
        }

        room.players.delete(existingSocketId);
        room.players.set(socket.id, {
          ...existingPlayer,
          id: socket.id,
          userId,
          name: authedName || (typeof name === 'string' && name.trim() ? name.trim() : existingPlayer.name),
        });

        if (room.hostId === existingSocketId) room.hostId = socket.id;
        if (room.game) migrateGameSocketId(room.game, existingSocketId, socket.id);

        socket.join(room.code);
        socket.emit('room_joined', getRoomPublicState(room));
        broadcastRoomUpdate(room);
        broadcastGameUpdate(room);
        return;
      }

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
      if (room.game && room.game.phase !== 'GAME_OVER') {
        socket.emit('room_error', { code: 'GAME_ALREADY_STARTED' });
        return;
      }

      room.players.set(socket.id, {
        id: socket.id,
        userId,
        name: authedName || (typeof name === 'string' && name.trim() ? name.trim() : '玩家'),
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
      if (room.game && room.game.phase !== 'GAME_OVER') return;
      startGameForRoom(room);
      broadcastRoomUpdate(room);
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('restart_game', ({ roomCode }) => {
    try {
      const room = ensureRoom(roomCode);
      if (!isHost(room, socket.id)) return;
      if (room.players.size < MIN_PLAYERS) {
        socket.emit('room_error', { code: 'NOT_ENOUGH_PLAYERS' });
        return;
      }
      if (!room.game) return;
      if (room.game.phase !== 'GAME_OVER') return;

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

      // Forced proposal rule: on the 5th proposal attempt, GOOD must approve.
      applyForcedApprovalsIfNeeded(room);
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
      const gp = game.players[socket.id];
      const isForced = (game.proposalAttempt ?? 1) === MAX_PROPOSAL_ATTEMPTS;
      const effectiveVote = isForced && gp.alliance === 'GOOD' ? 'APPROVE' : vote;
      gp.vote = effectiveVote;

      const round = game.rounds[game.currentRoundIndex];
      round.votes = round.votes || {};
      round.votes[socket.id] = effectiveVote;

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

  socket.on('lady_of_the_lake_target', ({ roomCode, targetId }) => {
    try {
      const room = ensureRoom(roomCode);
      const game = ensureGame(room);
      if (game.phase !== 'LADY_OF_THE_LAKE') return;
      if (game.ladyOfLakeHolderId !== socket.id) return;
      if (typeof targetId !== 'string' || !targetId) return;
      if (!game.players?.[targetId]) return;
      if (targetId === game.ladyOfLakeHolderId) return;

      const history = Array.isArray(game.ladyOfLakeHistory) ? game.ladyOfLakeHistory : [];
      if (history.includes(targetId)) return;
      if (game.ladyOfLakeTargetId) return;

      game.ladyOfLakeTargetId = targetId;
      game.ladyOfLakeResult = game.players[targetId]?.alliance ?? null;

      broadcastGameUpdate(room);

      const delayMs = 1200;
      if (game._ladyTimeout) {
        try {
          clearTimeout(game._ladyTimeout);
        } catch {
          // ignore
        }
      }

      game._ladyTimeout = setTimeout(() => {
        try {
          const latestRoom = ensureRoom(roomCode);
          const latestGame = ensureGame(latestRoom);
          if (latestGame.phase !== 'LADY_OF_THE_LAKE') return;
          if (latestGame.ladyOfLakeTargetId !== targetId) return;

          latestGame.ladyOfLakeHolderId = targetId;
          latestGame.ladyOfLakeHistory = Array.isArray(latestGame.ladyOfLakeHistory)
            ? [...latestGame.ladyOfLakeHistory, targetId]
            : [targetId];
          latestGame.ladyOfLakeTargetId = null;
          latestGame.ladyOfLakeResult = null;

          nextRoundFromReveal(latestRoom, { skipLadyOfLake: true });
          broadcastGameUpdate(latestRoom);
        } catch {
          // ignore
        }
      }, delayMs);
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
      setGameOver(room, winner, 'MANUAL');
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
      setGameOver(room, targetRole === 'MERLIN' ? 'EVIL' : 'GOOD', 'ASSASSINATION');
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('leave_room', ({ roomCode }) => {
    try {
      const room = ensureRoom(roomCode);
      clearDisconnectCleanup(socket.id);
      removePlayerFromRoom(room, socket.id);
      socket.leave(room.code);
      broadcastRoomUpdate(room);
      broadcastGameUpdate(room);
    } catch {
      // ignore
    }
  });

  socket.on('disconnect', () => {
    // Do not immediately remove seat on disconnect; allow quick reconnect.
    clearDisconnectCleanup(socket.id);
    const timer = setTimeout(() => {
      pendingDisconnectCleanup.delete(socket.id);
      for (const room of rooms.values()) {
        if (!room.players.has(socket.id)) continue;
        removePlayerFromRoom(room, socket.id);
        broadcastRoomUpdate(room);
        broadcastGameUpdate(room);
        break;
      }
    }, DISCONNECT_GRACE_MS);
    pendingDisconnectCleanup.set(socket.id, timer);
  });
});

// --- Mongo connection ---
const connectToDatabase = async () => {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error('Missing required env var DATABASE_URL');
  }

  mongoose.connection.on('error', (e) => {
    console.error('Mongo connection error:', e);
  });

  // Cosmos DB for MongoDB requires TLS; typically encoded in the URI.
  // We keep options conservative and let the URI drive TLS behavior.
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  console.log('Mongo connected');
};

// 託管編譯後的靜態檔案 (Vite 預設輸出資料夾為 dist)
app.use(express.static(path.join(__dirname, 'dist')));

// 處理 SPA 路由：所有請求都回傳 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const start = async () => {
  httpServer.listen(port, () => {
    console.log(`王者圓桌伺服器已啟動，監聽端口：${port}`);
  });

  // Connect to DB in background with retry.
  let attempt = 0;
  const loop = async () => {
    attempt += 1;
    try {
      if (!isDbReady()) await connectToDatabase();
    } catch (e) {
      console.error(`Mongo connect attempt ${attempt} failed:`, e);
      const delayMs = Math.min(60000, 1000 * Math.pow(2, Math.min(attempt, 6)));
      setTimeout(loop, delayMs);
      return;
    }
  };
  loop();
};

start().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
