'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { searchApi } from '@/lib/api';
import toast from 'react-hot-toast';

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
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateJobForm>(emptyForm);
  const [sortKey, setSortKey] = useState<keyof JobPosting>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const res = await searchApi.post('/get_job_postings', {});
      setJobs(res.data.job_postings || []);
    } catch {
      toast.error('Failed to load job postings');
    } finally {
      setIsLoading(false);
    }
  };

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
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create job posting');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = (id: number, current: boolean) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, is_active: !current } : j)));
    toast.success(`Job ${!current ? 'activated' : 'deactivated'}`);
  };

  const handleSort = (key: keyof JobPosting) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...jobs].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    if (typeof av === 'boolean') return sortDir === 'asc' ? (av === bv ? 0 : av ? 1 : -1) : (av === bv ? 0 : av ? -1 : 1);
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const cols: { key: keyof JobPosting; label: string }[] = [
    { key: 'company_name', label: 'Company' },
    { key: 'role_title', label: 'Role' },
    { key: 'location', label: 'Location' },
    { key: 'salary_range', label: 'Salary' },
    { key: 'is_active', label: 'Status' },
    { key: 'created_at', label: 'Created' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Postings</h1>
            <p className="text-gray-600 mt-1">Manage your job postings</p>
          </div>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Create Job Posting
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">No job postings yet</p>
            <p className="text-gray-400 mt-2">Create your first job posting to get started</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {cols.map(({ key, label }) => (
                        <th key={key} className="px-6 py-3 text-left">
                          <button onClick={() => handleSort(key)} className="flex items-center gap-1 font-semibold text-gray-900 hover:text-gray-700">
                            {label}
                            {sortKey === key && <span className="text-xs">{sortDir === 'asc' ? 'asc' : 'desc'}</span>}
                          </button>
                        </th>
                      ))}
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginated.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{job.company_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{job.role_title}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{job.location || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{job.salary_range || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${job.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {job.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{new Date(job.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm">
                          <button onClick={() => handleToggle(job.id, job.is_active)} className="text-blue-600 hover:text-blue-800 font-medium">
                            {job.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Showing {(currentPage - 1) * PER_PAGE + 1} to {Math.min(currentPage * PER_PAGE, sorted.length)} of {sorted.length} jobs</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Previous</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setCurrentPage(p)} className={`px-3 py-1 rounded-lg text-sm font-medium ${currentPage === p ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{p}</button>
                  ))}
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Create Job Posting</h2>
                <button onClick={() => setShowModal(false)} disabled={isSubmitting} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">x</button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Company Name *</label>
                    <input type="text" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="e.g., Tech Corp" disabled={isSubmitting} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Role Title *</label>
                    <input type="text" value={formData.role_title} onChange={(e) => setFormData({ ...formData, role_title: e.target.value })} placeholder="e.g., Senior Developer" disabled={isSubmitting} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Department</label>
                    <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} placeholder="e.g., Engineering" disabled={isSubmitting} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Location</label>
                    <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., San Francisco, CA" disabled={isSubmitting} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Salary Range</label>
                    <input type="text" value={formData.salary_range} onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })} placeholder="e.g., $120k - $160k" disabled={isSubmitting} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Application Link</label>
                    <input type="url" value={formData.apply_link} onChange={(e) => setFormData({ ...formData, apply_link: e.target.value })} placeholder="https://..." disabled={isSubmitting} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Description *</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Job description, responsibilities, requirements..." rows={6} disabled={isSubmitting} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Creating...' : 'Create Job Posting'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
