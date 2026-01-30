import React, { useState, useEffect, useRef } from 'react';
import { ProcessedInvoice, FilterState, VendorFile, VendorComment } from '../types';
import { Copy, Mail, Search, Upload, Download, Trash2, MessageSquare, Paperclip, Send } from 'lucide-react';
import {
  fetchVendorFiles, uploadVendorFile, downloadVendorFile, deleteVendorFile,
  fetchVendorComments, addVendorComment, deleteVendorComment,
} from '../services/api';

interface DataTableProps {
  data: ProcessedInvoice[];
  title: string;
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
}

// ===== Vendor Communications Panel =====
const VendorComms: React.FC<{ vendorName: string }> = ({ vendorName }) => {
  const [tab, setTab] = useState<'files' | 'comments'>('files');
  const [files, setFiles] = useState<VendorFile[]>([]);
  const [comments, setComments] = useState<VendorComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try {
      const f = await fetchVendorFiles(vendorName);
      setFiles(f);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  };
  const loadComments = async () => {
    try {
      const c = await fetchVendorComments(vendorName);
      setComments(c);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  };

  const retryConnection = async () => {
    setRetrying(true);
    await loadFiles();
    await loadComments();
    setRetrying(false);
  };

  useEffect(() => {
    setBackendOnline(null);
    loadFiles();
    loadComments();
  }, [vendorName]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadVendorFile(vendorName, file);
      await loadFiles();
    } catch { /* ignore */ }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (fileId: number) => {
    try {
      await deleteVendorFile(vendorName, fileId);
      await loadFiles();
    } catch { /* ignore */ }
  };

  const handleDownload = (fileId: number, filename: string) => {
    downloadVendorFile(vendorName, fileId, filename);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addVendorComment(vendorName, newComment.trim());
      setNewComment('');
      await loadComments();
    } catch { /* ignore */ }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteVendorComment(vendorName, commentId);
      await loadComments();
    } catch { /* ignore */ }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (backendOnline === null) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mt-4">
        <p className="text-slate-400 text-sm text-center">Loading vendor communications...</p>
      </div>
    );
  }

  if (!backendOnline) {
    return (
      <div className="bg-slate-800 border border-amber-700/50 rounded-xl p-4 mt-4">
        <div className="flex items-center justify-center gap-3">
          <p className="text-amber-400 text-sm">
            ⚠️ Cannot connect to the backend server.
          </p>
          <button
            onClick={retryConnection}
            disabled={retrying}
            className="bg-amber-700 hover:bg-amber-600 disabled:bg-slate-600 text-white text-xs px-3 py-1 rounded transition-colors"
          >
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-cinzel text-lg">
          Vendor Communications — <span className="text-gold-500">{vendorName}</span>
        </h3>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setTab('files')}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${
              tab === 'files' ? 'bg-gold-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Paperclip size={14} /> Files ({files.length})
          </button>
          <button
            onClick={() => setTab('comments')}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${
              tab === 'comments' ? 'bg-gold-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare size={14} /> Comments ({comments.length})
          </button>
        </div>
      </div>

      {/* FILES TAB */}
      {tab === 'files' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-gold-600 hover:bg-gold-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
            <span className="text-xs text-slate-500">Max 10MB per file</span>
          </div>

          {files.length === 0 ? (
            <p className="text-slate-500 text-sm italic">No files attached yet.</p>
          ) : (
            <div className="space-y-1">
              {files.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-2.5 border border-slate-700">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip size={14} className="text-gold-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{f.filename}</p>
                      <p className="text-xs text-slate-500">{formatSize(f.file_size)} · {formatDate(f.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <button
                      onClick={() => handleDownload(f.id, f.filename)}
                      className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMMENTS TAB */}
      {tab === 'comments' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-4 py-2 focus:border-gold-500 outline-none placeholder:text-slate-600"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="flex items-center gap-2 bg-gold-600 hover:bg-gold-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Send size={16} /> Add
            </button>
          </div>

          {comments.length === 0 ? (
            <p className="text-slate-500 text-sm italic">No comments yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {comments.map(c => (
                <div key={c.id} className="bg-slate-900 rounded-lg px-4 py-3 border border-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-300 text-sm">{c.comment}</p>
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-red-400 hover:text-red-300 transition-colors p-0.5 flex-shrink-0"
                      title="Delete comment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(c.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ===== Main DataTable Component =====
const DataTable: React.FC<DataTableProps> = ({ data, title, filterState, setFilterState }) => {
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

      {/* VENDOR COMMUNICATIONS - shows when a vendor is selected */}
      {filterState.selectedVendor && (
        <VendorComms vendorName={filterState.selectedVendor} />
      )}

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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-white font-cinzel text-lg">
            {title} ({data.length})
          </h3>
          <div className="flex items-center gap-2">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search Invoice # (e.g. 500* or *1234*)"
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-1.5 w-64 focus:border-gold-500 outline-none placeholder:text-slate-600"
              value={filterState.invoiceSearch}
              onChange={(e) => setFilterState(prev => ({ ...prev, invoiceSearch: e.target.value }))}
            />
            {filterState.invoiceSearch && (
              <button
                onClick={() => setFilterState(prev => ({ ...prev, invoiceSearch: '' }))}
                className="text-xs text-slate-500 hover:text-gold-500 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

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
