
import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative h-[500px] flex items-center justify-center overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-emerald-900 opacity-80 z-10"></div>
        <img 
          src="https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=2000" 
          alt="Natural Oils" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 text-center px-6 max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter">
            Pure Marachekku <span className="text-emerald-400">Cold Pressed</span> Oils
          </h1>
          <p className="text-xl text-emerald-50 mb-8 font-medium leading-relaxed">
            Experience the authentic taste and health benefits of traditional wood-pressed oils. 
            Sourced directly from Erode, crafted with care for your family's wellness.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/sales" className="bg-emerald-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-400 transition-all shadow-xl">
              Manage Sales
            </Link>
            <Link to="/inventory" className="bg-white/10 backdrop-blur-md text-white border-2 border-white/20 px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-all">
              Check Stock
            </Link>
          </div>
        </div>
      </section>

      {/* Product Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard 
          icon="🥜"
          title="Traditional Method"
          desc="Our wood-pressed (Marachekku) technique retains natural nutrients and antioxidants."
        />
        <FeatureCard 
          icon="🌿"
          title="100% Natural"
          desc="No chemical refining, no bleaching, and zero additives. Just pure oil."
        />
        <FeatureCard 
          icon="🚚"
          title="Direct Sourcing"
          desc="Directly from Erode to our hubs in Chennai, ensuring peak freshness."
        />
      </div>

      <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-6">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Health in Every Drop</h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            Cold-pressed oils are rich in Vitamin E, oleic acid, and essential minerals that are often lost in industrial refining. 
            Whether it's the rich aroma of our Gingelly Oil or the purity of our Coconut Oil, we bring the best of nature to your kitchen.
          </p>
          <ul className="space-y-4 text-slate-700 font-bold">
            <li className="flex items-center gap-3"><span className="text-emerald-500">✓</span> Good for Heart Health</li>
            <li className="flex items-center gap-3"><span className="text-emerald-500">✓</span> Boosts Immunity</li>
            <li className="flex items-center gap-3"><span className="text-emerald-500">✓</span> Natural Taste & Aroma</li>
          </ul>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4">
           {[1, 2, 3, 4].map(i => (
             <div key={i} className="aspect-square bg-slate-100 rounded-2xl overflow-hidden grayscale hover:grayscale-0 transition-all">
                <img src={`https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=500&sig=${i}`} alt="Gallery" className="w-full h-full object-cover" />
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: string; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-all group">
    <div className="text-5xl mb-6 group-hover:scale-110 transition-transform">{icon}</div>
    <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-500 font-medium">{desc}</p>
  </div>
);

export default Home;
