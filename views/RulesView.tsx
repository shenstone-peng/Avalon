import React, { useState } from 'react';
import { ViewState } from '../types';
import { ArrowLeft, Users, Shield, Skull, Eye, Zap, BookOpen } from 'lucide-react';

interface Props {
  onNavigate: (view: ViewState) => void;
}

export const RulesView: React.FC<Props> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'lore'>('config');

  return (
        <div className="h-[100dvh] flex flex-col bg-slate-950 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 bg-slate-900 sticky top-0 z-20 border-b border-slate-800 shadow-md">
        <button onClick={() => onNavigate(ViewState.HOME)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-cinzel font-bold text-xl text-amber-500 flex items-center gap-2">
            <BookOpen size={20} />
            <span>游戏圣典</span>
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/50">
          <button
            className={`flex-1 py-4 text-sm font-bold tracking-widest transition-colors relative ${activeTab === 'config' ? 'text-amber-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveTab('config')}
          >
                        人数配置
            {activeTab === 'config' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500"></div>}
          </button>
          <button
            className={`flex-1 py-4 text-sm font-bold tracking-widest transition-colors relative ${activeTab === 'lore' ? 'text-amber-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveTab('lore')}
          >
                        角色图鉴
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
                        阵营分配表
                    </h3>
                    <div className="overflow-hidden rounded-lg border border-slate-600">
                        <table className="w-full text-center text-sm">
                            <thead>
                                <tr className="bg-slate-700 text-slate-200">
                                    <th className="py-3 px-2 font-bold">总人数</th>
                                    <th className="py-3 px-2 font-bold text-blue-400">正义阵营</th>
                                    <th className="py-3 px-2 font-bold text-red-400">邪恶阵营</th>
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
                        建议角色配置
                    </h3>
                    <ul className="space-y-4 text-sm text-slate-300">
                        <li className="flex gap-3">
                            <span className="font-bold text-white whitespace-nowrap">基础场 (5-6人)：</span>
                            <span className="text-slate-400">梅林、派西维尔、刺客、莫甘娜。其余为忠臣与爪牙。</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="font-bold text-white whitespace-nowrap">进阶场 (7-8人)：</span>
                            <span className="text-slate-400">加入莫德雷德（梅林看不到的坏人）增加正义方难度，或加入奥伯伦（不知道队友的坏人）平衡局势。</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="font-bold text-white whitespace-nowrap">大乱斗 (9-10人)：</span>
                            <span className="text-slate-400">所有特殊角色登场，考验极致的逻辑与演技。</span>
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
                        <Shield size={24} /> 正义阵营 (Arthur's Loyalists)
                    </h3>
                    <div className="space-y-4">
                        <LoreCard
                            name="梅林 (Merlin)"
                            title="偉大的預言家"
                            icon={<Eye size={24} className="text-blue-300" />}
                            isGood={true}
                            description="亚瑟王的导师，拥有洞察人心的魔法。在游戏开始时，他能看到所有的坏人（除了莫德雷德）。但他的知识是个诅咒，因为如果他暴露身份，刺客将会在最后刺杀他，导致好人全盘皆输。"
                        />
                        <LoreCard
                            name="派西维尔 (Percival)"
                            title="圆桌骑士"
                            icon={<Shield size={24} className="text-blue-300" />}
                            isGood={true}
                            description="忠诚而睿智的骑士，在寻找圣杯的途中获得了启示。游戏开始时，他能看到「两位梅林候选人」（真正的梅林与伪装的莫甘娜），但不知道谁是谁。他的职责是保护梅林，并引导好人走向胜利。"
                        />
                        <LoreCard
                            name="亚瑟的忠臣 (Loyal Servant)"
                            title="王国守护者"
                            icon={<Users size={24} className="text-blue-300" />}
                            isGood={true}
                            description="虽然没有特殊能力，但他们拥有一颗赤诚之心。他们不知道谁是队友，只能通过逻辑推理、观察投票和发言来分辨敌我。他们是圆桌会议的基石。"
                        />
                    </div>
                </div>

                {/* Evil Faction */}
                <div>
                    <h3 className="font-cinzel text-xl text-red-500 mb-4 flex items-center gap-2 border-b border-red-900/50 pb-2">
                        <Skull size={24} /> 邪恶阵营 (Minions of Mordred)
                    </h3>
                    <div className="space-y-4">
                         <LoreCard
                            name="莫甘娜 (Morgana)"
                            title="黑暗女巫"
                            icon={<Zap size={24} className="text-red-300" />}
                            isGood={false}
                            description="亚瑟王同母异父的姐姐，精通黑魔法。她在派西维尔眼中会显示为「梅林」。她必须极力伪装自己是真正的预言家，以迷惑派西维尔，让好人阵营陷入混乱。"
                        />
                        <LoreCard
                            name="刺客 (Assassin)"
                            title="暗影殺手"
                            icon={<Skull size={24} className="text-red-300" />}
                            isGood={false}
                            description="冷酷无情的杀手，潜伏在阴影之中。如果好人阵营完成了三个任务，刺客将拥有最后的一击机会：猜测谁是梅林。如果猜对，邪恶阵营反败为胜。"
                        />
                        <LoreCard
                            name="莫德雷德 (Mordred)"
                            title="背叛骑士"
                            icon={<Shield size={24} className="text-red-300" />}
                            isGood={false}
                            description="亚瑟王的私生子，最终的背叛者。他披着斗篷，连梅林的魔法之眼也无法看穿他。在梅林的视野中，莫德雷德显示为好人。他是邪恶阵营最深的隐藏王牌。"
                        />
                         <LoreCard
                            name="奥伯伦 (Oberon)"
                            title="妖精之王"
                            icon={<Eye size={24} className="text-red-300" />}
                            isGood={false}
                            description="善变的妖精之王，虽然属于邪恶阵营，但他独来独往。他看不到其他坏人队友，其他坏人也看不到他（梅林看得到他）。他是一把双刃剑，常常在不知情的情况下干扰双方的计划。"
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