/**
 * CANDIDATE RESUME UPLOAD PAGE
 * 
 * Why: This page allows candidates to upload their resume, which is the core feature of
 * the Resume RAG system. The resume is parsed, vectorized, and stored for semantic search
 * by HR users. This page provides drag-and-drop upload, file validation, and upload progress
 * feedback for a smooth user experience.
 * 
 * System Flow: User drags PDF file → File validated (type, size) → Upload initiated →
 * File sent to backend API → Backend parses resume → Extracts text → Generates embeddings →
 * Stores in vector database → Returns success → UI updates to show uploaded resume.
 * 
 * Senior Principle: Progressive enhancement with graceful degradation. Drag-and-drop is
 * the primary interaction, but a fallback file input ensures accessibility for all users.
 */

'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { authApi, storingApi, searchApi } from '@/lib/api';
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentResume, setCurrentResume] = useState<any>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);

  // Fetch current resume on component mount
  React.useEffect(() => {
    const fetchCurrentResume = async () => {
      try {
        // Fetch candidate's own resume from search API (port 3001)
        const resumeResponse = await searchApi.get('/my_resume');
        if (resumeResponse.data.status === 'success') {
          setCurrentResume(resumeResponse.data);
          setUserId(resumeResponse.data.user_id);
        }
      } catch (error) {
        console.error('Failed to fetch resume:', error);
      } finally {
        setIsLoadingResume(false);
      }
    };

    fetchCurrentResume();
  }, [uploadSuccess]);

  /**
   * FILE VALIDATION
   * 
   * Why: Before uploading, we must validate the file type and size to prevent errors and
   * reduce unnecessary API calls. Only PDF files are accepted (industry standard for resumes),
   * and files must be under 5MB to prevent abuse and ensure fast processing.
   * 
   * System Flow: User selects file → validateFile() called → Checks file.type and file.size →
   * If invalid, shows error → If valid, proceeds to upload.
   * 
   * Senior Principle: Fail fast with clear feedback. Validate input at the earliest point
   * and provide specific error messages so users know exactly what to fix.
   */
  const validateFile = (file: File): string | null => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['application/pdf'];

    if (!allowedTypes.includes(file.type)) {
      return 'Only PDF files are allowed.';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 5MB.';
    }

    return null;
  };

  /**
   * FILE SELECTION HANDLER
   * 
   * Why: This handler processes file selection from both the file input and drag-and-drop.
   * It validates the file, updates state, and clears any previous errors. By centralizing
   * file handling logic, we ensure consistent validation regardless of input method.
   * 
   * System Flow: User selects file → handleFileSelect() called → Validates file → If valid,
   * sets file state → If invalid, shows error and clears file state.
   * 
   * Senior Principle: Single source of truth. One function handles all file selection logic,
   * preventing inconsistencies between input methods.
   */
  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    setUploadSuccess(false);

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  /**
   * DRAG AND DROP HANDLERS
   * 
   * Why: Drag-and-drop provides a modern, intuitive upload experience. These handlers
   * manage the drag state (visual feedback) and file drop (file selection). The isDragging
   * state changes the UI to show a highlighted drop zone, guiding users to drop the file.
   * 
   * System Flow: User drags file over drop zone → onDragEnter fires → setIsDragging(true) →
   * Drop zone highlights → User drops file → onDrop fires → Extracts file → Calls handleFileSelect →
   * setIsDragging(false) → Drop zone returns to normal.
   * 
   * Senior Principle: Visual affordances. The UI should clearly indicate what actions are
   * possible (drag here) and provide immediate feedback (highlighting) during interaction.
   */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  /**
   * UPLOAD HANDLER - SEND RESUME TO BACKEND
   * 
   * Why: This handler sends the validated resume file to the backend API for processing.
   * In production, this would use FormData to send the file as multipart/form-data, which
   * is the standard for file uploads. The backend would parse the PDF, extract text, generate
   * embeddings, and store in the vector database.
   * 
   * System Flow: User clicks upload → handleUpload() called → Creates FormData → Appends file →
   * Sends POST request to /api/upload-resume → Backend processes → Returns success/error →
   * Updates UI with result.
   * 
   * Senior Principle: Separation of concerns. The frontend handles file validation and UI,
   * while the backend handles parsing, vectorization, and storage. Each layer has a clear
   * responsibility.
   */
  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Get user profile data for the upload
      const profileResponse = await authApi.get('/profile');
      const { name, email, phone } = profileResponse.data;

      // Validate required fields
      if (!phone) {
        setError('Please update your phone number in your profile before uploading a resume.');
        setIsUploading(false);
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name || '');
      formData.append('email', email || '');
      formData.append('phone', phone || '');

      // Upload to storing API (port 3000)
      const response = await storingApi.post('/ingest_resume_file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.status === 'success') {
        setUploadSuccess(true);
        setFile(null);
      } else {
        setError(response.data.reason || 'Upload failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.reason || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Resume</h1>
          <p className="text-gray-600">
            Upload your resume to get matched with relevant job opportunities.
          </p>
        </div>

        {/* Success Alert */}
        {uploadSuccess && (
          <Alert
            type="success"
            message="Resume uploaded successfully! Your profile has been updated."
            onDismiss={() => setUploadSuccess(false)}
          />
        )}

        {/* Error Alert */}
        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Upload Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center transition-colors
              ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }
            `}
          >
            {file ? (
              <div className="space-y-4">
                <CheckCircleIcon className="w-16 h-16 text-green-600 mx-auto" />
                <div>
                  <p className="text-lg font-semibold text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex justify-center space-x-4">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleUpload}
                    isLoading={isUploading}
                  >
                    Upload Resume
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setFile(null)}
                    disabled={isUploading}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    Drag and drop your resume here
                  </p>
                  <p className="text-sm text-gray-500 mb-4">or</p>
                  <label htmlFor="file-upload">
                    <span className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                      Browse Files
                    </span>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) handleFileSelect(selectedFile);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Supported format: PDF (Max 5MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Current Resume Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Resume</h2>
          {isLoadingResume ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-500 dark:text-gray-400 mt-4">Loading resume...</p>
            </div>
          ) : currentResume ? (
            <div className="space-y-4">
              <div className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <DocumentTextIcon className="w-12 h-12 text-purple-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {currentResume.name}'s Resume
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Email:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{currentResume.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{currentResume.phone || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Summary</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                      {currentResume.summary}
                    </p>
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 list-none flex items-center">
                      <span>View Full Resume</span>
                      <svg className="w-4 h-4 ml-1 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="mt-3 p-4 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {currentResume.full_resume_text}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Upload a new resume to replace the current one
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No resume uploaded yet.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Upload your resume to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
