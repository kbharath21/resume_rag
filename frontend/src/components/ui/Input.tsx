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
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          style={{
            backgroundColor: 'var(--input)',
            color: 'var(--input-text)',
            borderColor: error ? '#ef4444' : 'var(--input-border)',
          }}
          className={`
            w-full px-4 py-3
            border rounded-lg
            transition-all duration-200
            focus:outline-none
            text-base
            disabled:opacity-50 disabled:cursor-not-allowed
            placeholder:opacity-70
            focus:ring-1
            ${
              error
                ? 'focus:border-red-500 focus:ring-red-500/30'
                : 'focus:border-purple-500 focus:ring-purple-500/30'
            }
            ${className || ''}
          `}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
