'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { searchApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalJobsPosted: number;
  totalCandidatesSaved: number;
  totalOutreachSent: number;
  recentActivity: Array<{
    id: string;
    type: 'job_created' | 'candidate_saved' | 'outreach_sent';
    title: string;
    timestamp: string;
  }>;
}

export default function HRDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalJobsPosted: 0,
    totalCandidatesSaved: 0,
    totalOutreachSent: 0,
    recentActivity: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);

      const [jobsResponse, savedCandidatesResponse] = await Promise.all([
        searchApi.post('/get_job_postings', {}),
        searchApi.get('/saved_candidates'),
      ]);

      const jobs = jobsResponse.data.job_postings || [];
      const savedCandidates = savedCandidatesResponse.data.candidates || [];

      const recentActivity = [
        ...jobs.slice(0, 3).map((job: any) => ({
          id: `job-${job.id}`,
          type: 'job_created' as const,
          title: `Created job posting: ${job.role_title} at ${job.company_name}`,
          timestamp: new Date(job.created_at).toLocaleDateString(),
        })),
        ...savedCandidates.slice(0, 2).map((candidate: any) => ({
          id: `candidate-${candidate.id}`,
          type: 'candidate_saved' as const,
          title: `Saved candidate for review`,
          timestamp: new Date(candidate.saved_at).toLocaleDateString(),
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setStats({
        totalJobsPosted: jobs.length,
        totalCandidatesSaved: savedCandidates.length,
        totalOutreachSent: 0,
        recentActivity: recentActivity.slice(0, 5),
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="page-header">
          <h1 className="text-5xl font-extrabold tracking-tight" style={{ color: 'var(--foreground)' }}>Dashboard</h1>
          <p className="mt-3 text-lg" style={{ color: 'var(--muted)' }}>Welcome back. Here is your recruitment overview.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--primary)' }} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                label="Job Postings"
                value={stats.totalJobsPosted}
                description="Active job postings"
              />
              <StatCard
                label="Saved Candidates"
                value={stats.totalCandidatesSaved}
                description="Candidates in your shortlist"
              />
              <StatCard
                label="Outreach Sent"
                value={stats.totalOutreachSent}
                description="Total emails sent"
              />
            </div>

            <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Recent Activity</h2>
              {stats.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between p-3 rounded-lg border"
                      style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--border)' }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{activity.title}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{activity.timestamp}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                          {activity.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8" style={{ color: 'var(--muted)' }}>No recent activity</p>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  description: string;
}

function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-3xl font-bold mt-2" style={{ color: 'var(--foreground)' }}>{value}</p>
      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{description}</p>
    </div>
  );
}
