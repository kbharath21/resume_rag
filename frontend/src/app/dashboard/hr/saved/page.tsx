'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { searchApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTablePreferences } from '@/hooks/useTablePreferences';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';

interface SavedCandidate {
  id: number;
  candidate_user_id: number;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  candidate_location: string;
  candidate_notice_period: string;
  job_posting_id: number | null;
  job_title: string | null;
  company_name: string | null;
  note: string | null;
  status: string;
  saved_at: string;
}

interface CandidateResume {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  summary: string;
  full_resume_text: string;
}

interface JobPosting {
  id: number;
  company_name: string;
  role_title: string;
  is_active: boolean;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

export default function SavedCandidatesPage() {
  const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedResume, setSelectedResume] = useState<CandidateResume | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);
  const { preferences, isLoading: prefsLoading, setCurrentPage, setItemsPerPage, updatePreferences } = useTablePreferences('saved_candidates');

  const fetchSavedCandidates = async () => {
    try {
      setIsLoading(true);
      const response = await searchApi.get('/saved_candidates');
      setCandidates(response.data.candidates || []);
      setTotal(response.data.total || 0);
      setPages(response.data.pages || 0);
    } catch {
      toast.error('Failed to load saved candidates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!prefsLoading) {
      fetchSavedCandidates();
    }
  }, [preferences.current_page, preferences.sort_by, preferences.sort_direction, preferences.items_per_page, prefsLoading]);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await searchApi.post('/get_job_postings', {});
      const activeJobs = (response.data.job_postings || []).filter((job: JobPosting) => job.is_active);
      setJobs(activeJobs);
    } catch {
    }
  };

  const fetchCandidateResume = async (candidateUserId: number) => {
    try {
      const response = await searchApi.get(`/get_candidate/${candidateUserId}`);
      if (response.data.status === 'success') {
        setSelectedResume(response.data);
        setShowResumeModal(true);
      } else {
        toast.error('Resume not found for this candidate');
      }
    } catch {
      toast.error('Failed to load candidate resume');
    }
  };

  const handleSelectCandidate = (candidateId: number) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCandidates.size === candidates.length) {
      setSelectedCandidates(new Set());
    } else {
      const allIds = new Set(candidates.map((c) => c.id));
      setSelectedCandidates(allIds);
    }
  };

  const handleSendOutreach = async () => {
    if (selectedCandidates.size === 0) {
      toast.error('Please select at least one candidate');
      return;
    }
    if (!selectedJobId) {
      toast.error('Please select a job posting');
      return;
    }
    try {
      setIsSendingOutreach(true);
      const candidateUserIds = candidates
        .filter(c => selectedCandidates.has(c.id))
        .map(c => c.candidate_user_id);
      const payload = {
        candidate_ids: candidateUserIds,
        job_posting_id: selectedJobId,
      };
      const response = await searchApi.post('/send_outreach', payload);
      if (response.data.status === 'done') {
        const results = response.data.results;
        toast.success(
          `Outreach sent: ${results.sent.length} sent, ${results.failed.length} failed, ${results.skipped.length} skipped`
        );
        setSelectedCandidates(new Set());
        setShowOutreachModal(false);
        setSelectedJobId(null);
        await fetchSavedCandidates();
      }
    } catch (error) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.detail || 'Failed to send outreach');
    } finally {
      setIsSendingOutreach(false);
    }
  };

  const handleSort = (column: string) => {
    if (preferences.sort_by === column) {
      updatePreferences({ sort_direction: preferences.sort_direction === 'asc' ? 'desc' : 'asc' }, true);
    } else {
      updatePreferences({ sort_by: column, sort_direction: 'asc' }, true);
    }
  };

  const columns: Column<SavedCandidate>[] = [
    {
      key: 'select',
      header: '',
      render: (candidate) => (
        <input
          type="checkbox"
          checked={selectedCandidates.has(candidate.id)}
          onChange={() => handleSelectCandidate(candidate.id)}
          className="rounded border-gray-300"
        />
      ),
    },
    {
      key: 'candidate_name',
      header: 'Name',
      sortable: true,
      render: (candidate) => (
        <button
          onClick={() => fetchCandidateResume(candidate.candidate_user_id)}
          className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline"
        >
          {candidate.candidate_name || 'Unknown'}
        </button>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (candidate) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {candidate.candidate_email || '-'}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      render: (candidate) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {candidate.candidate_location || '-'}
        </span>
      ),
    },
    {
      key: 'notice_period',
      header: 'Notice Period',
      sortable: true,
      render: (candidate) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {candidate.candidate_notice_period ? candidate.candidate_notice_period.replace('_', ' ') : '-'}
        </span>
      ),
    },
    {
      key: 'job',
      header: 'Job',
      render: (candidate) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {candidate.job_title ? (
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{candidate.job_title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{candidate.company_name}</div>
            </div>
          ) : (
            '-'
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (candidate) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            candidate.status === 'emailed'
              ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
              : candidate.status === 'interviewed'
              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
          }`}
        >
          {candidate.status}
        </span>
      ),
    },
    {
      key: 'saved_at',
      header: 'Saved',
      sortable: true,
      render: (candidate) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(candidate.saved_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Saved Candidates</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} in your shortlist
            </p>
          </div>
          {selectedCandidates.size > 0 && (
            <button
              onClick={() => setShowOutreachModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Send Outreach ({selectedCandidates.size})
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={candidates}
          keyExtractor={(candidate) => candidate.id}
          sortBy={preferences.sort_by}
          sortDirection={preferences.sort_direction}
          onSort={handleSort}
          isLoading={isLoading || prefsLoading}
          emptyMessage="No saved candidates yet"
        />

        <Pagination
          currentPage={preferences.current_page}
          totalPages={pages}
          totalItems={total}
          itemsPerPage={preferences.items_per_page}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />

        {showOutreachModal && (
          <OutreachModal
            selectedCount={selectedCandidates.size}
            jobs={jobs}
            selectedJobId={selectedJobId}
            onJobSelect={setSelectedJobId}
            onSend={handleSendOutreach}
            onClose={() => setShowOutreachModal(false)}
            isSending={isSendingOutreach}
          />
        )}

        {showResumeModal && selectedResume && (
          <ResumeModal
            resume={selectedResume}
            onClose={() => {
              setShowResumeModal(false);
              setSelectedResume(null);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

interface OutreachModalProps {
  selectedCount: number;
  jobs: JobPosting[];
  selectedJobId: number | null;
  onJobSelect: (jobId: number) => void;
  onSend: () => void;
  onClose: () => void;
  isSending: boolean;
}

function OutreachModal({
  selectedCount,
  jobs,
  selectedJobId,
  onJobSelect,
  onSend,
  onClose,
  isSending,
}: OutreachModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full border border-gray-300 dark:border-gray-700">
        <div className="border-b border-gray-300 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Send Outreach</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Sending to {selectedCount} candidate{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Select Job Posting
            </label>
            <select
              value={selectedJobId || ''}
              onChange={(e) => onJobSelect(Number(e.target.value))}
              className="w-full px-3 py-2.5 border rounded transition-all duration-150 focus:outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-base border-gray-400 dark:border-gray-600 focus:border-gray-900 dark:focus:border-white focus:border-2"
              disabled={isSending}
            >
              <option value="">Choose a job...</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.role_title} at {job.company_name}
                </option>
              ))}
            </select>
          </div>
          {jobs.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No active job postings available</p>
          )}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-300 dark:border-gray-700">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onSend}
              disabled={isSending || !selectedJobId}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? 'Sending...' : 'Send Outreach'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ResumeModalProps {
  resume: CandidateResume;
  onClose: () => void;
}

function ResumeModal({ resume, onClose }: ResumeModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-300 dark:border-gray-700">
        <div className="border-b border-gray-300 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{resume.name}'s Resume</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Email</p>
                <p className="text-base text-gray-900 dark:text-white">{resume.email}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Phone</p>
                <p className="text-base text-gray-900 dark:text-white">{resume.phone || '-'}</p>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Summary</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{resume.summary}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Full Resume</h3>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700">
                {resume.full_resume_text}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-300 dark:border-gray-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
