import React, { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-md z-[100] relative animate-fade-in">
      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
      <span>You are currently offline — changes are saved locally and will sync once reconnected.</span>
    </div>
  );
}
