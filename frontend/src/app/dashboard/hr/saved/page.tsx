'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { searchApi } from '@/lib/api';
import toast from 'react-hot-toast';

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

export default function SavedCandidatesPage() {
  const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedResume, setSelectedResume] = useState<CandidateResume | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(false);
  const [jobs, setJobs] = useState<Array<{ id: number; company_name: string; role_title: string }>>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);

  useEffect(() => {
    fetchSavedCandidates();
    fetchJobs();
  }, []);

  const fetchSavedCandidates = async () => {
    try {
      setIsLoading(true);
      const response = await searchApi.get('/saved_candidates');
      setCandidates(response.data.candidates || []);
    } catch (error) {
      console.error('Failed to fetch saved candidates:', error);
      toast.error('Failed to load saved candidates');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await searchApi.post('/get_job_postings', {});
      const activeJobs = (response.data.job_postings || []).filter((job: any) => job.is_active);
      setJobs(activeJobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const fetchCandidateResume = async (candidateUserId: number) => {
    try {
      setIsLoadingResume(true);
      const response = await searchApi.get(`/get_candidate/${candidateUserId}`);
      if (response.data.status === 'success') {
        setSelectedResume(response.data);
        setShowResumeModal(true);
      } else {
        toast.error('Resume not found for this candidate');
      }
    } catch (error) {
      console.error('Failed to fetch resume:', error);
      toast.error('Failed to load candidate resume');
    } finally {
      setIsLoadingResume(false);
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
      
      // Map selected saved_candidate IDs to actual candidate_user_ids
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
    } catch (error: any) {
      console.error('Failed to send outreach:', error);
      toast.error(error.response?.data?.detail || 'Failed to send outreach');
    } finally {
      setIsSendingOutreach(false);
    }
  };

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

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No saved candidates yet</p>
            <p className="text-gray-400 dark:text-gray-500 mt-2">Search for candidates and save them to your shortlist</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.size === candidates.length && candidates.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Notice Period
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Job
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {candidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCandidates.has(candidate.id)}
                          onChange={() => handleSelectCandidate(candidate.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => fetchCandidateResume(candidate.candidate_user_id)}
                          className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline"
                        >
                          {candidate.candidate_name || 'Unknown'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {candidate.candidate_email || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {candidate.candidate_location || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {candidate.candidate_notice_period ? candidate.candidate_notice_period.replace('_', ' ') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {candidate.job_title ? (
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{candidate.job_title}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{candidate.company_name}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => fetchCandidateResume(candidate.candidate_user_id)}
                          disabled={isLoadingResume}
                          className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium disabled:opacity-50"
                        >
                          View Resume
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
  jobs: Array<{ id: number; company_name: string; role_title: string }>;
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
