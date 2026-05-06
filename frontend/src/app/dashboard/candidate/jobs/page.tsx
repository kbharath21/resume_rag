'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Alert } from '@/components/ui/Alert';
import { searchApi } from '@/lib/api';
import { BriefcaseIcon, MapPinIcon, CurrencyDollarIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useTablePreferences } from '@/hooks/useTablePreferences';

interface Application {
  id: number;
  job_posting_id: number;
  company_name: string;
  role_title: string;
  department: string | null;
  location: string | null;
  salary_range: string | null;
  apply_link: string | null;
  description: string;
  contacted_at: string;
  opened_at: string | null;
  hr_email: string | null;
  hr_name: string | null;
}

export default function JobsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { preferences, isLoading: prefsLoading, setCurrentPage, setItemsPerPage, updatePreferences } = useTablePreferences('my_applications');

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const response = await searchApi.get('/my_applications');
      setApplications(response.data.applications || []);
      setTotal(response.data.total || 0);
      setPages(response.data.pages || 0);
    } catch (error) {
      const apiError = error as { response?: { data?: { detail?: string } } };
      setError(apiError.response?.data?.detail || 'Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!prefsLoading) {
      fetchApplications();
    }
  }, [preferences.current_page, preferences.sort_by, preferences.sort_direction, preferences.items_per_page, prefsLoading]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSort = (column: string) => {
    if (preferences.sort_by === column) {
      updatePreferences({ sort_direction: preferences.sort_direction === 'asc' ? 'desc' : 'asc' }, true);
    } else {
      updatePreferences({ sort_by: column, sort_direction: 'asc' }, true);
    }
  };

  if (isLoading || prefsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Job Opportunities</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Companies that have reached out to you based on your profile
          </p>
        </div>

        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={() => setError('')}
          />
        )}

        {applications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-12 text-center">
            <BriefcaseIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No opportunities yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Companies will reach out to you when they find your profile interesting.
              Make sure your resume and profile are up to date!
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <p className="text-sm text-purple-800 dark:text-purple-300">
                <strong>{total}</strong> {total === 1 ? 'company has' : 'companies have'} reached out to you
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-purple-800 dark:text-purple-300">Sort by:</span>
                <button
                  onClick={() => handleSort('sent_at')}
                  className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded text-sm font-medium text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                >
                  Date Contacted
                  {preferences.sort_by === 'sent_at' && (
                    <span>{preferences.sort_direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </div>
            </div>

            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{app.role_title}</h3>
                    <p className="text-lg text-gray-700 dark:text-gray-300 mt-1">{app.company_name}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      Contacted {formatDate(app.contacted_at)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {app.department && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <BriefcaseIcon className="w-5 h-5 mr-2" />
                      <span>{app.department}</span>
                    </div>
                  )}
                  {app.location && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <MapPinIcon className="w-5 h-5 mr-2" />
                      <span>{app.location}</span>
                    </div>
                  )}
                  {app.salary_range && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                      <span>{app.salary_range}</span>
                    </div>
                  )}
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-4">{app.description}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {app.hr_name && (
                      <p>Contact: {app.hr_name} ({app.hr_email})</p>
                    )}
                  </div>
                  {app.apply_link && (
                    <a
                      href={app.apply_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      View Details & Apply
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((preferences.current_page - 1) * preferences.items_per_page) + 1} to {Math.min(preferences.current_page * preferences.items_per_page, total)} of {total} opportunities
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">Per page:</label>
                  <select
                    value={preferences.items_per_page}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(preferences.current_page - 1)}
                  disabled={preferences.current_page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (pages <= 5) {
                    pageNum = i + 1;
                  } else if (preferences.current_page <= 3) {
                    pageNum = i + 1;
                  } else if (preferences.current_page >= pages - 2) {
                    pageNum = pages - 4 + i;
                  } else {
                    pageNum = preferences.current_page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        preferences.current_page === pageNum
                          ? 'bg-purple-600 text-white'
                          : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(preferences.current_page + 1)}
                  disabled={preferences.current_page === pages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
