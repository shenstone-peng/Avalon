import React, { useState } from 'react';
import { ViewState } from '../types';
import { ArrowLeft, Users, Shield, Skull, Eye, Zap, BookOpen } from 'lucide-react';

interface Props {
  onNavigate: (view: ViewState) => void;
}

export const RulesView: React.FC<Props> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'lore'>('config');

  return (
    <div className="h-full flex flex-col bg-slate-950 pb-20">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 bg-slate-900 sticky top-0 z-20 border-b border-slate-800 shadow-md">
        <button onClick={() => onNavigate(ViewState.HOME)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-cinzel font-bold text-xl text-amber-500 flex items-center gap-2">
            <BookOpen size={20} />
            <span>遊戲聖典</span>
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/50">
          <button 
            className={`flex-1 py-4 text-sm font-bold tracking-widest transition-colors relative ${activeTab === 'config' ? 'text-amber-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveTab('config')}
          >
            人數配置
            {activeTab === 'config' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500"></div>}
          </button>
          <button 
            className={`flex-1 py-4 text-sm font-bold tracking-widest transition-colors relative ${activeTab === 'lore' ? 'text-amber-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveTab('lore')}
          >
            角色圖鑑
            {activeTab === 'lore' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500"></div>}
          </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        
        {/* CONFIG TAB */}
        {activeTab === 'config' && (
            <div className="space-y-6 animate-[fadeIn_0.3s]">
                <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700">
                    <h3 className="font-cinzel text-lg text-slate-200 mb-4 flex items-center gap-2">
                        <Users size={20} className="text-blue-400" /> 
                        陣營分配表
                    </h3>
                    <div className="overflow-hidden rounded-lg border border-slate-600">
                        <table className="w-full text-center text-sm">
                            <thead>
                                <tr className="bg-slate-700 text-slate-200">
                                    <th className="py-3 px-2 font-bold">總人數</th>
                                    <th className="py-3 px-2 font-bold text-blue-400">正義陣營</th>
                                    <th className="py-3 px-2 font-bold text-red-400">邪惡陣營</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700 bg-slate-800">
                                <tr>
                                    <td className="py-3 font-mono text-slate-300">5 人</td>
                                    <td className="py-3 text-blue-300">3</td>
                                    <td className="py-3 text-red-300">2</td>
                                </tr>
                                <tr>
                                    <td className="py-3 font-mono text-slate-300">6 人</td>
                                    <td className="py-3 text-blue-300">4</td>
                                    <td className="py-3 text-red-300">2</td>
                                </tr>
                                <tr>
                                    <td className="py-3 font-mono text-slate-300">7 人</td>
                                    <td className="py-3 text-blue-300">4</td>
                                    <td className="py-3 text-red-300">3</td>
                                </tr>
                                <tr>
                                    <td className="py-3 font-mono text-slate-300">8 人</td>
                                    <td className="py-3 text-blue-300">5</td>
                                    <td className="py-3 text-red-300">3</td>
                                </tr>
                                <tr>
                                    <td className="py-3 font-mono text-slate-300">9 人</td>
                                    <td className="py-3 text-blue-300">6</td>
                                    <td className="py-3 text-red-300">3</td>
                                </tr>
                                <tr>
                                    <td className="py-3 font-mono text-slate-300">10 人</td>
                                    <td className="py-3 text-blue-300">6</td>
                                    <td className="py-3 text-red-300">4</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700">
                    <h3 className="font-cinzel text-lg text-slate-200 mb-4 flex items-center gap-2">
                        <Zap size={20} className="text-amber-400" />
                        建議角色配置
                    </h3>
                    <ul className="space-y-4 text-sm text-slate-300">
                        <li className="flex gap-3">
                            <span className="font-bold text-white whitespace-nowrap">基礎場 (5-6人)：</span>
                            <span className="text-slate-400">梅林、派西維爾、刺客、莫甘娜。其餘為忠臣與爪牙。</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="font-bold text-white whitespace-nowrap">進階場 (7-8人)：</span>
                            <span className="text-slate-400">加入莫德雷德（梅林看不到的壞人）增加正義方難度，或加入奧伯倫（不知道隊友的壞人）平衡局勢。</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="font-bold text-white whitespace-nowrap">大亂鬥 (9-10人)：</span>
                            <span className="text-slate-400">所有特殊角色登場，考驗極致的邏輯與演技。</span>
                        </li>
                    </ul>
                </div>
            </div>
        )}

        {/* LORE TAB */}
        {activeTab === 'lore' && (
            <div className="space-y-8 animate-[fadeIn_0.3s]">
                
                {/* Good Faction */}
                <div>
                    <h3 className="font-cinzel text-xl text-blue-400 mb-4 flex items-center gap-2 border-b border-blue-900/50 pb-2">
                        <Shield size={24} /> 正義陣營 (Arthur's Loyalists)
                    </h3>
                    <div className="space-y-4">
                        <LoreCard 
                            name="梅林 (Merlin)" 
                            title="偉大的預言家"
                            icon={<Eye size={24} className="text-blue-300" />}
                            isGood={true}
                            description="亞瑟王的導師，擁有洞察人心的魔法。在遊戲開始時，他能看到所有的壞人（除了莫德雷德）。但他的知識是個詛咒，因為如果他暴露身份，刺客將會在最後刺殺他，導致好人全盤皆輸。"
                        />
                        <LoreCard 
                            name="派西維爾 (Percival)" 
                            title="圓桌騎士"
                            icon={<Shield size={24} className="text-blue-300" />}
                            isGood={true}
                            description="忠誠而睿智的騎士，在尋找聖杯的途中獲得了啟示。遊戲開始時，他能看到「兩位梅林候選人」（真正的梅林與偽裝的莫甘娜），但不知道誰是誰。他的職責是保護梅林，並引導好人走向勝利。"
                        />
                        <LoreCard 
                            name="亞瑟的忠臣 (Loyal Servant)" 
                            title="王國守護者"
                            icon={<Users size={24} className="text-blue-300" />}
                            isGood={true}
                            description="雖然沒有特殊能力，但他們擁有一顆赤誠之心。他們不知道誰是隊友，只能透過邏輯推理、觀察投票和發言來分辨敵我。他們是圓桌會議的基石。"
                        />
                    </div>
                </div>

                {/* Evil Faction */}
                <div>
                    <h3 className="font-cinzel text-xl text-red-500 mb-4 flex items-center gap-2 border-b border-red-900/50 pb-2">
                        <Skull size={24} /> 邪惡陣營 (Minions of Mordred)
                    </h3>
                    <div className="space-y-4">
                         <LoreCard 
                            name="莫甘娜 (Morgana)" 
                            title="黑暗女巫"
                            icon={<Zap size={24} className="text-red-300" />}
                            isGood={false}
                            description="亞瑟王同母異父的姊姊，精通黑魔法。她在派西維爾眼中會顯示為「梅林」。她必須極力偽裝自己是真正的預言家，以迷惑派西維爾，讓好人陣營陷入混亂。"
                        />
                        <LoreCard 
                            name="刺客 (Assassin)" 
                            title="暗影殺手"
                            icon={<Skull size={24} className="text-red-300" />}
                            isGood={false}
                            description="冷酷無情的殺手，潛伏在陰影之中。如果好人陣營完成了三個任務，刺客將擁有最後的一擊機會：猜測誰是梅林。如果猜對，邪惡陣營反敗為勝。"
                        />
                        <LoreCard 
                            name="莫德雷德 (Mordred)" 
                            title="背叛騎士"
                            icon={<Shield size={24} className="text-red-300" />}
                            isGood={false}
                            description="亞瑟王的私生子，最終的背叛者。他披著斗篷，連梅林的魔法之眼也無法看穿他。在梅林的視野中，莫德雷德顯示為好人。他是邪惡陣營最深的隱藏王牌。"
                        />
                         <LoreCard 
                            name="奧伯倫 (Oberon)" 
                            title="妖精之王"
                            icon={<Eye size={24} className="text-red-300" />}
                            isGood={false}
                            description="善變的妖精之王，雖然屬於邪惡陣營，但他獨來獨往。他看不到其他壞人隊友，其他壞人也看不到他（梅林看得到他）。他是一把雙刃劍，常常在不知情的情況下干擾雙方的計劃。"
                        />
                    </div>
                </div>

            </div>
        )}

      </div>
    </div>
  );
};

const LoreCard = ({ name, title, icon, isGood, description }: { name: string, title: string, icon: React.ReactNode, isGood: boolean, description: string }) => (
    <div className={`p-4 rounded-xl border relative overflow-hidden group ${isGood ? 'bg-blue-950/40 border-blue-900' : 'bg-red-950/40 border-red-900'}`}>
        {/* Background gradient */}
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2 pointer-events-none ${isGood ? 'bg-blue-500' : 'bg-red-500'}`}></div>
        
        <div className="flex items-start gap-4 relative z-10">
            <div className={`mt-1 p-3 rounded-lg border shadow-lg ${isGood ? 'bg-blue-900 border-blue-700' : 'bg-red-900 border-red-700'}`}>
                {icon}
            </div>
            <div>
                <h4 className={`font-cinzel text-lg font-bold ${isGood ? 'text-blue-200' : 'text-red-200'}`}>
                    {name}
                </h4>
                <p className={`text-xs uppercase tracking-widest font-bold mb-2 ${isGood ? 'text-blue-400' : 'text-red-400'}`}>
                    {title}
                </p>
                <p className="text-slate-300 text-sm leading-relaxed font-serif text-justify">
                    {description}
                </p>
            </div>
        </div>
    </div>
);