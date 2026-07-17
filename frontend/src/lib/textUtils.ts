// src/lib/textUtils.ts

/**
 * Splits a long message into smaller chunks suitable for individual chat bubbles.
 * Prioritizes splitting by paragraphs, then sentences, then words near the maxLength.
 *
 * @param text The full text content to split.
 * @param maxLength The approximate maximum character length for each chunk.
 * @returns An array of strings, each representing a message chunk.
 */
export function splitLongMessage(text: string, maxLength: number = 300): string[] {
    if (!text || text.length <= maxLength) {
        return [text.trim()]; // Ensure trimming even for single chunks
      }
    
      const chunks: string[] = [];
      // Helper to split respecting word boundaries
      const splitNearMaxLength = (paragraph: string): string[] => {
        const words = paragraph.split(/\s+/);
        const paragraphChunks: string[] = [];
        let currentChunk = '';
    
        for (const word of words) {
          if (currentChunk.length === 0) {
            currentChunk = word;
          } else if (currentChunk.length + word.length + 1 <= maxLength) {
            currentChunk += ` ${word}`;
          } else {
            paragraphChunks.push(currentChunk);
            currentChunk = word;
          }
        }
        if (currentChunk.length > 0) {
          paragraphChunks.push(currentChunk);
        }
        return paragraphChunks;
      };
    
      const paragraphs = text.trim().split(/\n\s*\n+/).map(p => p.trim()).filter(p => p.length > 0);
    
      for (const paragraph of paragraphs) {
        if (paragraph.length <= maxLength) {
          chunks.push(paragraph);
        } else {
          const sentences = paragraph.match(/[^.!?]+[.!?]\s*|[^.!?]+$/g) || [paragraph];
          let currentChunk = '';
          for (const sentence of sentences) {
             const trimmedSentence = sentence.trim();
             if (trimmedSentence.length === 0) continue;
              if (trimmedSentence.length > maxLength) {
                  if (currentChunk.length > 0) { chunks.push(currentChunk); currentChunk = ''; }
                  chunks.push(...splitNearMaxLength(trimmedSentence));
              } else if (currentChunk.length === 0) {
                  currentChunk = trimmedSentence;
              } else if (currentChunk.length + trimmedSentence.length + 1 <= maxLength) {
                  currentChunk += ` ${trimmedSentence}`;
              } else {
                  chunks.push(currentChunk);
                  currentChunk = trimmedSentence;
              }
          }
          if (currentChunk.length > 0) { chunks.push(currentChunk); }
        }
      }
      return chunks.filter(chunk => chunk.length > 0);
    }
    
    /**
 * Counts the approximate number of words in a string.
 * @param text The string to count words in.
 * @returns The word count.
 */
export function countWords(text: string): number {
    if (!text) return 0;
    // Simple split by whitespace, filters out empty strings
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
  
  /**
   * Calculates an estimated reading time delay in milliseconds based on word count.
   * Adjust the wordsPerMinute and baseDelay values as needed for desired pacing.
   *
   * @param wordCount The number of words in the text.
   * @param wordsPerMinute Estimated reading speed (adjust lower for complexity).
   * @param baseDelayMs Minimum delay regardless of word count.
   * @param maxDelayMs Maximum delay to prevent excessively long pauses.
   * @returns The calculated delay in milliseconds.
   */
  export function calculateReadTimeMs(
      wordCount: number,
      wordsPerMinute: number = 140, // Average reading speed is ~200-250, lower for chat
      baseDelayMs: number = 500,    // Minimum pause
      maxDelayMs: number = 8000     // Max pause (e.g., 7 seconds)
  ): number {
      if (wordCount <= 0) return baseDelayMs;
  
      const minutesToRead = wordCount / wordsPerMinute;
      const calculatedDelayMs = minutesToRead * 60 * 1000; // Convert minutes to milliseconds
  
      // Ensure delay is within bounds
      const clampedDelay = Math.max(baseDelayMs, Math.min(calculatedDelayMs, maxDelayMs));
  
      return Math.round(clampedDelay);
  }
  