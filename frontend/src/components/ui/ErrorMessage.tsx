"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FiAlertCircle } from 'react-icons/fi';

interface ErrorMessageProps {
  setError?: (error: string | null) => void;
  message?: string | null;
}

export default function ErrorMessage({ setError, message }: ErrorMessageProps) {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    if (setError) {
      const errorParam = searchParams.get("error");
      if (errorParam) {
        if (errorParam === "AccessDenied") {
          setError("You must use a UGM email address to sign in.");
        } else {
          setError("An error occurred during sign in. Please try again.");
        }
      }
    }
  }, [searchParams, setError]);
  
  if (message) {
    return (
        <div className="bg-red-500/15 border border-red-500/30 text-red-300 p-3 rounded-xl my-4 flex items-center backdrop-blur-sm">
            <FiAlertCircle className="mr-2 shrink-0 w-4 h-4" />
            <span className="text-sm">{message}</span>
        </div>
    );
  }

  return null;
}
