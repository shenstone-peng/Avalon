import React from 'react';
import { ViewState } from '../types';
import { ArrowLeft, Trophy, Target, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, YAxis } from 'recharts';

interface Props {
  onNavigate: (view: ViewState) => void;
}

export const ProfileView: React.FC<Props> = ({ onNavigate }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setError('尚未登入');
          setProfile(null);
          return;
        }
        const res = await fetch('/api/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.message || '讀取失敗');
          setProfile(null);
          return;
        }
        setProfile(data);
      } catch (e) {
        console.error(e);
        setError('連線失敗');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = profile?.stats;
  const userName = profile?.user?.name || '玩家';
  const total = stats?.total ?? 0;
  const winRate = stats?.winRate ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;

  const winData = [
    { name: '正義陣營', value: stats?.good?.games ?? 0, color: '#3b82f6' },
    { name: '邪惡陣營', value: stats?.evil?.games ?? 0, color: '#ef4444' },
  ];

  const roleStats = (stats?.roles || []).slice(0, 4).map((r: any) => ({
    name: r.roleKey,
    winRate: r.winRate,
  }));

  return (
    <div className="h-[100dvh] overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] bg-slate-900">
      <div className="p-4 flex items-center gap-4 bg-slate-800 sticky top-0 z-10 border-b border-slate-700">
        <button onClick={() => onNavigate(ViewState.HOME)} className="p-2 text-slate-400 hover:text-white">
          <ArrowLeft />
        </button>
        <h2 className="font-cinzel font-bold text-lg">我的戰績</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Profile Card */}
        <div className="flex items-center gap-4 mb-8">
            <div className="w-20 h-20 rounded-full border-2 border-amber-500 p-1">
                <img src="https://picsum.photos/seed/knight1/200/200" className="w-full h-full rounded-full object-cover" alt="Avatar" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber-400">{userName}</h3>
              <p className="text-xs text-slate-400 uppercase tracking-widest">戰績統計</p>
                <div className="mt-2 flex gap-2">
                <span className="bg-slate-700 text-[10px] px-2 py-1 rounded">勝率 {winRate}%</span>
                <span className="bg-slate-700 text-[10px] px-2 py-1 rounded">總場次 {total}</span>
                </div>
            </div>
        </div>

          {loading && <p className="text-center text-xs text-slate-400">讀取中...</p>}
          {error && <p className="text-center text-xs text-rose-400">{error}</p>}

        {/* Highlight Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Trophy size={16} className="text-amber-400" />} label="勝利" value={String(wins)} />
          <StatCard icon={<Target size={16} className="text-red-400" />} label="失敗" value={String(losses)} />
          <StatCard icon={<ShieldAlert size={16} className="text-blue-400" />} label="總場次" value={String(total)} />
        </div>

        {/* Charts */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h4 className="text-sm font-bold text-slate-300 mb-4 border-l-4 border-amber-500 pl-2">陣營勝率</h4>
            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={winData}
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {winData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                         <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div> 正義 ({stats?.good?.winRate ?? 0}%)
                </div>
                <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div> 邪惡 ({stats?.evil?.winRate ?? 0}%)
                </div>
            </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
             <h4 className="text-sm font-bold text-slate-300 mb-4 border-l-4 border-amber-500 pl-2">角色勝率 TOP 4</h4>
             <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roleStats} layout="vertical">
                         <XAxis type="number" hide />
                         <YAxis dataKey="name" type="category" width={60} tick={{fill: '#94a3b8', fontSize: 12}} />
                         <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
                         <Bar dataKey="winRate" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <h4 className="text-sm font-bold text-slate-300 mb-4 border-l-4 border-amber-500 pl-2">最近對局</h4>
          <div className="space-y-2">
            {(profile?.recent || []).slice(0, 10).map((m: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/40 border border-slate-700 rounded-lg px-3 py-2">
                <div className="text-slate-300">
                  <span className="text-slate-400">{m.roomCode}</span>
                  <span className="mx-2 text-slate-600">•</span>
                  <span>{m.me?.roleKey || '-'}</span>
                </div>
                <div className={m.me?.won ? 'text-emerald-400' : 'text-rose-400'}>{m.me?.won ? '勝利' : '失敗'}</div>
              </div>
            ))}
            {!loading && (!profile?.recent || profile.recent.length === 0) && (
              <p className="text-center text-xs text-slate-500">尚無戰績</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="bg-slate-800 p-3 rounded-lg flex flex-col items-center gap-1 border border-slate-700">
        <div className="p-2 bg-slate-700/50 rounded-full mb-1">{icon}</div>
        <span className="text-2xl font-bold text-slate-200 font-cinzel">{value}</span>
        <span className="text-[10px] text-slate-500">{label}</span>
    </div>
);
