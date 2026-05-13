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
  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          color: '#dc2626'
        };
      case 'success':
        return {
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          borderColor: 'rgba(22, 163, 74, 0.3)',
          color: 'var(--success)'
        };
      case 'warning':
        return {
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          borderColor: 'rgba(234, 179, 8, 0.3)',
          color: '#ca8a04'
        };
      case 'info':
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          color: '#2563eb'
        };
    }
  };

  return (
    <div
      role="alert"
      className="border px-4 py-3 rounded-lg flex items-start justify-between"
      style={getTypeStyles()}
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
