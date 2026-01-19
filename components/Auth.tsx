
import React, { useState } from 'react';
import { supabase } from '../supabase';

const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [userInput, setUserInput] = useState(''); 
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const email = userInput.includes('@') ? userInput : `${userInput.toLowerCase().replace(/\s/g, '')}@magizhaadhi.internal`;

    try {
      if (isSignUp) {
        if (!fullName.trim()) throw new Error("Please enter your full name");
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              username: fullName.trim(),
              // Logic stays internal, but UI is clean
              role: userInput.toLowerCase() === 'swami' ? 'admin' : 'viewer'
            }
          }
        });
        if (error) throw error;
        setMessage(`Account request submitted. ${userInput.toLowerCase() === 'swami' ? 'Master Admin privileges activated.' : 'A system administrator will review your access level shortly.'}`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-10 text-[180px] text-emerald-400 pointer-events-none italic font-black">M</div>
      <div className="absolute bottom-0 left-0 p-12 opacity-5 text-9xl text-white pointer-events-none">🌿</div>
      
      <div className="bg-white p-10 md:p-14 rounded-[48px] shadow-2xl max-w-md w-full text-center border-8 border-emerald-900/10 relative z-10 transition-all">
         <div className="bg-emerald-800 w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-2xl border-4 border-emerald-700/50">
           <span className="text-white text-4xl font-black italic">M</span>
         </div>
         <h1 className="text-4xl font-black text-emerald-950 italic uppercase mb-2 tracking-tighter">Magizh Aadhi</h1>
         <p className="text-emerald-600/60 font-black text-[10px] uppercase tracking-[0.4em] mb-10 italic">Enterprise Portal Login</p>
         
         <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-10 border-2 border-slate-100">
           <button 
             onClick={() => { setIsSignUp(false); setMessage(''); }}
             className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase transition-all tracking-widest ${!isSignUp ? 'bg-emerald-950 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
           >
             System Login
           </button>
           <button 
             onClick={() => { setIsSignUp(true); setMessage(''); }}
             className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase transition-all tracking-widest ${isSignUp ? 'bg-emerald-950 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
           >
             New Account
           </button>
         </div>

         <form onSubmit={handleAuth} className="space-y-6 text-left">
           {isSignUp && (
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-[0.2em]">Full Name</label>
               <input 
                 required 
                 type="text" 
                 placeholder="Enter your name" 
                 className="w-full border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500 bg-slate-50 mt-2 font-black text-slate-800 text-sm transition-all" 
                 value={fullName} 
                 onChange={e => setFullName(e.target.value)} 
               />
             </div>
           )}
           <div>
             <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-[0.2em]">System Username</label>
             <input 
               required 
               type="text" 
               placeholder="Enter your system ID" 
               className="w-full border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500 bg-slate-50 mt-2 font-black text-slate-800 text-sm transition-all" 
               value={userInput} 
               onChange={e => setUserInput(e.target.value)} 
             />
           </div>
           <div>
             <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-[0.2em]">Access Key</label>
             <input 
               required 
               type="password" 
               placeholder="Enter your key" 
               className="w-full border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500 bg-slate-50 mt-2 font-black text-slate-800 text-sm transition-all" 
               value={password} 
               onChange={e => setPassword(e.target.value)} 
             />
           </div>
           
           {message && (
             <div className={`text-[10px] font-black text-center mt-4 p-4 rounded-2xl tracking-widest uppercase ${message.includes('activated') || message.includes('submitted') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
               {message}
             </div>
           )}

           <button 
             disabled={loading}
             className="w-full bg-emerald-950 text-white font-black py-5 rounded-2xl shadow-2xl hover:bg-black transition-all uppercase tracking-[0.3em] text-xs mt-6 disabled:opacity-50 active:scale-95"
           >
             {loading ? 'Authenticating...' : isSignUp ? 'Request System Access' : 'Enter Portal'}
           </button>
         </form>
         
         <p className="text-slate-300 text-[9px] mt-10 font-black uppercase tracking-[0.2em] italic">Enterprise Vault Security Active</p>
      </div>
    </div>
  );
};

export default Auth;
