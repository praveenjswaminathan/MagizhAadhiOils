
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
import Products from './components/Products';
import Auth from './components/Auth';

const Layout: React.FC<{ children: React.ReactNode; syncing: boolean; user?: any }> = ({ children, syncing, user }) => {
  const location = useLocation();
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/inventory', label: 'Inventory', icon: '📦' },
    { path: '/sales', label: 'Sales', icon: '💰' },
    { path: '/products', label: 'Pricing', icon: '🏷️' },
    { path: '/customers', label: 'Customers', icon: '👥' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Administrator';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <header className="bg-emerald-950 text-white shadow-premium sticky top-0 z-50 border-b border-emerald-800/50 backdrop-blur-md bg-emerald-950/95">
        <div className="max-w-6xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center gap-2 group transition-transform hover:scale-[1.01] active:scale-95">
              <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-black shadow-lg">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black tracking-tighter uppercase italic leading-none">Magizh Aadhi</span>
                <span className="text-[7px] font-black tracking-[0.2em] text-emerald-500 uppercase leading-none mt-0.5">Enterprise Portal</span>
              </div>
            </Link>
            {syncing && (
              <div className="flex items-center bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                <div className="w-1 h-1 bg-emerald-400 rounded-full animate-ping mr-2"></div>
                <span className="text-[7px] font-black text-emerald-400 tracking-widest uppercase">Saving Changes...</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden lg:flex items-center bg-emerald-900/30 rounded-lg p-0.5 border border-white/5">
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
                  <span className="opacity-70">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            
            <div className="flex items-center gap-3 pl-3 border-l border-white/10">
              <div className="hidden sm:flex flex-col items-end leading-none">
                <p className="text-xs font-black italic text-white">{username}</p>
              </div>
              <button 
                onClick={handleLogout} 
                className="bg-rose-600/90 hover:bg-rose-600 text-white px-2.5 py-1.5 rounded-md font-black text-[8px] uppercase tracking-widest active:scale-95 transition-all shadow-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-6xl mx-auto px-4 py-3 w-full pb-20 lg:pb-6">
        <div className="animate-in fade-in duration-300">
          {children}
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-3 left-3 right-3 bg-emerald-950/95 backdrop-blur-xl text-white rounded-xl flex justify-around py-2 shadow-2xl z-50 border border-white/10">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all ${
              location.pathname.startsWith(item.path) 
                ? 'text-emerald-400 bg-white/10' 
                : 'text-slate-500'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span className="text-[6px] font-black uppercase mt-0.5">{item.label}</span>
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
    });

    return () => subscription.unsubscribe();
  }, []);

  // LOAD ONCE: When session is established
  useEffect(() => {
    if (!session) return;
    const init = async () => {
      console.log("Loading initial cloud state...");
      const data = await loadState();
      setState(data);
      // Wait for React to finish setting state before marking as loaded
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    };
    init();
  }, [session]);

  // SAVE ONLY: When state changes locally
  useEffect(() => {
    if (isInitialLoad.current || !state || !session) return;
    
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    
    setSyncing(true);
    syncTimeout.current = setTimeout(async () => {
      try {
        await saveState(state);
      } finally {
        setSyncing(false);
      }
    }, 1500); // 1.5s delay to batch changes

    return () => { if (syncTimeout.current) clearTimeout(syncTimeout.current); };
  }, [state, session]);

  const updateState = (updater: (prev: AppState) => AppState) => {
    setState(prev => prev ? updater(prev) : null);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-950">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!session) return <Auth />;

  if (!state) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-950">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-emerald-500 font-black text-[10px] uppercase tracking-widest mt-4">Establishing Secure Connection...</p>
    </div>
  );

  return (
    <Router>
      <Layout syncing={syncing} user={session.user}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard state={state} updateState={updateState} />} />
          <Route path="/inventory" element={<InventoryAndHubs state={state} updateState={updateState} />} />
          <Route path="/sales" element={<Sales state={state} updateState={updateState} />} />
          <Route path="/products" element={<Products state={state} updateState={updateState} />} />
          <Route path="/customers" element={<Customers state={state} updateState={updateState} />} />
          <Route path="/customer/:id" element={<CustomerProfile state={state} updateState={updateState} />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
