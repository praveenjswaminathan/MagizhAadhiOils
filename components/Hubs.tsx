
import React, { useState } from 'react';
import { AppState, Hub } from '../types';

const Hubs: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const handleSaveHub = (e: React.FormEvent) => {
    e.preventDefault();
    const hubId = editingId || crypto.randomUUID();
    const hub: Hub = { id: hubId, name, address };
    
    updateState(prev => {
      const filtered = prev.hubs.filter(h => h.id !== hubId);
      return { ...prev, hubs: [...filtered, hub] };
    });

    setName('');
    setAddress('');
    setShowAdd(false);
    setEditingId(null);
  };

  const handleEdit = (hub: Hub) => {
    setName(hub.name);
    setAddress(hub.address || '');
    setEditingId(hub.id);
    setShowAdd(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Hub Locations</h1>
        <button 
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); setName(''); setAddress(''); }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-md"
        >
          {showAdd ? 'Cancel' : '+ Add Hub'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleSaveHub} className="bg-white p-6 rounded-xl border-2 border-emerald-100 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-emerald-800">{editingId ? 'Edit Hub Location' : 'New Hub'}</h2>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hub Name</label>
            <input required className="w-full border rounded-lg px-3 py-2" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Swaminathan Residence" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Address / Location Details</label>
            <textarea className="w-full border rounded-lg px-3 py-2" rows={3} value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <button type="submit" className="w-full bg-emerald-700 text-white font-bold py-3 rounded-lg uppercase tracking-widest">Save Hub Details</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.hubs.map(hub => (
          <div key={hub.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group">
            <button onClick={() => handleEdit(hub)} className="absolute top-4 right-4 text-emerald-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
            <div className="flex items-start space-x-3 mb-4">
              <span className="text-3xl">🏠</span>
              <div>
                <h3 className="font-black text-slate-800 text-lg leading-tight">{hub.name}</h3>
                <p className="text-sm text-slate-500 mt-2 italic">{hub.address || 'Address not set'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Hubs;
