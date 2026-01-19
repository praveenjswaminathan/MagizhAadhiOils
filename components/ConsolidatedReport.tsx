
import React, { useMemo, useState } from 'react';
import { AppState, ReturnType } from '../types';
import { calculateOutstanding, getInventoryMetrics } from '../db';

const ConsolidatedReport: React.FC<{ state: AppState }> = ({ state }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // Business Analytics Data
  const reportData = useMemo(() => {
    // 1. Pricing Pivot
    const priceDates: string[] = Array.from(new Set<string>(state.priceHistory.map(ph => ph.effectiveDate))).filter(d => !!d).sort();
    const pricingMatrix = state.products.map(p => {
        const row: any = { name: p.name.split(' (')[0] };
        priceDates.forEach(date => {
            const entry = state.priceHistory
                .filter(ph => ph.productId === p.id && ph.effectiveDate <= date)
                .sort((a, b) => (b.effectiveDate || '').localeCompare(a.effectiveDate || ''))[0];
            row[date] = entry ? entry.unitPrice : '-';
        });
        return row;
    });

    // 2. Global Business Stats
    const totalSoldVol = state.saleLines.reduce((s, l) => s + (l.qtyL || 0), 0);
    const totalRetVol = state.returns.reduce((s, r) => s + (r.qty || 0), 0);
    const totalSoldVal = state.saleLines.reduce((s, l) => s + ((l.qtyL || 0) * (l.unitPrice || 0)), 0);
    const totalRetVal = state.returns.reduce((s, r) => s + ((r.qty || 0) * (r.unitPriceAtReturn || 0)), 0);
    const netBusinessValue = totalSoldVal - totalRetVal;

    const inventoryMetrics = state.products.map(p => getInventoryMetrics(state, 'all', p.id));
    const totalAssetVal = inventoryMetrics.reduce((s, m) => s + (m.value || 0), 0);
    const totalStockQty = inventoryMetrics.reduce((s, m) => s + (m.qty || 0), 0);

    const totalDues = state.customers.reduce((sum, c) => {
        const out = calculateOutstanding(state, c.id);
        return sum + (out > 0 ? out : 0);
    }, 0);

    // 3. Client Deep Dives
    const clients = state.customers.map(c => {
      const balance = calculateOutstanding(state, c.id);
      const productConsumption: { [productId: string]: number } = {};
      state.products.forEach(p => productConsumption[p.id] = 0);
      
      const rawHistory: any[] = [];
      
      // CONSOLIDATED SALES: Group by Sale Invoice
      state.sales.filter(s => s.customerId === c.id).forEach(s => {
        const saleLines = state.saleLines.filter(sl => sl.saleId === s.id && sl.qtyL > 0);
        if (saleLines.length === 0) return;

        // Build consolidated description: Product (QtyL @ Rate)
        const descriptionParts = saleLines.map(sl => {
            const pName = state.products.find(p => p.id === sl.productId)?.name.split(' (')[0].split(' ')[0] || 'Oil';
            return `${pName} (${sl.qtyL}L @ ₹${sl.unitPrice})`;
        });

        const saleTotal = saleLines.reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
        
        // Track product consumption for stats
        saleLines.forEach(sl => {
            productConsumption[sl.productId] = (productConsumption[sl.productId] || 0) + sl.qtyL;
        });

        rawHistory.push({
            date: s.saleDate || 'N/A',
            type: 'SALE',
            ref: s.saleNo || 'N/A',
            item: descriptionParts.join(', '),
            qty: null, 
            rate: null,
            debit: saleTotal,
            credit: 0
        });
      });
      
      // PAYMENTS & REFUNDS
      state.payments.filter(p => p.customerId === c.id).forEach(p => {
        if (p.type === 'REFUND') {
            rawHistory.push({
                date: p.paymentDate || 'N/A',
                type: 'REFUND',
                ref: p.mode || 'Ref',
                item: `Outward Refund (${p.reference || 'Bank'})`,
                qty: null,
                rate: null,
                debit: p.amount || 0,
                credit: 0
            });
        } else {
            rawHistory.push({
                date: p.paymentDate || 'N/A',
                type: 'PAYMENT',
                ref: p.mode || 'Pay',
                item: p.reference || 'Bank Transfer',
                qty: null,
                rate: null,
                debit: 0,
                credit: p.amount || 0
            });
        }
      });

      // RETURNS
      state.returns.filter(r => r.customerId === c.id && r.type === ReturnType.CUSTOMER).forEach(r => {
        productConsumption[r.productId] = (productConsumption[r.productId] || 0) - (r.qty || 0);
        const pName = state.products.find(p => p.id === r.productId)?.name.split(' (')[0].split(' ')[0] || 'Oil';
        rawHistory.push({
          date: r.date || 'N/A',
          type: 'RETURN',
          ref: 'Credit',
          item: `Return: ${pName} (${r.qty}L @ ₹${r.unitPriceAtReturn})`,
          qty: r.qty,
          rate: r.unitPriceAtReturn,
          debit: 0,
          credit: (r.qty || 0) * (r.unitPriceAtReturn || 0)
        });
      });

      // Calculate running balance
      const sortedHistory = [...rawHistory].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      let rb = 0;
      const ledgerWithBalance = sortedHistory.map(h => {
          rb = rb + (h.debit || 0) - (h.credit || 0);
          return { ...h, runningBalance: rb };
      });

      const totalVolume = Object.values(productConsumption).reduce((s, v) => s + Math.max(0, v), 0);
      const totalPurchasedValue = rawHistory.reduce((s, h) => s + (h.type === 'SALE' ? h.debit : 0), 0);
      const totalReturnedValue = rawHistory.reduce((s, h) => s + (h.type === 'RETURN' ? h.credit : 0), 0);
      
      return { 
        ...c, 
        balance, 
        totalVolume, 
        totalValue: totalPurchasedValue - totalReturnedValue,
        productConsumption, 
        ledger: ledgerWithBalance 
      };
    }).sort((a, b) => b.totalValue - a.totalValue);

    return { 
        priceDates, 
        pricingMatrix, 
        totalSoldVol, 
        totalRetVol, 
        netBusinessValue, 
        totalAssetVal, 
        totalStockQty, 
        totalDues, 
        totalRetVal,
        clients 
    };
  }, [state]);

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    const element = document.getElementById('report-content');
    
    const opt = {
      margin: 10,
      filename: `MagizhAadhi_MasterReport_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    // @ts-ignore
    window.html2pdf().set(opt).from(element).save().then(() => {
      setIsGenerating(false);
    }).catch(err => {
      console.error("PDF generation error:", err);
      setIsGenerating(false);
      alert("Failed to generate PDF. The content might be too large for the browser to process at once.");
    });
  };

  return (
    <div className="bg-slate-100 min-h-screen pb-20">
      <div className="max-w-5xl mx-auto py-8 px-4 flex justify-between items-center sticky top-0 bg-slate-100/90 backdrop-blur-md z-50 border-b mb-6 print:hidden">
        <div className="flex items-center gap-3">
            <div className="bg-emerald-900 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black italic shadow-lg">MA</div>
            <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase italic leading-none">Master Report</h1>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Magizh Aadhi Enterprise Hub</p>
            </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => window.history.back()} className="text-[10px] font-black uppercase text-slate-400 hover:text-emerald-700 tracking-widest transition-colors">← Exit</button>
          <button 
            onClick={handleDownloadPDF} 
            disabled={isGenerating}
            className="bg-emerald-950 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50 border border-emerald-800"
          >
            {isGenerating ? 'Generating PDF...' : 'Download Master Report'}
          </button>
        </div>
      </div>

      <div id="report-content" className="bg-white mx-auto max-w-[800px] print:max-w-none">
        
        {/* PAGE 1: PRICING MATRIX */}
        <section className="p-12 min-h-[277mm] flex flex-col page-break-after-always">
          <div className="flex justify-between items-start mb-12 border-b-4 border-emerald-950 pb-8">
            <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-emerald-950 rounded-[24px] flex items-center justify-center text-white text-4xl font-black italic shadow-2xl border-4 border-emerald-800/50">MA</div>
                 <div>
                    <h1 className="text-4xl font-black text-emerald-950 uppercase italic tracking-tighter leading-none">Magizh Aadhi</h1>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em] mt-2">Authentic Wood-Pressed Oils</p>
                 </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black uppercase text-slate-300 tracking-[0.2em] mb-1">Document Ref</p>
              <p className="text-xl font-black italic text-emerald-950 leading-none">MASTER/REP/{new Date().getFullYear()}</p>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-black italic text-slate-800 tracking-tighter uppercase border-l-8 border-emerald-500 pl-6">I. Pricing Timeline & Rate Matrix</h2>
          </div>

          <div className="overflow-x-auto border-2 border-slate-50 rounded-[24px] shadow-inner bg-slate-50/30">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-emerald-950 text-white text-[8px] font-black uppercase tracking-widest">
                  <th className="py-5 px-6 rounded-tl-[24px]">Product Identity</th>
                  {reportData.priceDates.map(date => <th key={date} className="py-5 px-4 text-center">{date}</th>)}
                  <th className="py-5 px-6 text-right bg-emerald-500 text-emerald-950 rounded-tr-[24px]">Current Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {reportData.pricingMatrix.map((row, i) => (
                  <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-4 px-6 font-black text-slate-700 text-[10px] leading-tight">{row.name}</td>
                    {reportData.priceDates.map(date => (
                        <td key={date} className="py-4 px-4 text-center font-bold text-slate-400 text-[10px]">₹{row[date]}</td>
                    ))}
                    <td className="py-4 px-6 text-right font-black text-emerald-800 text-base italic tracking-tighter">₹{row[reportData.priceDates[reportData.priceDates.length - 1]]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-auto pt-8 text-[8px] text-slate-300 font-black uppercase tracking-widest italic flex justify-between">
            <span>Confidential Business Intelligence</span>
            <span>Generated on {new Date().toLocaleDateString()}</span>
          </div>
        </section>

        {/* PAGE 2: EXECUTIVE DASHBOARD */}
        <section className="p-12 min-h-[277mm] flex flex-col page-break-after-always">
          <div className="mb-10 border-b-2 border-slate-100 pb-6">
            <h2 className="text-2xl font-black italic text-slate-800 tracking-tighter uppercase border-l-8 border-emerald-500 pl-6">II. Executive Performance Dashboard</h2>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-10">
            <div className="bg-emerald-50 p-6 rounded-[32px] border-2 border-emerald-100">
                <p className="text-[8px] font-black text-emerald-800/50 uppercase tracking-widest mb-1">Net Business Value</p>
                <p className="text-3xl font-black italic text-emerald-950 tracking-tighter leading-none">₹{reportData.netBusinessValue.toLocaleString()}</p>
                <p className="text-[7px] font-bold text-emerald-600 mt-2 uppercase">Sales - Returns</p>
            </div>
            <div className="bg-slate-900 p-6 rounded-[32px] text-white">
                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Asset Value</p>
                <p className="text-3xl font-black italic text-white tracking-tighter leading-none">₹{reportData.totalAssetVal.toLocaleString()}</p>
                <p className="text-[7px] font-bold text-emerald-400/50 mt-2 uppercase">Current Stock</p>
            </div>
            <div className="bg-rose-50 p-6 rounded-[32px] border-2 border-rose-100">
                <p className="text-[8px] font-black text-rose-800/50 uppercase tracking-widest mb-1">Global Receivables</p>
                <p className="text-3xl font-black italic text-rose-950 tracking-tighter leading-none">₹{reportData.totalDues.toLocaleString()}</p>
                <p className="text-[7px] font-bold text-rose-600 mt-2 uppercase">Outstanding</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">Business Vital Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                    <StatItem label="Client Base" val={state.customers.length} unit="Accounts" />
                    <StatItem label="Invoices" val={state.sales.length} unit="Processed" />
                    <StatItem label="Liters Sold" val={reportData.totalSoldVol} unit="Liters" />
                    <StatItem label="Liters Ret." val={reportData.totalRetVol} unit="Liters" color="text-rose-600" />
                    <StatItem label="Total Hubs" val={state.hubs.length} unit="Units" />
                    <StatItem label="Return Val." val={`₹${reportData.totalRetVal.toLocaleString()}`} unit="INR" color="text-rose-600" />
                </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-[32px] border">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 border-b pb-2">Top 10 Clients</h3>
                <div className="space-y-2">
                    {reportData.clients.slice(0, 10).map((c, i) => (
                        <div key={c.id} className="flex justify-between items-center text-[10px]">
                            <span className="font-black text-slate-700 truncate mr-4">{i+1}. {c.name}</span>
                            <span className="font-black text-emerald-800 shrink-0 italic">₹{c.totalValue.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
          
          <div className="mt-auto pt-8 text-[8px] text-slate-300 font-black uppercase tracking-widest italic flex justify-between">
            <span>Magizh Aadhi Analytics Engine</span>
            <span>Dashboard Summary</span>
          </div>
        </section>

        {/* PAGE 3: STOCK & LOGISTICS */}
        <section className="p-12 min-h-[277mm] flex flex-col page-break-after-always">
          <div className="mb-10 border-b-2 border-slate-100 pb-6">
            <h2 className="text-2xl font-black italic text-slate-800 tracking-tighter uppercase border-l-8 border-emerald-500 pl-6">III. Global Stock & Logistics Log</h2>
          </div>

          <div className="bg-white border-2 border-slate-50 rounded-[24px] shadow-sm mb-10 overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-emerald-950 text-white text-[8px] font-black uppercase tracking-widest">
                    <tr><th className="py-4 px-6">Product</th>{state.hubs.map(h => <th key={h.id} className="py-4 px-4 text-center">{h.name.split(' ')[0]}</th>)}<th className="py-4 px-6 text-right bg-emerald-500 text-emerald-950">Net Stock</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {state.products.map(p => {
                        const m = getInventoryMetrics(state, 'all', p.id);
                        return (
                            <tr key={p.id} className="text-[10px]">
                                <td className="py-3 px-6 font-black text-slate-700 leading-tight">{p.name.split(' (')[0]}</td>
                                {state.hubs.map(h => (
                                    <td key={h.id} className="py-3 px-4 text-center font-bold text-slate-400">{getInventoryMetrics(state, h.id, p.id).qty}L</td>
                                ))}
                                <td className="py-3 px-6 text-right font-black text-emerald-800 italic">{m.qty}L</td>
                            </tr>
                        );
                    })}
                </tbody>
             </table>
          </div>

          <div className="flex-grow">
             <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 border-b pb-2">Recent Batch Receptions</h3>
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[8px] font-black uppercase text-slate-400 tracking-widest">
                    <tr><th className="py-3 px-6">Date</th><th className="py-3 px-6">Batch No</th><th className="py-3 px-6">Source Hub</th><th className="py-3 px-6 text-right">Volume</th><th className="py-3 px-6 text-right">Batch Val</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {[...state.consignments].sort((a,b) => (b.receiveDate || '').localeCompare(a.receiveDate || '')).slice(0, 10).map(c => {
                        const lines = state.consignmentLines.filter(l => l.consignmentId === c.id);
                        const vol = lines.reduce((s,l) => s + (l.qtyL || 0), 0);
                        const val = lines.reduce((s,l) => s + ((l.qtyL || 0) * (l.unitPrice || 0)), 0);
                        return (
                            <tr key={c.id} className="text-[9px]">
                                <td className="py-3 px-6 font-bold text-slate-400 italic">{c.receiveDate}</td>
                                <td className="py-3 px-6 font-black text-slate-800">{c.consignmentNo}</td>
                                <td className="py-3 px-6 font-bold text-slate-500">{state.hubs.find(h => h.id === c.toHubId)?.name.split(' ')[0] || 'N/A'}</td>
                                <td className="py-3 px-6 text-right font-black text-slate-700">{vol}L</td>
                                <td className="py-3 px-6 text-right font-black text-emerald-800">₹{val.toLocaleString()}</td>
                            </tr>
                        );
                    })}
                </tbody>
             </table>
          </div>

          <div className="mt-auto pt-8 text-[8px] text-slate-300 font-black uppercase tracking-widest italic flex justify-between">
            <span>Inventory Integrity Audit</span>
            <span>Batch Tracking Section</span>
          </div>
        </section>

        {/* CLIENT STATEMENT PAGES */}
        {reportData.clients.map((c, idx) => (
          <section key={c.id} className="p-12 min-h-[277mm] flex flex-col page-break-before-always">
            <div className="flex justify-between items-end mb-10 border-b-2 border-slate-100 pb-6">
              <div>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1 italic">IV. Client Ledger Statement</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter italic leading-none">{c.salutation} {c.name}</h3>
                <p className="text-slate-400 font-bold mt-1 text-xs tracking-tight">{c.phone || 'No direct contact registered'}</p>
              </div>
              <div className="text-right">
                  <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Current Outstanding</p>
                  <p className={`text-3xl font-black italic tracking-tighter ${c.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    ₹{c.balance.toLocaleString()}
                  </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
                <MiniStat label="Net Purchased" val={`₹${c.totalValue.toLocaleString()}`} />
                <MiniStat label="Liters Bought" val={`${c.totalVolume}L`} />
                <div className="bg-slate-50 p-4 rounded-2xl border col-span-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Product Breakdown</p>
                    <div className="flex flex-wrap gap-1">
                        {state.products.map(p => {
                            const vol = c.productConsumption[p.id] || 0;
                            if (vol <= 0) return null;
                            return (
                                <span key={p.id} className="text-[7px] font-black bg-white px-2 py-1 rounded-lg border uppercase whitespace-nowrap">
                                    {p.name.split(' (')[0].split(' ')[0]}: {vol}L
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex-grow">
                <table className="w-full text-left">
                  <thead className="bg-emerald-950 text-white text-[8px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="py-4 px-4 rounded-tl-2xl">Date</th>
                      <th className="py-4 px-4">Ref</th>
                      <th className="py-4 px-4">Consolidated Description</th>
                      <th className="py-4 px-4 text-right">Debit</th>
                      <th className="py-4 px-4 text-right">Credit</th>
                      <th className="py-4 px-4 text-right rounded-tr-2xl bg-emerald-900">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-x">
                    {c.ledger.map((h, i) => (
                      <tr key={i} className="text-[9px] page-break-inside-avoid">
                        <td className="py-3 px-4 font-bold text-slate-400 italic">{h.date}</td>
                        <td className="py-3 px-4 font-black text-slate-900">{h.ref}</td>
                        <td className="py-3 px-4 text-slate-500 font-bold leading-tight max-w-[250px]">
                            {h.item}
                            {h.type === 'REFUND' && <span className="ml-2 bg-amber-100 text-amber-700 text-[6px] font-black px-1 py-0.5 rounded-sm">Refund</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">{h.debit > 0 ? `₹${h.debit.toLocaleString()}` : '-'}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700">{h.credit > 0 ? `₹${h.credit.toLocaleString()}` : '-'}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 italic bg-slate-50/50">₹{h.runningBalance.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-emerald-50/50 font-black">
                    <tr className="text-[10px] page-break-inside-avoid">
                        <td colSpan={4} className="py-4 px-4 text-right text-[8px] uppercase tracking-widest text-emerald-800 opacity-60 italic">Closing Balance</td>
                        <td colSpan={2} className={`py-4 px-4 text-right text-base italic tracking-tighter ${c.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            ₹{c.balance.toLocaleString()} {c.balance > 0 ? 'DUE' : 'CR'}
                        </td>
                    </tr>
                  </tfoot>
                </table>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 text-[8px] text-slate-300 font-black uppercase tracking-widest italic flex justify-between">
              <span>Verified Ledger Extract</span>
              <span>Account {idx + 1} of {reportData.clients.length}</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

const StatItem = ({ label, val, unit, color = "text-slate-800" }: any) => (
    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-tight">{label}</p>
        <p className={`text-lg font-black italic tracking-tighter leading-none ${color}`}>{val}</p>
        <p className="text-[6px] font-bold text-slate-300 mt-1 uppercase tracking-wider">{unit}</p>
    </div>
);

const MiniStat = ({ label, val }: any) => (
    <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50 flex flex-col justify-center">
        <p className="text-[7px] font-black text-emerald-800 uppercase tracking-widest mb-1 leading-tight">{label}</p>
        <p className="text-base font-black italic text-emerald-950 leading-tight">{val}</p>
    </div>
);

export default ConsolidatedReport;
