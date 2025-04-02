import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient'; // Assuming edge function will be called via supabase client
import { useAuthContext } from '../contexts/AuthContext';

const UploadData: React.FC = () => {
  const { user } = useAuthContext();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setMessage(null);
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      // Basic validation for file type (though 'accept' attribute helps)
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx')) {
          setSelectedFile(file);
      } else {
          setError('Invalid file type. Please upload an .xlsx file.');
          setSelectedFile(null);
          // Clear the input value if the file is invalid
          event.target.value = '';
      }
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }
    if (!user) {
        setError('You must be logged in to upload data.');
        return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('spreadsheet', selectedFile); // Use 'spreadsheet' as the key

      // Invoke the Supabase Edge Function with FormData
      // Note: When using FormData, Supabase client automatically sets the correct
      // Content-Type header (multipart/form-data) with the boundary.
      // Do NOT manually set Content-Type here.
      const { data, error: functionError } = await supabase.functions.invoke(
        'parse-spreadsheet', // Name of the function
        { body: formData }
      );

      if (functionError) {
        console.error('Function invocation error:', functionError);
        // Try to parse a more specific error message if available
        let specificError = 'Failed to process spreadsheet.';
        if (functionError.context && typeof functionError.context === 'object' && 'message' in functionError.context) {
             specificError = functionError.context.message as string;
        } else if (functionError.message) {
            specificError = functionError.message;
        }
        setError(`Error: ${specificError}`);
        throw new Error(specificError); // Rethrow for the catch block
      }

      console.log('Function response data:', data);
      // Assuming the function returns a success message or status
      setMessage(data?.message || 'Spreadsheet processed successfully!');
      setSelectedFile(null); // Clear selection on success
      // Optionally clear the file input visually if needed (can be tricky)
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

    } catch (err) {
      // Error is already set in the try block if it's a functionError
      if (!error) { // Handle other potential errors (e.g., network issues)
        console.error('Upload error:', err);
        setError('An unexpected error occurred during upload.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Memoize handleUpload to prevent unnecessary re-renders if passed down
  const memoizedHandleUpload = useCallback(handleUpload, [selectedFile, user, error]); // Added error dependency

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Upload Casino Data</h1>
      <p className="mb-6 text-center text-gray-600">
        Upload your completed{' '}
        {/* TODO: Add link to template if available */}
        <span className="font-semibold">'Ye ol' Free Casinos - 2025.xlsx'</span>{' '}
        spreadsheet to analyze your wagering and transaction history.
      </p>

      <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <div className="mb-6">
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
            Select Spreadsheet (.xlsx format only)
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:text-sm file:font-semibold
                       file:bg-indigo-50 file:text-indigo-700
                       hover:file:bg-indigo-100 disabled:opacity-50"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        {message && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{message}</span>
          </div>
        )}

        <button
          onClick={memoizedHandleUpload} // Use memoized version
          disabled={!selectedFile || loading}
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            'Upload & Process File'
          )}
        </button>
      </div>
    </div>
  );
};

export default UploadData;
