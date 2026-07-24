'use client';

import { useState, useCallback } from 'react';

/**
 * A hook that returns a function to throw async errors so they are caught
 * by the nearest React ErrorBoundary.
 */
export default function useErrorHandler() {
  const [, setError] = useState(null);

  const handleError = useCallback((err) => {
    setError(() => {
      throw err;
    });
  }, []);

  return handleError;
}
