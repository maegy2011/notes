import React from 'react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="absolute bottom-16 left-4 right-4 z-50 flex justify-center pointer-events-none animate-fadeIn">
      <div className="bg-slate-800 text-slate-100 text-xs px-4 py-2.5 rounded-full shadow-xl border border-slate-700 max-w-xs text-center font-medium tracking-tight">
        {message}
      </div>
    </div>
  );
};
