import { Player, MissionRound } from "../types";

export const generateMissionStory = async (
    round: MissionRound,
    team: Player[],
    success: boolean
): Promise<string> => {
    const teamNames = team.map((p) => p.name).join(', ');
    const failCount = round.missionResults.filter((r) => r === 'FAIL').length;
    if (success) {
        return `战报：${teamNames} 众志成城，跨越艰险，任务终告成功。`;
    }
    return `战报：${teamNames} 暗流涌动，背叛在阴影中蔓延（失败票数：${failCount}）。`;
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
    return `终局总结：${winnerAlliance} 取得胜利（任务成功 ${successCount}/${total}、失败 ${failCount}）。参战者：${playerNames}。`;
};