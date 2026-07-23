'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { searchApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTablePreferences } from '@/hooks/useTablePreferences';

// RAG Model types
type RAGModel = 1 | 2 | 3;

interface RAGModelInfo {
  id: RAGModel;
  name: string;
  description: string;
  bestFor: string;
  emoji: string;
}

const RAG_MODELS: Record<RAGModel, RAGModelInfo> = {
  1: {
    id: 1,
    name: 'Dense Retrieval',
    description: 'Fast semantic matching using embeddings',
    bestFor: 'Semantic Matching',
    emoji: '🔍',
  },
  2: {
    id: 2,
    name: 'Hybrid RAG',
    description: 'Semantic + keyword search for precise skills matching',
    bestFor: 'Exact Keywords & Skills',
    emoji: '🎯',
  },
  3: {
    id: 3,
    name: 'HyDE',
    description: 'AI-enhanced queries for natural job descriptions',
    bestFor: 'Job Description Matching',
    emoji: '🤖',
  },
};

interface Candidate {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  summary: string;
  confidence: number;
  cosine_score?: number;
  reranker_score?: number;
  rag_model?: RAGModel;
}

interface SearchResponse {
  status: string;
  rag_model: RAGModel;
  model_used: string;
  best_model: RAGModel;
  best_model_name: string;
  best_model_confidence: number;
  model_metadata: {
    use_case: string;
    enhanced_query?: string;
  };
  candidates: Candidate[];
}

interface CandidateDetailModalProps {
  candidate: Candidate | null;
  onClose: () => void;
  onSave: (candidateId: number) => void;
  isSaving: boolean;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<RAGModel>(1);
  const [results, setResults] = useState<Candidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  
  // Use table preferences hook - only for pagination since Milvus returns results sorted by relevance
  const { preferences, setCurrentPage } = useTablePreferences('search_results');
  
  const currentPage = preferences?.current_page || 1;
  const itemsPerPage = preferences?.items_per_page || 10;

  // Load saved model preference from localStorage on mount
  useEffect(() => {
    const savedModel = localStorage.getItem('rag_model_preference');
    if (savedModel && ['1', '2', '3'].includes(savedModel)) {
      setSelectedModel(parseInt(savedModel) as RAGModel);
    }
  }, []);

  const handleModelChange = (modelId: RAGModel) => {
    setSelectedModel(modelId);
    localStorage.setItem('rag_model_preference', String(modelId));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      setIsSearching(true);
      setCurrentPage(1); // Reset to page 1 on new search
      const response = await searchApi.post('/search_candidates', {
        query: query.trim(),
        rag_model: selectedModel,
        limit: 100,
      });

      if (response.data.status === 'success') {
        setSearchResponse(response.data);
        setResults(response.data.candidates || []);
        if (response.data.candidates.length === 0) {
          toast.error('No candidates found matching your query');
        } else {
          toast.success(`Found ${response.data.candidates.length} candidates using ${response.data.model_used}`);
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
        toast.error('Candidate already in your shortlist');
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
        <div className="page-header">
          <h1 className="text-5xl font-extrabold tracking-tight" style={{ color: 'var(--foreground)' }}>Search Candidates</h1>
          <p className="mt-3 text-lg" style={{ color: 'var(--muted)' }}>Find candidates using semantic search</p>
        </div>

        <form onSubmit={handleSearch} className="rounded-lg border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="space-y-4">
            {/* RAG Model Selector */}
            <div className="space-y-3">
              <label className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Search Strategy</label>
              <div className="flex gap-2 flex-wrap">
                {Object.values(RAG_MODELS).map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleModelChange(model.id)}
                    disabled={isSearching}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                      selectedModel === model.id
                        ? 'text-white shadow-lg'
                        : 'border hover:bg-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    style={{
                      backgroundColor: selectedModel === model.id ? 'var(--primary)' : 'transparent',
                      borderColor: selectedModel === model.id ? 'var(--primary)' : 'var(--border)',
                      color: selectedModel === model.id ? 'white' : 'var(--foreground)',
                    }}
                  >
                    <span>{model.emoji}</span>
                    <span>{model.name}</span>
                  </button>
                ))}
              </div>
              
              {/* Model Description */}
              {selectedModel && RAG_MODELS[selectedModel] && (
                <div className="p-3 rounded-lg border text-sm" style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  <p><strong>{RAG_MODELS[selectedModel].name}</strong>: {RAG_MODELS[selectedModel].description}</p>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Python developer with 5 years experience in Django and microservices"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{ 
                  backgroundColor: 'var(--input)', 
                  borderColor: 'var(--input-border)',
                  color: 'var(--input-text)'
                }}
                disabled={isSearching}
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-6 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {isSearching ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--primary)' }} />
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-lg border p-12 text-center" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <p className="text-lg" style={{ color: 'var(--muted)' }}>
              {query ? 'No candidates found' : 'Enter a search query to find candidates'}
            </p>
          </div>
        ) : (
          <>
            {/* Model Info Banner */}
            {searchResponse && (
              <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {RAG_MODELS[searchResponse.rag_model]?.emoji} {searchResponse.model_used}
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                    Best Match: {searchResponse.best_model_name} ({searchResponse.best_model_confidence?.toFixed(1) || '0'}%)
                  </span>
                </div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                  {searchResponse.model_metadata.use_case}
                </p>
                {searchResponse.model_metadata.enhanced_query && (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    💡 Enhanced Query: "{searchResponse.model_metadata.enhanced_query}"
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              {paginatedResults.map((candidate) => (
                <div
                  key={candidate.user_id}
                  className="rounded-lg border p-6 hover:shadow-md transition-shadow"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{candidate.name}</h3>
                      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{candidate.email}</p>
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>{candidate.phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                        {candidate.confidence?.toFixed(1) || (candidate.reranker_score ? ((candidate.reranker_score + 10) * 5).toFixed(0) : '0')}%
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Confidence</p>
                    </div>
                  </div>

                  <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--foreground)' }}>{candidate.summary}</p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedCandidate(candidate)}
                      className="flex-1 px-4 py-2 border rounded-lg transition-colors font-medium"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      View Full Resume
                    </button>
                    <button
                      onClick={() => handleSaveCandidate(candidate.user_id)}
                      className="flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium"
                      style={{ backgroundColor: 'var(--primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
                    >
                      Save Candidate
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, results.length)} of {results.length}{' '}
                  candidates
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                        style={
                          currentPage === page
                            ? { backgroundColor: 'var(--primary)', color: 'white' }
                            : { borderWidth: '1px', borderColor: 'var(--border)', color: 'var(--foreground)' }
                        }
                        onMouseEnter={(e) => {
                          if (currentPage !== page) {
                            e.currentTarget.style.backgroundColor = 'var(--accent)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== page) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
      <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--card)' }}>
        <div className="sticky top-0 border-b px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{candidate.name}</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-2xl leading-none disabled:opacity-50 transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Email</p>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--foreground)' }}>{candidate.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Phone</p>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--foreground)' }}>{candidate.phone}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Match Score</p>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--primary)' }}>
                {candidate.confidence?.toFixed(1) || (candidate.reranker_score ? ((candidate.reranker_score + 10) * 5).toFixed(0) : '0')}%
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Resume Summary</p>
            <div className="rounded-lg p-4 text-sm whitespace-pre-wrap" style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)' }}>
              {candidate.summary}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--accent)')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Close
            </button>
            <button
              onClick={() => onSave(candidate.user_id)}
              disabled={isSaving}
              className="px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--primary)' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--primary-hover)')}
              onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--primary)')}
            >
              {isSaving ? 'Saving...' : 'Save Candidate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
