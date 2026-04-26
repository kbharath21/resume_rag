import { ReactNode } from 'react';

interface AlertProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  onDismiss?: () => void;
  children?: ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  message,
  onDismiss,
  children,
}) => {
  const typeStyles = {
    error: 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
    success: 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200',
    warning: 'bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
  };

  return (
    <div
      role="alert"
      className={`
        border px-4 py-3 rounded flex items-start justify-between
        ${typeStyles[type]}
      `}
    >
      <div className="flex-1">
        <p className="font-medium text-sm">{message}</p>
        {children && <div className="mt-1 text-sm">{children}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 text-lg font-bold hover:opacity-70 transition-opacity"
          aria-label="Dismiss alert"
        >
          ×
        </button>
      )}
    </div>
  );
};
