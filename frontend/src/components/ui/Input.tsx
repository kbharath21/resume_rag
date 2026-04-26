import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-3 py-2.5 
            border border-gray-400 dark:border-gray-600 rounded
            transition-all duration-150
            focus:outline-none focus:ring-0 focus:border-gray-900 dark:focus:border-white
            bg-white dark:bg-gray-900
            text-gray-900 dark:text-white text-base
            placeholder:text-gray-600 dark:placeholder:text-gray-400
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800
            ${
              error
                ? 'border-red-600 focus:border-red-600 dark:border-red-500 dark:focus:border-red-500'
                : ''
            }
            ${className || ''}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
