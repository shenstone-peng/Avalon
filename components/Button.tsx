import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "relative font-cinzel font-bold py-3 px-6 rounded-lg shadow-md transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600",
    danger: "bg-red-800 hover:bg-red-700 text-red-100 border border-red-600",
    ghost: "bg-transparent hover:bg-slate-800/50 text-slate-300 border border-transparent",
    gold: "bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 border-2 border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {/* Shine effect for gold buttons */}
      {variant === 'gold' && (
        <div className="absolute top-0 left-0 w-full h-full bg-white/20 -skew-x-12 translate-x-[-150%] animate-[shimmer_2s_infinite]"></div>
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};
