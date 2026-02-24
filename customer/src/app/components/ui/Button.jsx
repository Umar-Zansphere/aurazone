import React from 'react';

const Button = ({ children, variant = 'primary', isLoading, className = '', ...props }) => {
  const baseStyles = "w-full py-4 rounded-full font-semibold transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 duration-300 transform";
  
  const variants = {
    primary: "bg-black text-white shadow-lg shadow-black/20 hover:bg-gray-800 hover:shadow-xl hover:shadow-black/30 active:shadow-md",
    accent: "bg-[var(--accent)] text-white shadow-lg shadow-[rgba(255,107,107,0.3)] hover:bg-[#FF5252] hover:shadow-xl hover:shadow-[rgba(255,107,107,0.4)] active:shadow-md",
    secondary: "bg-[var(--img-bg)] text-[var(--text-primary)] hover:bg-gray-300 shadow-sm hover:shadow-md",
    outline: "border-2 border-gray-200 text-[var(--text-primary)] hover:border-black hover:bg-gray-50 shadow-sm hover:shadow-md",
    ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent hover:bg-gray-100"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`} 
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
};

export default Button;