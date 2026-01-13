
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

const Layout: React.FC<{ children: React.ReactNode; syncing: boolean; userEmail?: string }> = ({ children, syncing, userEmail }) => {
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

  // Logic to ensure "Priya" is greeted personally
  const email = userEmail?.toLowerCase() || '';
  const isPriya = email.includes('priya') || email === 'praveenjswaminathan@gmail.com'; // Adjust logic if needed
  const displayName = isPriya ? 'Priya' : userEmail?.split('@')[0];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-emerald-900 text-white shadow-2xl sticky top-0 z-50 border-b border-emerald-800">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-2xl font-black tracking-tighter italic uppercase flex items-center gap-2 group">
              <span className="bg-white text-emerald-900 w-9 h-9 rounded-xl flex items-center justify-center font-black not-italic shadow-lg group-hover:scale-110 transition-transform">M</span>
              <span className="hidden sm:inline">Magizh Aadhi</span>
            </Link>
            {syncing && (
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 px-3 py-1 rounded-full text-[9px] font-black animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                SYNCING
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center bg-emerald-950/50 rounded-2xl p-1 border border-white/5">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest ${
                    location.pathname.startsWith(item.path) 
                      ? 'bg-emerald-800 shadow-xl text-white' 
                      : 'text-emerald-300 hover:text-white hover:bg-emerald-800/50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 leading-none mb-1">Welcome back,</p>
                <p className="text-sm font-black italic tracking-tight">{displayName}</p>
              </div>
              <button 
                onClick={handleLogout} 
                className="bg-emerald-800 hover:bg-rose-900 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-lg border border-white/10"
                title="Sign Out"
              >
                🚪
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 py-10 w-full pb-32 lg:pb-12">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-8 left-6 right-6 bg-emerald-950/90 backdrop-blur-xl text-white rounded-[32px] flex justify-around py-5 px-4 shadow-2xl z-50 border border-white/10">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center p-3 rounded-2xl transition-all ${
              location.pathname.startsWith(item.path) 
                ? 'text-emerald-400 bg-white/10 shadow-inner' 
                : 'text-slate-400'
            }`}
          >
            <span className="text-2xl">{item.icon}</span>
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

  useEffect(() => {
    if (!session) return;
    const init = async () => {
      const data = await loadState();
      setState(data);
      isInitialLoad.current = false;
    };
    init();
  }, [session]);

  useEffect(() => {
    if (isInitialLoad.current || !state || !session) return;
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    
    setSyncing(true);
    syncTimeout.current = setTimeout(async () => {
      await saveState(state);
      setSyncing(false);
    }, 2000);

    return () => { if (syncTimeout.current) clearTimeout(syncTimeout.current); };
  }, [state, session]);

  const updateState = (updater: (prev: AppState) => AppState) => {
    setState(prev => prev ? updater(prev) : null);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-950 text-white">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
      <p className="font-black uppercase tracking-[0.3em] text-xs text-emerald-500">Initializing Enterprise Engine</p>
    </div>
  );

  if (!session) return <Auth />;

  if (!state) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-950 text-white">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
      <p className="font-black uppercase tracking-[0.3em] text-xs text-emerald-500">Loading Business Data</p>
    </div>
  );

  return (
    <Router>
      <Layout syncing={syncing} userEmail={session.user.email}>
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
