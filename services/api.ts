const API_BASE = 'https://ledger-api.46-62-134-239.sslip.io/api';

// === Types ===
export interface VendorFile {
  id: number;
  vendor_name: string;
  filename: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface VendorComment {
  id: number;
  vendor_name: string;
  comment: string;
  created_at: string;
}

// === File API ===

export async function fetchVendorFiles(vendorName: string): Promise<VendorFile[]> {
  const res = await fetch(`${API_BASE}/vendors/${encodeURIComponent(vendorName)}/files`);
  if (!res.ok) throw new Error('Failed to fetch files');
  return res.json();
}

export async function uploadVendorFile(vendorName: string, file: File): Promise<VendorFile> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/vendors/${encodeURIComponent(vendorName)}/files`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload file');
  return res.json();
}

export async function downloadVendorFile(vendorName: string, fileId: number, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/vendors/${encodeURIComponent(vendorName)}/files/${fileId}/download`);
  if (!res.ok) throw new Error('Failed to download file');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function deleteVendorFile(vendorName: string, fileId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/vendors/${encodeURIComponent(vendorName)}/files/${fileId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete file');
}

// === Comment API ===

export async function fetchVendorComments(vendorName: string): Promise<VendorComment[]> {
  const res = await fetch(`${API_BASE}/vendors/${encodeURIComponent(vendorName)}/comments`);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

export async function addVendorComment(vendorName: string, comment: string): Promise<VendorComment> {
  const res = await fetch(`${API_BASE}/vendors/${encodeURIComponent(vendorName)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error('Failed to add comment');
  return res.json();
}

export async function deleteVendorComment(vendorName: string, commentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/vendors/${encodeURIComponent(vendorName)}/comments/${commentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete comment');
}
