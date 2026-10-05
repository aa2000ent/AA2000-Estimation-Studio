import { useState } from 'react';
import type { AIScanGroup } from '../../App';
import AIScanGroupDetail from './AIScanGroupDetail';

interface Props {
  aiScans?: AIScanGroup[];
  onRenameAIScan?: (id: string, name: string) => void;
  onDeleteAIScan?: (id: string) => void;
  onUpdateAIScan?: (scan: AIScanGroup) => void;
}

export default function SavedFoldersView({
  aiScans = [],
  onRenameAIScan,
  onDeleteAIScan,
  onUpdateAIScan,
}: Props) {
  const [selectedScanGroup, setSelectedScanGroup] = useState<AIScanGroup | null>(null);

  if (selectedScanGroup) {
    const currentScan = aiScans.find(s => s.id === selectedScanGroup.id) || selectedScanGroup;
    return (
      <div className="p-6">
        <AIScanGroupDetail
          scan={currentScan}
          onBack={() => setSelectedScanGroup(null)}
          onRename={(id, newName) => {
            onRenameAIScan?.(id, newName);
            setSelectedScanGroup(prev => prev ? { ...prev, name: newName } : null);
          }}
          onDelete={(id) => {
            onDeleteAIScan?.(id);
            setSelectedScanGroup(null);
          }}
          onUpdateScan={(updated) => {
            onUpdateAIScan?.(updated);
            setSelectedScanGroup(updated);
          }}
        />
      </div>
    );
  }

  if (aiScans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl mb-4">
          📂
        </div>
        <h3 className="text-sm font-black text-slate-800 mb-1">No Saved AI Scan Folders</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
          Upload documents or specifications in the <strong>AI Document Reader</strong> tab and save your analysis to create AI scan folders.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            AI Scan Folders ({aiScans.length})
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Click any folder to inspect audited files, line items, and audit reports
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {aiScans.map(scan => {
          const fileCount = scan.files.length;
          const formattedDate = new Date(scan.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          });

          return (
            <div
              key={scan.id}
              onClick={() => setSelectedScanGroup(scan)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer flex items-start gap-4 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-xl shrink-0 group-hover:scale-105 transition-transform">
                📂
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black text-slate-800 truncate leading-snug">
                  {scan.name}
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                  {fileCount} file{fileCount !== 1 ? 's' : ''} audited
                </p>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                  {formattedDate}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
