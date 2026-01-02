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
  LADY_OF_THE_LAKE = 'LADY_OF_THE_LAKE',
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
  MERLIN: { type: RoleType.MERLIN, name: '梅林', alliance: Alliance.GOOD, description: '你知道谁是坏人，但必须隐藏身份。' },
  PERCIVAL: { type: RoleType.PERCIVAL, name: '派西维尔', alliance: Alliance.GOOD, description: '你知道谁是梅林（或莫甘娜），负责保护梅林。' },
  LOYAL_SERVANT: { type: RoleType.LOYAL_SERVANT, name: '亚瑟的忠臣', alliance: Alliance.GOOD, description: '忠诚的仆人，努力完成任务。' },
  MORGANA: { type: RoleType.MORGANA, name: '莫甘娜', alliance: Alliance.EVIL, description: '伪装成梅林，迷惑派西维尔。' },
  ASSASSIN: { type: RoleType.ASSASSIN, name: '刺客', alliance: Alliance.EVIL, description: '如果好人阵营获胜，你可以刺杀梅林来逆转。' },
  MORDRED: { type: RoleType.MORDRED, name: '莫德雷德', alliance: Alliance.EVIL, description: '梅林看不到你的真实身份。' },
  OBERON: { type: RoleType.OBERON, name: '奥伯伦', alliance: Alliance.EVIL, description: '你看不到队友，队友也看不到你。' },
  MINION: { type: RoleType.MINION, name: '莫德雷德的爪牙', alliance: Alliance.EVIL, description: '协助邪恶阵营破坏任务。' },
};