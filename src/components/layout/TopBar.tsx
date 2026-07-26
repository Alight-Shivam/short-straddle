import clsx from 'clsx';
import { useUpstox } from '../../upstox/UpstoxContext';

export type AppView = 'backtest' | 'live';

export function TopBar({ activeView, onNavigate }: { activeView: AppView; onNavigate: (v: AppView) => void }) {
  const { status, login, logout } = useUpstox();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-6 py-2.5">
      <div className="flex items-center gap-5">
        <span className="text-sm font-semibold text-slate-100">Short Straddle Analyzer</span>
        <nav className="flex gap-1">
          <button
            onClick={() => onNavigate('backtest')}
            className={clsx('rounded-md px-3 py-1.5 text-sm font-medium', activeView === 'backtest' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200')}
          >
            Backtest Analyzer
          </button>
          <button
            onClick={() => onNavigate('live')}
            className={clsx('rounded-md px-3 py-1.5 text-sm font-medium', activeView === 'live' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200')}
          >
            Live Market
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {status.connected ? (
          <>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-950/50 px-2.5 py-1 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {status.userName ?? 'Connected'}
            </span>
            <button onClick={logout} className="text-slate-400 hover:text-slate-200">Disconnect</button>
          </>
        ) : (
          <button onClick={login} className="rounded-md border border-slate-700 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800">
            Connect to Upstox
          </button>
        )}
      </div>
    </div>
  );
}
