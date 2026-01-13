
import React, { useRef } from 'react';
import { AppState } from '../types';

// Removed non-existent imports getApiUrl and setApiUrl from db.ts
const Settings: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Maintain local backup functionality for user data safety
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">System Settings</h1>
        <p className="text-slate-500 text-sm">Manage data backups and system status.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Google Sheets configuration removed as it is deprecated in favor of Supabase sync */}
        
        {/* Data Management Section */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="text-xl">💾</span> Local Backup & Recovery
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Download your entire business database as a JSON file. This can be used as a manual checkpoint or to migrate data.
          </p>
          <div className="flex gap-4">
            <button onClick={handleBackup} className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-lg shadow-md hover:bg-slate-800 transition-colors uppercase text-xs tracking-wider">
              Download .JSON
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-50 transition-colors uppercase text-xs tracking-wider">
              Restore .JSON
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestore} />
          </div>
        </div>
      </div>

      <div className="bg-slate-800 text-white p-6 rounded-2xl flex items-center justify-between shadow-xl">
        <div>
          <h3 className="font-black text-emerald-400 text-xl italic uppercase">Magizh Aadhi Oils</h3>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Supabase Cloud Edition</p>
        </div>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-right">
          Build 3.5 <br/> Secure Cloud Sync Active
        </p>
      </div>
    </div>
  );
};

export default Settings;
