
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AppState } from './types';
import { loadState, saveState } from './db';
import { supabase } from './supabase';
import Dashboard from './components/Dashboard';
import InventoryAndHubs from './components/InventoryAndHubs';
import Sales from './components/Sales';
import Customers from './components/Customers';
import CustomerProfile from './components/CustomerProfile';
import ConsolidatedReport from './components/ConsolidatedReport';
import Products from './components/Products';
import Auth from './components/Auth';
import Settings from './components/Settings';

const Layout: React.FC<{ children: React.ReactNode; syncing: boolean; syncError: boolean; user?: any; isAdmin: boolean; isMasterAdmin: boolean; systemId: string }> = ({ children, syncing, syncError, user, isAdmin, isMasterAdmin, systemId }) => {
  const location = useLocation();
  const isReport = location.pathname.includes('/reports/');
  
  const navItems = [
    { path: '/dashboard', label: 'Home', icon: '📊' },
    { path: '/inventory', label: 'Stock', icon: '📦' },
    { path: '/sales', label: 'Sales', icon: '💰' },
    { path: '/products', label: 'Price', icon: '🏷️' },
    { path: '/customers', label: 'Clients', icon: '👥' },
  ];

  const handleLogout = async () => {
    localStorage.clear();
    await supabase.auth.signOut();
    window.location.reload();
  };

  const displayName = user?.user_metadata?.username || systemId || 'Administrator';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <header className={`bg-emerald-950 text-white shadow-premium sticky top-0 z-50 border-b border-emerald-800/50 backdrop-blur-md bg-emerald-950/95 ${isReport ? 'print:hidden' : ''}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center gap-2 group transition-transform hover:scale-[1.01] active:scale-95">
              <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white w-9 h-9 rounded-lg flex items-center justify-center font-black shadow-lg">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tighter uppercase italic leading-none">Magizh Aadhi</span>
                <span className="text-[7px] font-black tracking-[0.2em] text-emerald-500 uppercase leading-none mt-1">Enterprise Hub</span>
              </div>
            </Link>
            
            {syncing && (
              <div className="flex items-center bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse mr-2"></div>
                <span className="text-[7px] font-black text-emerald-400 tracking-widest uppercase">Syncing...</span>
              </div>
            )}
            
            {syncError && !syncing && (
              <div className="flex items-center bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-2"></div>
                <span className="text-[7px] font-black text-rose-500 tracking-widest uppercase">Sync Error!</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <nav className="hidden lg:flex items-center bg-emerald-900/30 rounded-lg p-0.5 border border-white/5 mr-4">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all tracking-widest flex items-center gap-1.5 ${
                    location.pathname.startsWith(item.path) 
                      ? 'bg-emerald-700 shadow-lg text-white' 
                      : 'text-emerald-300/60 hover:text-white hover:bg-emerald-800/40'
                  }`}
                >
                  <span className="opacity-70 text-sm">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            
            <div className="flex items-center gap-2 pl-4 border-l border-white/10">
              <div className="hidden sm:flex flex-col items-end leading-none mr-3 text-right">
                <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isAdmin ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {isMasterAdmin ? 'Master Admin' : isAdmin ? 'System Admin' : 'Viewer Only'}
                </p>
                <p className="text-xs font-black italic text-white">{displayName}</p>
                <p className="text-[7px] font-black opacity-30 tracking-widest uppercase mt-0.5">ID: {systemId}</p>
              </div>
              
              <Link 
                to="/settings" 
                title="System Setup" 
                className={`p-2.5 rounded-xl transition-all shadow-sm ${
                  location.pathname === '/settings' 
                    ? 'bg-emerald-700 text-white' 
                    : 'hover:bg-white/10 text-emerald-300/60 hover:text-white'
                }`}
              >
                 <span className="text-xl leading-none">⚙️</span>
              </Link>
              
              <button 
                onClick={handleLogout} 
                className="bg-rose-600/90 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-grow ${isReport ? 'p-0' : 'max-w-6xl mx-auto px-4 py-4'} w-full pb-28 lg:pb-8 print:p-0 print:m-0 print:max-w-none`}>
        <div className="animate-in fade-in duration-300">
          {children}
        </div>
      </main>

      <nav className={`lg:hidden fixed bottom-6 left-6 right-6 bg-emerald-950/95 backdrop-blur-xl text-white rounded-[32px] flex justify-around py-4 shadow-2xl z-50 border border-white/10 print:hidden ${isReport ? 'hidden' : ''}`}>
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${
              location.pathname.startsWith(item.path) 
                ? 'text-emerald-400 bg-white/10 scale-110 shadow-inner' 
                : 'text-slate-400'
            }`}
          >
            <span className="text-3xl mb-1.5">{item.icon}</span>
            <span className="text-[8px] font-black uppercase tracking-tighter opacity-80">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [session, setSession] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        localStorage.clear();
        setState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const init = async () => {
      const data = await loadState();
      setState(data);
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 500); 
    };
    init();
  }, [session]);

  const systemId = session?.user?.email?.split('@')[0]?.toLowerCase() || '';
  const isMasterAdmin = systemId === 'swami';
  const isAdmin = isMasterAdmin || 
                  (state?.adminUsernames?.map(u => u.toLowerCase()).includes(systemId));

  useEffect(() => {
    if (isInitialLoad.current || !state || !session) return;
    if (!isAdmin) return;
    
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    
    setSyncing(true);
    syncError && setSyncError(false);

    syncTimeout.current = setTimeout(async () => {
      try {
        await saveState(state);
        setSyncError(false);
      } catch (e) {
        console.error("Cloud Sync Failed", e);
        setSyncError(true);
      } finally {
        setSyncing(false);
      }
    }, 1200); 

    return () => { if (syncTimeout.current) clearTimeout(syncTimeout.current); };
  }, [state, session, isAdmin]);

  const updateState = (updater: (prev: AppState) => AppState) => {
    if (!isAdmin) {
      console.warn("Permission Denied: Viewer cannot modify state.");
      return;
    }
    
    setState(prev => {
      if (!prev) return null;
      const next = updater(prev);
      localStorage.setItem('magizh_aadhi_oils_db', JSON.stringify(next));
      return next;
    });
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-950">
      <div className="w-12 h-12 border-[6px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
    </div>
  );

  if (!session) return <Auth />;

  if (!state) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-950">
      <div className="bg-emerald-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl animate-bounce">
         <span className="text-white font-black italic text-2xl">M</span>
      </div>
      <p className="text-emerald-500 font-black text-[10px] uppercase tracking-[0.3em] mt-4 animate-pulse">Initializing Enterprise Data...</p>
    </div>
  );

  return (
    <Router>
      <Layout syncing={syncing} syncError={syncError} user={session.user} isAdmin={isAdmin} isMasterAdmin={isMasterAdmin} systemId={systemId}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard state={state} updateState={updateState} isAdmin={isAdmin} />} />
          <Route path="/inventory" element={<InventoryAndHubs state={state} updateState={updateState} isAdmin={isAdmin} />} />
          <Route path="/sales" element={<Sales state={state} updateState={updateState} isAdmin={isAdmin} />} />
          <Route path="/products" element={<Products state={state} updateState={updateState} isAdmin={isAdmin} />} />
          <Route path="/customers" element={<Customers state={state} updateState={updateState} isAdmin={isAdmin} />} />
          <Route path="/customer/:id" element={<CustomerProfile state={state} updateState={updateState} isAdmin={isAdmin} />} />
          <Route path="/reports/consolidated" element={<ConsolidatedReport state={state} />} />
          <Route path="/settings" element={<Settings state={state} updateState={updateState} isAdmin={isAdmin} isMasterAdmin={isMasterAdmin} />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
