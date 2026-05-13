'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { searchApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTablePreferences } from '@/hooks/useTablePreferences';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';

interface JobPosting {
  id: number;
  company_name: string;
  role_title: string;
  department: string | null;
  description: string;
  location: string | null;
  salary_range: string | null;
  apply_link: string | null;
  is_active: boolean;
  created_at: string;
}

interface CreateJobForm {
  company_name: string;
  role_title: string;
  department: string;
  description: string;
  location: string;
  salary_range: string;
  apply_link: string;
}

const emptyForm: CreateJobForm = {
  company_name: '',
  role_title: '',
  department: '',
  description: '',
  location: '',
  salary_range: '',
  apply_link: '',
};

export default function JobPostingsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateJobForm>(emptyForm);
  const { preferences, isLoading: prefsLoading, setCurrentPage, setItemsPerPage, updatePreferences } = useTablePreferences('job_postings');

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const res = await searchApi.post('/get_job_postings', {});
      setJobs(res.data.job_postings || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 0);
    } catch {
      toast.error('Failed to load job postings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!prefsLoading) {
      fetchJobs();
    }
  }, [preferences.current_page, preferences.sort_by, preferences.sort_direction, preferences.items_per_page, prefsLoading]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name.trim() || !formData.role_title.trim() || !formData.description.trim()) {
      toast.error('Company name, role title, and description are required');
      return;
    }
    try {
      setIsSubmitting(true);
      await searchApi.post('/job_postings', {
        company_name: formData.company_name,
        role_title: formData.role_title,
        department: formData.department || null,
        description: formData.description,
        location: formData.location || null,
        salary_range: formData.salary_range || null,
        apply_link: formData.apply_link || null,
      });
      toast.success('Job posting created');
      setFormData(emptyForm);
      setShowModal(false);
      await fetchJobs();
    } catch (error) {
      const apiError = error as { response?: { data?: { detail?: string } } };
      toast.error(apiError.response?.data?.detail || 'Failed to create job posting');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = (id: number, current: boolean) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, is_active: !current } : j)));
    toast.success(`Job ${!current ? 'activated' : 'deactivated'}`);
  };

  const handleSort = (column: string) => {
    if (preferences.sort_by === column) {
      updatePreferences({ sort_direction: preferences.sort_direction === 'asc' ? 'desc' : 'asc' }, true);
    } else {
      updatePreferences({ sort_by: column, sort_direction: 'asc' }, true);
    }
  };

  const columns: Column<JobPosting>[] = [
    {
      key: 'company_name',
      header: 'Company',
      sortable: true,
      render: (job) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">{job.company_name}</span>
      ),
    },
    {
      key: 'role_title',
      header: 'Role',
      sortable: true,
      render: (job) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{job.role_title}</span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      render: (job) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{job.location || '-'}</span>
      ),
    },
    {
      key: 'salary_range',
      header: 'Salary',
      sortable: true,
      render: (job) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{job.salary_range || '-'}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      render: (job) => (
        <span 
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={
            job.is_active 
              ? { backgroundColor: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)' }
              : { backgroundColor: 'var(--accent)', color: 'var(--muted)' }
          }
        >
          {job.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (job) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{new Date(job.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (job) => (
        <button onClick={() => handleToggle(job.id, job.is_active)} className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium">
          {job.is_active ? 'Deactivate' : 'Activate'}
        </button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between page-header">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight" style={{ color: 'var(--foreground)' }}>Job Postings</h1>
            <p className="mt-3 text-lg" style={{ color: 'var(--muted)' }}>Manage your job postings</p>
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="px-4 py-2 text-white rounded-lg font-medium transition-colors"
            style={{ backgroundColor: 'var(--primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
          >
            Create Job Posting
          </button>
        </div>

        {isLoading || prefsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No job postings yet</p>
            <p className="text-gray-400 dark:text-gray-500 mt-2">Create your first job posting to get started</p>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={jobs}
              keyExtractor={(job) => job.id}
              sortBy={preferences.sort_by}
              sortDirection={preferences.sort_direction}
              onSort={handleSort}
              isLoading={false}
              emptyMessage="No job postings yet"
            />
            <Pagination
              currentPage={preferences.current_page}
              totalPages={pages}
              totalItems={total}
              itemsPerPage={preferences.items_per_page}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-300 dark:border-gray-700">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Job Posting</h2>
                <button onClick={() => setShowModal(false)} disabled={isSubmitting} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">×</button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Company Name *</label>
                    <input type="text" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="e.g., Tech Corp" disabled={isSubmitting} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Role Title *</label>
                    <input type="text" value={formData.role_title} onChange={(e) => setFormData({ ...formData, role_title: e.target.value })} placeholder="e.g., Senior Developer" disabled={isSubmitting} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Department</label>
                    <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} placeholder="e.g., Engineering" disabled={isSubmitting} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Location</label>
                    <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., San Francisco, CA" disabled={isSubmitting} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Salary Range</label>
                    <input type="text" value={formData.salary_range} onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })} placeholder="e.g., $120k - $160k" disabled={isSubmitting} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Application Link</label>
                    <input type="url" value={formData.apply_link} onChange={(e) => setFormData({ ...formData, apply_link: e.target.value })} placeholder="https://..." disabled={isSubmitting} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Description *</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Job description, responsibilities, requirements..." rows={6} disabled={isSubmitting} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" />
                </div>
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-300 dark:border-gray-700">
                  <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Creating...' : 'Create Job Posting'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
