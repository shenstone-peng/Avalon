import { Player, MissionRound } from "../types";

export const generateMissionStory = async (
    round: MissionRound,
    team: Player[],
    success: boolean
): Promise<string> => {
    const teamNames = team.map((p) => p.name).join(', ');
    const failCount = round.missionResults.filter((r) => r === 'FAIL').length;
    if (success) {
        return `戰報：${teamNames} 眾志成城，跨越艱險，任務終告成功。`;
    }
    return `戰報：${teamNames} 暗流湧動，背叛在陰影中蔓延（失敗票數：${failCount}）。`;
};

export const generateEndGameAnalysis = async (
    winnerAlliance: string,
    players: Player[],
    missionHistory: MissionRound[]
): Promise<string> => {
    const total = missionHistory.length || 0;
    const successCount = missionHistory.filter((r) => r.status === 'SUCCESS').length;
    const failCount = missionHistory.filter((r) => r.status === 'FAIL').length;
    const playerNames = players.map((p) => p.name).join(', ');
    return `終局總結：${winnerAlliance} 取得勝利（任務成功 ${successCount}/${total}、失敗 ${failCount}）。參戰者：${playerNames}。`;
};