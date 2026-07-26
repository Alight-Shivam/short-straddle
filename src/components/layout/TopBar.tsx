import clsx from 'clsx';
import { useUpstox } from '../../upstox/UpstoxContext';
import { useTheme } from '../../theme/ThemeContext';

export type AppView = 'backtest' | 'live' | 'historical';

export function TopBar({ activeView, onNavigate }: { activeView: AppView; onNavigate: (v: AppView) => void }) {
  const { status, login, logout } = useUpstox();
  const { theme, toggleTheme } = useTheme();

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
          <button
            onClick={() => onNavigate('historical')}
            className={clsx('rounded-md px-3 py-1.5 text-sm font-medium', activeView === 'historical' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200')}
          >
            Historical Data
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
        >
          {theme === 'dark' ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-6.364-2.386 1.591-1.591M3 12h2.25m.386-6.364 1.591 1.591M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          )}
        </button>
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
