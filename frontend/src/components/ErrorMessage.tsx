"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface ErrorMessageProps {
  setError: (error: string | null) => void;
}

export default function ErrorMessage({ setError }: ErrorMessageProps) {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Check for error in URL
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "AccessDenied") {
        setError("You must use a UGM email address to sign in.");
      } else {
        setError("An error occurred during sign in. Please try again.");
      }
    }
  }, [searchParams, setError]);
  
  // This component doesn't render anything
  return null;
}