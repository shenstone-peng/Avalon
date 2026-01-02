import React from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { Crown, Users, Sparkles } from 'lucide-react';

interface Props {
  onNavigate: (view: ViewState) => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  isAuthed: boolean;
  pendingRoomCode: string | null;
  onAuthSuccess: (token: string) => void;
  onLogout: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export const HomeView: React.FC<Props> = ({
  onNavigate,
  playerName,
  onPlayerNameChange,
  isAuthed,
  pendingRoomCode,
  onAuthSuccess,
  onLogout,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [authMsg, setAuthMsg] = React.useState<string | null>(null);
  const [joinCode, setJoinCode] = React.useState('');

  const callAuthApi = async (endpoint: '/api/register' | '/api/login') => {
    const name = playerName.trim();
    if (!name) {
      setAuthMsg('请先输入名字');
      return;
    }
    if (!password) {
      setAuthMsg('请输入密码');
      return;
    }

    try {
      setBusy(true);
      setAuthMsg(null);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAuthMsg(data?.message || '操作失败');
        return;
      }
      if (data?.token) onAuthSuccess(data.token);
      if (data?.user?.name) {
        onPlayerNameChange(data.user.name);
      }
      setPassword('');
      setAuthMsg(endpoint === '/api/register' ? '注册成功，已登录' : '登录成功');
    } catch (e) {
      console.error(e);
      setAuthMsg('连接失败，请稍后再试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 py-12 relative pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Hero Section */}
      <div className="text-center mb-12 animate-[fadeIn_1s_ease-out]">
        <div className="inline-flex items-center justify-center p-4 bg-amber-500/10 rounded-full border border-amber-500/30 mb-6 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <Crown size={48} className="text-amber-400" />
        </div>
        <h1 className="font-cinzel text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 mb-2 drop-shadow-sm">
          王者圆桌
        </h1>
        <p className="font-cinzel text-amber-600/80 text-sm tracking-[0.3em] uppercase mb-4">
            Project Avalon
        </p>
        <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
          正义与邪恶的终极对决，谁能活着见到圣杯？
        </p>
      </div>

      {/* Nickname */}
      <div className="w-full max-w-sm mb-6 z-20">
        <label className="block text-xs text-slate-500 uppercase tracking-widest mb-2 text-center">你的昵称</label>
        <input
          value={playerName}
          onChange={(e) => onPlayerNameChange(e.target.value)}
          maxLength={20}
          placeholder="输入你的名字"
          className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
        />
        <p className="text-[11px] text-slate-600 mt-2 text-center">加入房间后也可以再修改</p>
      </div>

      {!isAuthed ? (
        <>
          {pendingRoomCode && (
            <div className="w-full max-w-sm mb-4 z-20">
              <p className="text-xs text-amber-400 text-center">
                你正在尝试加入房间 {pendingRoomCode}，请先登录。
              </p>
            </div>
          )}

          {/* Auth */}
          <div className="w-full max-w-sm mb-6 z-20">
            <label className="block text-xs text-slate-500 uppercase tracking-widest mb-2 text-center">密碼</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              maxLength={200}
              placeholder="至少 6 字符"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
            />
            {authMsg && <p className="text-[11px] text-slate-400 mt-2 text-center">{authMsg}</p>}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button variant="secondary" fullWidth onClick={() => callAuthApi('/api/register')} disabled={busy}>
                注册
              </Button>
              <Button variant="secondary" fullWidth onClick={() => callAuthApi('/api/login')} disabled={busy}>
                登录
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="w-full max-w-sm mb-6 z-20">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-widest">已登录</p>
            <button className="text-xs text-slate-400 hover:text-slate-200" onClick={onLogout}>
              退出登录
            </button>
          </div>

          <div className="space-y-4">
            <Button variant="secondary" fullWidth onClick={onCreateRoom}>
              <Users size={20} /> 创建房间
            </Button>

            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
              <label className="block text-xs text-slate-500 uppercase tracking-widest mb-2 text-center">加入房间</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                maxLength={20}
                placeholder="输入房间号（例如 AV-1234）"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
              />
              <div className="mt-3">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    const code = joinCode.trim();
                    if (!code) return;
                    onJoinRoom(code);
                  }}
                  disabled={!joinCode.trim()}
                >
                  加入
                </Button>
              </div>
            </div>
          </div>

          {authMsg && <p className="text-[11px] text-slate-400 mt-3 text-center">{authMsg}</p>}
        </div>
      )}

      {/* Main Actions (kept minimal; gameplay entry is gated above) */}
      <div className="w-full max-w-sm space-y-4 z-20">
        <Button variant="secondary" fullWidth onClick={() => onNavigate(ViewState.RULES)}>
          规则说明
        </Button>
      </div>

      {/* Decorative Footer */}
      <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] text-center">
         <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
            <Sparkles size={12} />
          <span>S1 赛季：亚瑟王的召唤</span>
            <Sparkles size={12} />
         </div>
      </div>
    </div>
  );
};
