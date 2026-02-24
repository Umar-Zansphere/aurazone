import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = ({ label, icon: Icon, type = 'text', error, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="w-full space-y-2">
      {label && <label className="text-sm font-semibold text-(--text-primary) ml-1 block">{label}</label>}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--text-secondary) group-focus-within:text-(--accent) transition-colors duration-300">
            <Icon size={20} />
          </div>
        )}
        <input
          type={isPassword && showPassword ? 'text' : type}
          className={`w-full bg-(--card-bg) border-2 rounded-2xl py-4 ${Icon ? 'pl-12' : 'pl-4'} pr-12 text-(--text-primary) placeholder:text-gray-300 outline-none shadow-sm transition-all duration-300 ${
            error 
              ? 'border-(--accent) focus:border-(--accent) focus:shadow-accent' 
              : 'border-gray-200 focus:border-black/20 focus:shadow-md focus:ring-1 focus:ring-(--accent)/10'
          }`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-(--text-secondary) hover:text-(--text-primary) transition-colors duration-300"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && <p className="text-(--accent) text-xs ml-1 font-medium">{error}</p>}
    </div>
  );
};

export default Input;