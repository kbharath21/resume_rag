import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  sortBy,
  sortDirection,
  onSort,
  isLoading = false,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
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
        <p style={{ color: 'var(--muted)' }} className="text-lg">{emptyMessage}</p>
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
                <th key={column.key} className="px-4 py-3 text-left">
                  {column.sortable && onSort ? (
                    <button
                      onClick={() => onSort(column.key)}
                      style={{ color: 'var(--foreground)' }}
                      className="flex items-center gap-2 text-sm font-semibold hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    >
                      {column.header}
                      <span className="w-4 text-center">
                        {sortBy === column.key && (
                          <span className="text-purple-600 dark:text-purple-400">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </span>
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
                className="group"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 group-hover:opacity-90 transition-opacity">
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
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <p style={{ color: 'var(--muted)' }} className="text-sm">
          Showing {startItem} to {endItem} of {totalItems}
        </p>
        <div className="flex items-center gap-2">
          <label style={{ color: 'var(--muted)' }} className="text-sm">Per page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
            className="px-3 py-1 border rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            Previous
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                style={{
                  backgroundColor: currentPage === pageNum ? 'var(--primary)' : 'transparent',
                  color: currentPage === pageNum ? 'var(--primary-foreground)' : 'var(--foreground)',
                  borderColor: currentPage === pageNum ? 'var(--primary)' : 'var(--border)',
                }}
                className="px-3 py-1 rounded-lg text-sm font-medium border transition-all"
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
            className="px-3 py-1 border rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
