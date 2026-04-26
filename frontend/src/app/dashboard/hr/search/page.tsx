'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { searchApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Candidate {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  summary: string;
  score: number;
}

interface CandidateDetailModalProps {
  candidate: Candidate | null;
  onClose: () => void;
  onSave: (candidateId: number) => void;
  isSaving: boolean;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Candidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      setIsSearching(true);
      setCurrentPage(1);
      const response = await searchApi.post('/search_candidates', {
        query: query.trim(),
        limit: 100,
      });

      if (response.data.status === 'success') {
        setResults(response.data.candidates || []);
        if (response.data.candidates.length === 0) {
          toast.info('No candidates found matching your query');
        } else {
          toast.success(`Found ${response.data.candidates.length} candidates`);
        }
      }
    } catch (error: any) {
      console.error('Search failed:', error);
      toast.error(error.response?.data?.detail || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveCandidate = async (candidateId: number) => {
    try {
      setIsSaving(true);
      await searchApi.post('/save_candidates', {
        candidate_user_id: candidateId,
      });
      toast.success('Candidate saved to shortlist');
      setSelectedCandidate(null);
    } catch (error: any) {
      console.error('Failed to save candidate:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.status;
      if (errorMessage === 'already_saved') {
        toast.info('Candidate already in your shortlist');
      } else {
        toast.error('Failed to save candidate');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const paginatedResults = results.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(results.length / itemsPerPage);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Search Candidates</h1>
          <p className="text-gray-600 mt-1">Find candidates using semantic search</p>
        </div>

        <form onSubmit={handleSearch} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Python developer with 5 years experience in Django and microservices"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {isSearching ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">
              {query ? 'No candidates found' : 'Enter a search query to find candidates'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedResults.map((candidate) => (
                <div
                  key={candidate.user_id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{candidate.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{candidate.email}</p>
                      <p className="text-sm text-gray-600">{candidate.phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {(candidate.score * 100).toFixed(0)}%
                      </div>
                      <p className="text-xs text-gray-500">Match Score</p>
                    </div>
                  </div>

                  <p className="text-gray-700 text-sm mb-4 line-clamp-2">{candidate.summary}</p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedCandidate(candidate)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      View Full Resume
                    </button>
                    <button
                      onClick={() => handleSaveCandidate(candidate.user_id)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Save Candidate
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, results.length)} of {results.length}{' '}
                  candidates
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {selectedCandidate && (
          <CandidateDetailModal
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            onSave={handleSaveCandidate}
            isSaving={isSaving}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function CandidateDetailModal({
  candidate,
  onClose,
  onSave,
  isSaving,
}: CandidateDetailModalProps) {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{candidate.name}</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{candidate.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{candidate.phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Match Score</p>
              <p className="text-sm font-medium text-blue-600 mt-1">
                {(candidate.score * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Resume Summary</p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {candidate.summary}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={() => onSave(candidate.user_id)}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Candidate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
