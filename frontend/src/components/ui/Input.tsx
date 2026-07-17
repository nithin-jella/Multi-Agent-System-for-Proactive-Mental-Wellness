import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, name, className = '', ...props }, ref) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Input] render', name);
  }
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Input] mount', name);
    }
    return () => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Input] unmount', name);
      }
    };
  }, [name]);
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        ref={ref}
        {...props}
        className={`w-full pl-3 pr-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-300 ${className}`}
      />
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
