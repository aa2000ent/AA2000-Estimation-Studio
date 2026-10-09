const FILE_TYPE_COLORS: Record<string, string> = {
  PDF: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  PNG: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  JPG: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  DOCX: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
};

export default function FileTypeBadges({ types }: { types: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" aria-label={`Accepted file types: ${types.join(', ')}`}>
      {types.map(type => (
        <span
          key={type}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-black tracking-wide ${FILE_TYPE_COLORS[type] || 'border-slate-200 bg-slate-50 text-slate-600'}`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 1.75h6l4 4v8.5H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M9 1.75v4h4M5 9h6M5 11.5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          {type}
        </span>
      ))}
    </div>
  );
}

const FILE_TYPE_ICON_COLORS: Record<string, string> = {
  PDF: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  PNG: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  JPG: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  DOCX: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
};

export function FileTypeIcon({ fileName }: { fileName: string }) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const type = extension === 'jpeg' ? 'JPG' : extension.toUpperCase();
  const color = FILE_TYPE_ICON_COLORS[type] || 'border-slate-200 bg-slate-50 text-slate-500';

  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border ${color}`}
      role="img"
      aria-label={`${type || 'File'} file`}
    >
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 1.75h6l4 4v8.5H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M9 1.75v4h4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
      <span className="text-[7px] font-black leading-none">{type}</span>
    </span>
  );
}
