import React, { useState } from 'react';
import { supabase } from '../supabase';

const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        if (!username.trim()) throw new Error("Please enter a username");
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              username: username.trim()
            }
          }
        });
        if (error) throw error;
        setMessage('Check your email for confirmation!');
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
    <div className="min-h-screen bg-emerald-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 p-12 opacity-10 text-9xl text-white pointer-events-none">🌿</div>
      <div className="absolute bottom-0 left-0 p-12 opacity-10 text-9xl text-white pointer-events-none">🧴</div>
      
      <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl max-w-md w-full text-center border-4 border-emerald-100 relative z-10">
         <div className="bg-emerald-800 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl">
           <span className="text-white text-3xl font-black italic">M</span>
         </div>
         <h1 className="text-3xl font-black text-emerald-800 italic uppercase mb-2">Magizh Aadhi</h1>
         <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-8 italic">Authentic Wood-Pressed Wellness</p>
         
         <div className="flex bg-slate-50 p-1 rounded-2xl mb-8 border border-slate-100">
           <button 
             onClick={() => setIsSignUp(false)}
             className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all tracking-widest ${!isSignUp ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Login
           </button>
           <button 
             onClick={() => setIsSignUp(true)}
             className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all tracking-widest ${isSignUp ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Sign Up
           </button>
         </div>

         <form onSubmit={handleAuth} className="space-y-4 text-left">
           {isSignUp && (
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Full Name / Username</label>
               <input 
                 required 
                 type="text" 
                 placeholder="Enter your name" 
                 className="w-full border-2 border-slate-50 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500 bg-slate-50 mt-1 font-bold text-slate-700" 
                 value={username} 
                 onChange={e => setUsername(e.target.value)} 
               />
             </div>
           )}
           <div>
             <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Email Address</label>
             <input 
               required 
               type="email" 
               placeholder="email@example.com" 
               className="w-full border-2 border-slate-50 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500 bg-slate-50 mt-1 font-bold text-slate-700" 
               value={email} 
               onChange={e => setEmail(e.target.value)} 
             />
           </div>
           <div>
             <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Password</label>
             <input 
               required 
               type="password" 
               placeholder="••••••••" 
               className="w-full border-2 border-slate-50 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500 bg-slate-50 mt-1 font-bold text-slate-700" 
               value={password} 
               onChange={e => setPassword(e.target.value)} 
             />
           </div>
           
           {message && (
             <p className={`text-[10px] font-bold text-center mt-2 p-2 rounded-lg ${message.includes('Check') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
               {message}
             </p>
           )}

           <button 
             disabled={loading}
             className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-[0.2em] text-xs mt-4 disabled:opacity-50"
           >
             {loading ? 'Authenticating...' : isSignUp ? 'Create Enterprise Account' : 'Access Portal'}
           </button>
         </form>
         
         <p className="text-slate-400 text-[10px] mt-8 font-medium italic">Internal use only. Data synchronized to Cloud Enterprise Engine.</p>
      </div>
    </div>
  );
};

export default Auth;