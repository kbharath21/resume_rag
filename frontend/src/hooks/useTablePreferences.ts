import { useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from '@/lib/api';
import { debounce } from '@/lib/debounce';

export type TableName = 'search_results' | 'saved_candidates' | 'job_postings' | 'my_applications';
export type SortDirection = 'asc' | 'desc';

export interface TablePreference {
  sort_by: string;
  sort_direction: SortDirection;
  filters: Record<string, string>;
  items_per_page: number;
  current_page: number;
}

interface UseTablePreferencesReturn {
  preferences: TablePreference;
  isLoading: boolean;
  updatePreferences: (updates: Partial<TablePreference>, immediate?: boolean) => Promise<void>;
  setSortBy: (sortBy: string) => void;
  setSortDirection: (direction: SortDirection) => void;
  setFilters: (filters: Record<string, string>) => void;
  setItemsPerPage: (itemsPerPage: number) => void;
  setCurrentPage: (page: number) => void;
}

const DEFAULT_PREFERENCES: Record<TableName, TablePreference> = {
  search_results: {
    sort_by: 'score',
    sort_direction: 'desc',
    filters: {},
    items_per_page: 10,
    current_page: 1,
  },
  saved_candidates: {
    sort_by: 'saved_at',
    sort_direction: 'desc',
    filters: {},
    items_per_page: 10,
    current_page: 1,
  },
  job_postings: {
    sort_by: 'created_at',
    sort_direction: 'desc',
    filters: {},
    items_per_page: 10,
    current_page: 1,
  },
  my_applications: {
    sort_by: 'sent_at',
    sort_direction: 'desc',
    filters: {},
    items_per_page: 10,
    current_page: 1,
  },
};

export const useTablePreferences = (tableName: TableName): UseTablePreferencesReturn => {
  const [preferences, setPreferences] = useState<TablePreference>(DEFAULT_PREFERENCES[tableName]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    
    const loadPreferences = async () => {
      setIsLoading(true);
      try {
        const response = await authApi.get('/preferences');
        
        if (!cancelled) {
          if (response.data.table_preferences && response.data.table_preferences[tableName]) {
            const tablePrefs = response.data.table_preferences[tableName];
            setPreferences(tablePrefs);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPreferences();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [tableName]);

  const saveToBackend = useCallback(
    async (prefs: TablePreference) => {
      await authApi.patch('/preferences/table', {
        table: tableName,
        ...prefs,
      });
    },
    [tableName]
  );

  const debouncedSave = useRef(
    debounce(async (tableName: TableName, prefs: TablePreference) => {
      await authApi.patch('/preferences/table', {
        table: tableName,
        ...prefs,
      });
    }, 500)
  ).current;

  const updatePreferences = useCallback(
    async (updates: Partial<TablePreference>, immediate = false) => {
      const updated = { ...preferences, ...updates };
      setPreferences(updated);
      
      if (immediate) {
        await saveToBackend(updated);
      } else {
        debouncedSave(tableName, updated);
      }
    },
    [preferences, tableName, debouncedSave, saveToBackend]
  );

  const setSortBy = useCallback(
    (sortBy: string) => {
      updatePreferences({ sort_by: sortBy });
    },
    [updatePreferences]
  );

  const setSortDirection = useCallback(
    (direction: SortDirection) => {
      updatePreferences({ sort_direction: direction });
    },
    [updatePreferences]
  );

  const setFilters = useCallback(
    (filters: Record<string, string>) => {
      updatePreferences({ filters, current_page: 1 });
    },
    [updatePreferences]
  );

  const setItemsPerPage = useCallback(
    (itemsPerPage: number) => {
      updatePreferences({ items_per_page: itemsPerPage, current_page: 1 }, true);
    },
    [updatePreferences]
  );

  const setCurrentPage = useCallback(
    (page: number) => {
      updatePreferences({ current_page: page }, true);
    },
    [updatePreferences]
  );

  return {
    preferences,
    isLoading,
    updatePreferences,
    setSortBy,
    setSortDirection,
    setFilters,
    setItemsPerPage,
    setCurrentPage,
  };
};
