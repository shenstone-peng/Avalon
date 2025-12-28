export enum ViewState {
  HOME = 'HOME',
  LOBBY = 'LOBBY',
  GAME = 'GAME',
  PROFILE = 'PROFILE',
  RULES = 'RULES'
}

export enum RoleType {
  MERLIN = 'Merlin',
  PERCIVAL = 'Percival',
  LOYAL_SERVANT = 'Loyal Servant',
  MORGANA = 'Morgana',
  ASSASSIN = 'Assassin',
  MORDRED = 'Mordred',
  OBERON = 'Oberon',
  MINION = 'Minion of Mordred'
}

export enum Alliance {
  GOOD = 'Good',
  EVIL = 'Evil'
}

export interface Role {
  type: RoleType;
  name: string;
  alliance: Alliance;
  description: string;
  isSpecial?: boolean;
}

export enum GamePhase {
  SETUP = 'SETUP',
  ROLE_REVEAL = 'ROLE_REVEAL',
  TEAM_SELECTION = 'TEAM_SELECTION',
  VOTING = 'VOTING',
  MISSION_EXECUTION = 'MISSION_EXECUTION',
  MISSION_REVEAL = 'MISSION_REVEAL',
  ASSASSINATION = 'ASSASSINATION',
  GAME_OVER = 'GAME_OVER'
}

export interface Player {
  id: string;
  name: string;
  role?: Role;
  isLeader: boolean;
  avatar: string;
  isBot: boolean;
  isHost?: boolean;
  vote?: 'APPROVE' | 'REJECT' | null;
  missionAction?: 'SUCCESS' | 'FAIL' | null;
}

export interface MissionRound {
  roundNumber: number;
  playersRequired: number;
  failsRequired: number;
  status: 'PENDING' | 'SUCCESS' | 'FAIL' | 'CURRENT';
  selectedTeam: string[]; // player IDs
  votes: Record<string, 'APPROVE' | 'REJECT'>;
  missionResults: ('SUCCESS' | 'FAIL')[];
}

export const ROLES_CONFIG: Record<string, Role> = {
  MERLIN: { type: RoleType.MERLIN, name: '梅林', alliance: Alliance.GOOD, description: '你知道誰是壞人，但必須隱藏身份。' },
  PERCIVAL: { type: RoleType.PERCIVAL, name: '派西維爾', alliance: Alliance.GOOD, description: '你知道誰是梅林（或莫甘娜），負責保護梅林。' },
  LOYAL_SERVANT: { type: RoleType.LOYAL_SERVANT, name: '亞瑟的忠臣', alliance: Alliance.GOOD, description: '忠誠的僕人，努力完成任務。' },
  MORGANA: { type: RoleType.MORGANA, name: '莫甘娜', alliance: Alliance.EVIL, description: '偽裝成梅林，迷惑派西維爾。' },
  ASSASSIN: { type: RoleType.ASSASSIN, name: '刺客', alliance: Alliance.EVIL, description: '如果好人陣營獲勝，你可以刺殺梅林來逆轉。' },
  MORDRED: { type: RoleType.MORDRED, name: '莫德雷德', alliance: Alliance.EVIL, description: '梅林看不到你的真實身份。' },
  OBERON: { type: RoleType.OBERON, name: '奧伯倫', alliance: Alliance.EVIL, description: '你看不到隊友，隊友也看不到你。' },
  MINION: { type: RoleType.MINION, name: '莫德雷德的爪牙', alliance: Alliance.EVIL, description: '協助邪惡陣營破壞任務。' },
};