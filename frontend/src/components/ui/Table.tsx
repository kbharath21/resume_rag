import React from 'react';

interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  sortBy,
  sortDirection,
  onSort,
  isLoading = false,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
          color: 'var(--card-foreground)',
        }}
        className="rounded-lg border p-12 text-center"
      >
        <p style={{ color: 'var(--muted)' }} className="text-base">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
      }}
      className="rounded-lg border overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead
            style={{
              backgroundColor: 'var(--table-header)',
              borderColor: 'var(--border)',
            }}
            className="border-b"
          >
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-6 py-4 text-left">
                  {column.sortable && onSort ? (
                    <button
                      onClick={() => onSort(column.key)}
                      style={{ color: 'var(--foreground)' }}
                      className="flex items-center gap-2 text-sm font-semibold hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    >
                      {column.header}
                      {sortBy === column.key && (
                        <span className="text-purple-600 dark:text-purple-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--foreground)' }} className="text-sm font-semibold">
                      {column.header}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            style={{
              borderColor: 'var(--border)',
            }}
            className="divide-y"
          >
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                style={{
                  backgroundColor: 'var(--card)',
                }}
                className="hover:opacity-80 transition-opacity"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--table-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--card)';
                }}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4">
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Showing {startItem} to {endItem} of {totalItems}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          Previous
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentPage === p
                ? 'bg-purple-600 text-white'
                : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
