import { GoogleGenAI } from "@google/genai";
import { Player, MissionRound } from "../types";

// Helper to get client safely
const getClient = () => {
    // Note: process.env.API_KEY is defined in vite.config.ts via define
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("Gemini API Key is missing.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

export const generateMissionStory = async (
    round: MissionRound,
    team: Player[],
    success: boolean
): Promise<string> => {
    const ai = getClient();
    if (!ai) return "傳說已在風中消逝... (API Key Missing)";

    const teamNames = team.map(p => p.name).join(", ");
    const resultText = success ? "任務成功" : "任務失敗";
    const failCount = round.missionResults.filter(r => r === 'FAIL').length;
    
    // Using gemini-3-flash-preview as recommended for basic text tasks
    const modelId = "gemini-3-flash-preview"; 

    const prompt = `
    你是一位中世紀奇幻風格的說書人（Game Master）。
    請用**繁體中文**，以充滿史詩感、戲劇性和神秘感的語氣，為剛發生的《阿瓦隆》遊戲任務撰寫一段簡短的劇情描述（約 50-80 字）。
    
    情境：
    - 執行任務的騎士：${teamNames}
    - 任務結果：${resultText}
    - 失敗票數：${failCount} 張
    
    如果是成功，描述騎士們如何克服困難。
    如果是失敗，描述隊伍中隱藏的背叛者如何暗中破壞，導致行動功虧一簣，但不要指名道姓說是誰（保持懸念）。
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
        });
        return response.text || "吟遊詩人沈默不語...";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "戰報傳遞過程中遺失了...";
    }
};

export const generateEndGameAnalysis = async (
    winnerAlliance: string,
    players: Player[],
    missionHistory: MissionRound[]
): Promise<string> => {
    const ai = getClient();
    if (!ai) return "歷史的真相已不可考。";

    const modelId = "gemini-3-flash-preview";
    
    const playerRoles = players.map(p => `${p.name}(${p.role?.name})`).join(", ");
    
    const prompt = `
    請以《阿瓦隆》遊戲解說員的身份，為這局遊戲做一個簡短精彩的總結點評（繁體中文，約 100 字）。
    獲勝方：${winnerAlliance}
    玩家身份配置：${playerRoles}
    
    請評論這場陣營對抗的精彩之處，或者是正義的勝利，或者是邪惡的狡詐。
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
        });
        return response.text || "命運的輪盤停止了轉動。";
    } catch (error) {
        return "終局的鐘聲已響起。";
    }
};