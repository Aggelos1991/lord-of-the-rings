import React, { useState } from 'react';
import { ProcessedInvoice } from '../types';
import { Copy, Mail } from 'lucide-react';

interface DataTableProps {
  data: ProcessedInvoice[];
  title: string;
}

const DataTable: React.FC<DataTableProps> = ({ data, title }) => {
  const [copied, setCopied] = useState(false);

  const uniqueEmails = Array.from(new Set(
    data.flatMap(d => [d.Vendor_Email, d.Account_Email])
      .filter(e => e && e.includes('@'))
      .map(e => e.toLowerCase().trim())
  )).sort();

  const handleCopyEmails = () => {
    navigator.clipboard.writeText(uniqueEmails.join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (data.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500 mt-6">
        No invoices match the current selection.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* EMAIL SECTION */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-cinzel text-lg flex items-center gap-2">
            <Mail size={20} className="text-gold-500" />
            The Messenger's Scroll
          </h3>
          <button
            onClick={handleCopyEmails}
            className="flex items-center gap-2 bg-slate-700 hover:bg-gold-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Copy size={16} />
            {copied ? "Copied!" : "Copy All Emails"}
          </button>
        </div>
        <div className="bg-slate-950 rounded-lg p-3 text-xs text-slate-400 font-mono h-24 overflow-y-auto break-all border border-slate-800">
          {uniqueEmails.join('; ')}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {uniqueEmails.length} unique recipients ready for dispatch.
        </p>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg overflow-hidden">
        <h3 className="text-white font-cinzel text-lg mb-4">
          {title} ({data.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-900 text-slate-200 uppercase font-medium text-xs">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">CN #</th>
                <th className="px-4 py-3 text-right">CN €</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">BS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-700">
              {data.slice(0, 100).map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-700/50 transition-colors ${
                    row.CN_Amount && row.CN_Amount > 0 ? "bg-purple-900/10" : ""
                  }`}
                >
                  <td className="px-4 py-2 font-medium text-white truncate max-w-[200px]" title={row.Vendor_Name}>
                    {row.Vendor_Name}
                  </td>

                  <td className="px-4 py-2 font-mono text-xs text-slate-300 truncate max-w-[160px]" title={row.Invoice_Number}>
                    {row.Invoice_Number || '-'}
                  </td>

                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.Due_Date?.toLocaleDateString()}
                  </td>

                  <td className="px-4 py-2 text-right text-slate-200 font-mono">
                    €{row.Open_Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* CN Number */}
                  <td className="px-4 py-2 text-purple-300 font-mono">
                    {row.CN_Number || "-"}
                  </td>

                  {/* CN Amount */}
                  <td className="px-4 py-2 text-right text-purple-400 font-mono">
                    {row.CN_Amount ? `€${row.CN_Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                  </td>

                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      row.Status === 'Overdue'
                        ? 'bg-red-900/50 text-red-200 border border-red-800'
                        : 'bg-blue-900/50 text-blue-200 border border-blue-800'
                    }`}>
                      {row.Status}
                    </span>
                  </td>

                  <td className="px-4 py-2">
                    {row.Days_Overdue > 0 ? (
                      <span className="text-red-400 font-bold">{row.Days_Overdue}</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-4 py-2 truncate max-w-[100px]" title={row.Vendor_Type}>
                    {row.Vendor_Type}
                  </td>

                  <td className="px-4 py-2 truncate max-w-[120px]" title={row.Col_BS}>
                    {row.Col_BS}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.length > 100 && (
          <div className="text-center text-xs text-slate-500 mt-4 italic">
            Showing first 100 of {data.length} records.
          </div>
        )}

      </div>
    </div>
  );
};

export default DataTable;
