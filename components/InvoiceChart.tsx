import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { ProcessedInvoice } from '../types';

interface InvoiceChartProps {
  data: ProcessedInvoice[];
  statusFilter: 'All Open' | 'Overdue Only' | 'Not Overdue Only';
  vendorGroup: string;
  onVendorClick: (vendorName: string | null) => void;
  selectedVendor: string | null;
}

interface ChartDataPoint {
  name: string;
  Overdue: number;
  NotOverdue: number;
  Total: number;
  [key: string]: any;
}

const InvoiceChart: React.FC<InvoiceChartProps> = ({ 
  data, 
  statusFilter, 
  vendorGroup, 
  onVendorClick,
  selectedVendor 
}) => {
  
  const chartData = useMemo(() => {
    // 1. Group by Vendor
    const grouped = data.reduce<Record<string, ChartDataPoint>>((acc, curr) => {
      if (!acc[curr.Vendor_Name]) {
        acc[curr.Vendor_Name] = { 
          name: curr.Vendor_Name, 
          Overdue: 0, 
          NotOverdue: 0, 
          Total: 0 
        };
      }
      if (curr.Status === 'Overdue') {
        acc[curr.Vendor_Name].Overdue += curr.Open_Amount;
      } else {
        acc[curr.Vendor_Name].NotOverdue += curr.Open_Amount;
      }
      acc[curr.Vendor_Name].Total += curr.Open_Amount;
      return acc;
    }, {});

    let result = Object.values(grouped);

    // 2. Filter / Sort based on Selection
    let sortKey = 'Total';
    if (statusFilter === 'Overdue Only') sortKey = 'Overdue';
    if (statusFilter === 'Not Overdue Only') sortKey = 'NotOverdue';

    if (vendorGroup === 'All Vendors') {
      // Show all vendors sorted by amount
      result = result.sort((a, b) => b[sortKey] - a[sortKey]);
    } else if (vendorGroup.startsWith("Top")) {
      const limit = parseInt(vendorGroup.split(" ")[1], 10);
      result = result.sort((a, b) => b[sortKey] - a[sortKey]).slice(0, limit);
    } else {
      // Specific Vendor selected in dropdown
      result = result.filter(r => r.name === vendorGroup);
    }

    // Sort ascending for vertical bar chart to show largest at top if we flipped axis, 
    // but for horizontal bars, largest at top usually means smallest Y index if array is ordered.
    // Recharts renders bottom-up for Y-axis category usually, let's reverse to put top items at top.
    return result.reverse();
  }, [data, vendorGroup, statusFilter]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs z-50">
          <p className="text-white font-bold mb-1">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.color }}>
              {p.name === 'NotOverdue' ? 'Not Overdue' : p.name}: €{p.value.toLocaleString()}
            </p>
          ))}
          <div className="border-t border-slate-700 mt-1 pt-1 text-slate-400">
             Total: €{((payload[0]?.payload?.Total || 0)).toLocaleString()}
          </div>
        </div>
      );
    }
    return null;
  };

  const handleClick = (data: any) => {
    if (data && data.activeLabel) {
        // Toggle selection
        if (selectedVendor === data.activeLabel) {
            onVendorClick(null);
        } else {
            onVendorClick(data.activeLabel);
        }
    }
  };

  // Calculate dynamic height based on number of items to prevent label overlap
  // 40px per item gives enough breathing room for labels
  const dynamicHeight = Math.max(500, chartData.length * 40);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col">
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="text-white font-cinzel text-lg">Vendor Balances</h3>
        <span className="text-xs text-slate-400 italic">Click a bar to filter details below</span>
      </div>
      
      {/* Scrollable container for the chart */}
      <div className="w-full overflow-y-auto overflow-x-hidden max-h-[800px] pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        <div style={{ height: `${dynamicHeight}px`, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              onClick={handleClick}
              cursor="pointer"
              barSize={20}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="#94a3b8" 
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
                orientation="top"
              />
              <YAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  width={150} 
                  tick={{fontSize: 11, fill: '#cbd5e1'}}
                  interval={0}
              />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                wrapperStyle={{ zIndex: 100 }}
              />
              <Legend verticalAlign="top" height={36}/>
              {(statusFilter === 'All Open' || statusFilter === 'Overdue Only') && (
                <Bar dataKey="Overdue" stackId="a" fill="#ef4444" name="Overdue" radius={[0, 4, 4, 0]} />
              )}
              {(statusFilter === 'All Open' || statusFilter === 'Not Overdue Only') && (
                <Bar dataKey="NotOverdue" stackId="a" fill="#3b82f6" name="Not Overdue" radius={[0, 4, 4, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default InvoiceChart;