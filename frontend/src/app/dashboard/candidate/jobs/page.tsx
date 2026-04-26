'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Alert } from '@/components/ui/Alert';
import { searchApi } from '@/lib/api';
import { BriefcaseIcon, MapPinIcon, CurrencyDollarIcon, CalendarIcon } from '@heroicons/react/24/outline';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await searchApi.get('/my_applications');
      setApplications(response.data.applications);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Opportunities</h1>
          <p className="text-gray-600 mt-2">
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
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <BriefcaseIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No opportunities yet
            </h3>
            <p className="text-gray-600">
              Companies will reach out to you when they find your profile interesting.
              Make sure your resume and profile are up to date!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>{applications.length}</strong> {applications.length === 1 ? 'company has' : 'companies have'} reached out to you
              </p>
            </div>

            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{app.role_title}</h3>
                    <p className="text-lg text-gray-700 mt-1">{app.company_name}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center text-sm text-gray-600">
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      Contacted {formatDate(app.contacted_at)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {app.department && (
                    <div className="flex items-center text-gray-600">
                      <BriefcaseIcon className="w-5 h-5 mr-2" />
                      <span>{app.department}</span>
                    </div>
                  )}
                  {app.location && (
                    <div className="flex items-center text-gray-600">
                      <MapPinIcon className="w-5 h-5 mr-2" />
                      <span>{app.location}</span>
                    </div>
                  )}
                  {app.salary_range && (
                    <div className="flex items-center text-gray-600">
                      <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                      <span>{app.salary_range}</span>
                    </div>
                  )}
                </div>

                <p className="text-gray-700 mb-4">{app.description}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    {app.hr_name && (
                      <p>Contact: {app.hr_name} ({app.hr_email})</p>
                    )}
                  </div>
                  {app.apply_link && (
                    <a
                      href={app.apply_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Details & Apply
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
