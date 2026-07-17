// src/hooks/useIsGrammarlyActive.ts
import { useState, useEffect } from 'react';

export function useIsGrammarlyActive() {
  const [isGrammarlyActive, setIsGrammarlyActive] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasGrammarly = document.documentElement.hasAttribute('bis_skin_checked');
      setIsGrammarlyActive(hasGrammarly);
    }
  }, []);

  return isGrammarlyActive;
}
