
import React, { useRef, useState, useMemo } from 'react';
import { AppState } from '../types';
import { INITIAL_STATE } from '../db';
import { supabase } from '../supabase';

const Settings: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void; isAdmin: boolean; isMasterAdmin: boolean }> = ({ state, updateState, isAdmin, isMasterAdmin }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newAdmin, setNewAdmin] = useState('');

  const handleBackup = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Magizh_Oils_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm("Restore this backup? This will overwrite ALL current data.")) {
          updateState(() => json);
          alert("Restore successful!");
        }
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleEmergencyReset = async () => {
    if (!isAdmin) return;
    const confirm1 = confirm("⚠️ EMERGENCY RESET: This will clear your browser's local cache and reset the app. It will NOT wipe the cloud database automatically.");
    if (!confirm1) return;
    
    const confirm2 = confirm("FINAL WARNING: Are you sure you want to proceed with a local cache wipe?");
    if (!confirm2) return;

    localStorage.clear();
    updateState(() => INITIAL_STATE);
    alert("Local cache cleared. Please refresh the page.");
    window.location.reload();
  };

  const promoteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMasterAdmin || !newAdmin.trim()) return;
    const username = newAdmin.trim().toLowerCase();
    
    if (state.adminUsernames.includes(username)) {
      alert("User is already an administrator.");
      return;
    }

    if (confirm(`Promote "${username}" to System Administrator? They will have full edit access to sales and pricing.`)) {
      updateState(prev => ({
        ...prev,
        adminUsernames: [...prev.adminUsernames, username]
      }));
      setNewAdmin('');
    }
  };

  const removeAdmin = (username: string) => {
    if (!isMasterAdmin) return;
    if (username.toLowerCase() === 'swami') {
      alert("Master Administrator 'Swami' cannot be removed.");
      return;
    }
    if (confirm(`Remove administrator privileges for "${username}"?`)) {
      updateState(prev => ({
        ...prev,
        adminUsernames: prev.adminUsernames.filter(u => u !== username)
      }));
    }
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Controls</h1>
        <p className="text-slate-500 font-medium text-sm italic">Administrative tools and data management.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Admin Management - EXCLUSIVELY FOR MASTER ADMIN */}
        {isMasterAdmin && (
          <div className="bg-emerald-950 p-8 rounded-[32px] shadow-2xl space-y-6 border border-emerald-800 text-white animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">Manage System Administrators</h2>
            </div>
            
            <form onSubmit={promoteUser} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter system username to promote" 
                className="flex-grow bg-emerald-900/50 border border-emerald-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500 transition-all"
                value={newAdmin}
                onChange={e => setNewAdmin(e.target.value)}
              />
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95">
                Grant Access
              </button>
            </form>

            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase text-emerald-500/50 tracking-widest ml-2">Active Privileged IDs</p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-emerald-800/50 border border-emerald-600/30 px-4 py-2 rounded-xl text-xs font-black italic flex items-center gap-2">
                  swami <span className="text-[8px] bg-emerald-400 text-emerald-950 px-1.5 rounded-sm uppercase tracking-tighter font-black">Owner</span>
                </span>
                {state.adminUsernames.map(u => (
                  <div key={u} className="bg-emerald-900/40 border border-emerald-800 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-3 group">
                    {u}
                    <button onClick={() => removeAdmin(u)} className="text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity font-black text-[10px]">×</button>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[8px] font-bold text-emerald-500/40 italic uppercase tracking-widest">Only the Master Admin (Swami) can grant or revoke these permissions.</p>
          </div>
        )}

        <div className="bg-white p-8 rounded-[32px] border shadow-premium space-y-4">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span>💾</span> Data Backup & Recovery
          </h2>
          <p className="text-xs text-slate-500 font-bold leading-relaxed">
            Download your current state as a JSON file for local archival. {isAdmin ? 'Restore via JSON is also available.' : ''}
          </p>
          <div className="flex gap-3">
            <button onClick={handleBackup} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-black transition-all uppercase text-[10px] tracking-widest">
              Export Database
            </button>
            {isAdmin && (
              <>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border-2 border-slate-200 text-slate-700 font-black py-4 rounded-2xl hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest">
                  Import JSON
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestore} />
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="bg-rose-50 p-8 rounded-[32px] border border-rose-100 space-y-4">
            <h2 className="text-sm font-black text-rose-800 uppercase tracking-widest flex items-center gap-2">
              <span>🚨</span> Emergency Factory Reset
            </h2>
            <p className="text-xs text-rose-700 font-bold leading-relaxed">
              Use this if you are seeing "Ghost Data". This clears your browser's memory.
            </p>
            <div className="bg-white/50 p-4 rounded-xl border border-rose-200">
                <p className="text-[10px] font-black text-rose-900 uppercase mb-2">Supabase Wipe Command (Run in SQL Editor):</p>
                <code className="text-[9px] font-mono font-bold break-all bg-white p-2 block border rounded">
                  TRUNCATE TABLE sale_lines, consignment_lines, sales, consignments, returns, payments, price_history, customers, hubs, products RESTART IDENTITY CASCADE;
                </code>
            </div>
            <button onClick={handleEmergencyReset} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-rose-700 transition-all uppercase text-[10px] tracking-widest">
              Perform Local Cache Wipe
            </button>
          </div>
        )}
        
        {!isAdmin && (
          <div className="bg-amber-50 p-8 rounded-[32px] border border-amber-100 space-y-2">
            <h2 className="text-sm font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
              <span>🔒</span> Restricted Access
            </h2>
            <p className="text-xs text-amber-700 font-bold leading-relaxed">
              You are currently logged in with Viewer privileges. Some administrative tools and data modification features are hidden to prevent accidental changes.
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 text-white p-10 rounded-[40px] flex items-center justify-between shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">🌿</div>
        <div className="relative z-10">
          <h3 className="font-black text-emerald-400 text-2xl italic uppercase tracking-tighter leading-none">Magizh Aadhi Oils</h3>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] mt-3">Enterprise Cloud Architecture Active</p>
        </div>
        <div className="text-right relative z-10">
           <div className={`inline-block border px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${isMasterAdmin ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : isAdmin ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
             {isMasterAdmin ? 'Master Key' : isAdmin ? 'Admin Access' : 'Viewer Sync'}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
