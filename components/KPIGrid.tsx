import React from 'react';
import { Coins, Users, Clock } from 'lucide-react';
import { ProcessedInvoice } from '../types';

interface KPIGridProps {
  data: ProcessedInvoice[];
  fullDataCount: number; // To show deltas
  fullDataAmount: number;
}

const KPIGrid: React.FC<KPIGridProps> = ({ data, fullDataCount, fullDataAmount }) => {
  const overdueData = data.filter(d => d.Status === 'Overdue');
  
  const totalOverdue = overdueData.reduce((sum, item) => sum + item.Open_Amount, 0);
  const uniqueVendors = new Set(overdueData.map(d => d.Vendor_Name)).size;
  const allUniqueVendors = new Set(data.map(d => d.Vendor_Name)).size;
  
  const avgDays = overdueData.length > 0 
    ? overdueData.reduce((sum, item) => sum + item.Days_Overdue, 0) / overdueData.length 
    : 0;

  const Card = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg hover:shadow-gold-500/10 hover:border-gold-500/50 transition-all duration-300 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
        <Icon size={64} />
      </div>
      <div className="relative z-10">
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
          <Icon size={16} className={colorClass.replace('text-', 'text-opacity-80 text-')} />
          {title}
        </h3>
        <p className="text-3xl font-bold text-white font-cinzel tracking-wide mb-1">
          {value}
        </p>
        <p className="text-xs text-slate-500">
          {subtext}
        </p>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card 
        title="Total Overdue Amount" 
        value={`€${totalOverdue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        subtext={`from €${fullDataAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} Total Open`}
        icon={Coins}
        colorClass="text-red-500"
      />
      <Card 
        title="Unique Overdue Vendors" 
        value={uniqueVendors}
        subtext={`${allUniqueVendors} Total Vendors in view`}
        icon={Users}
        colorClass="text-blue-400"
      />
      <Card 
        title="Avg. Days Past Due" 
        value={`${avgDays.toFixed(1)} Days`}
        subtext="For overdue invoices"
        icon={Clock}
        colorClass="text-gold-500"
      />
    </div>
  );
};

export default KPIGrid;