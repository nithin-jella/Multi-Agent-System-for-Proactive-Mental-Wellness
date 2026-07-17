// components/FeedbackForm.tsx
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from 'framer-motion'; // Import animation library
import { FiArrowLeft, FiArrowRight, FiSend, FiXCircle } from 'react-icons/fi'; // Example icons
import apiClient from '@/services/api'; // Import your configured apiClient

// --- Types (Keep existing types) ---
type GoalAchievedOption = 'Yes' | 'No' | 'Partially' | null;
type RatingValue = number; // 1-5
type NpsValue = number; // 0-10

// --- Hashing Function (Keep existing) ---
async function hashIdentifier(identifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(identifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

interface FeedbackFormProps {
    onClose: () => void;
    onSubmitSuccess: () => void;
}

// --- Question Configuration ---
// Define the structure of your questions here for easy management
const feedbackQuestions = [
    { id: 'easeOfUse', label: '1. Overall, how easy or difficult was it to use the UGM-AICare webapp today?', type: 'slider', min: 1, max: 5, step: 1, defaultValue: 3, labels: { 1: 'Very Difficult', 5: 'Very Easy' } },
    { id: 'understanding', label: '2. How well did Aika understand you during your chat?', type: 'slider', min: 1, max: 5, step: 1, defaultValue: 3, labels: { 1: 'Not at all', 5: 'Very Well' } },
    { id: 'feltUnderstood', label: '3. During your conversation, how much did you feel heard or understood?', type: 'slider', min: 1, max: 5, step: 1, defaultValue: 3, labels: { 1: 'Not at all', 5: 'Very Much' } },
    { id: 'goalAchieved', label: '4. Did you accomplish your main goal for visiting today?', type: 'mcq', options: ['Yes', 'No', 'Partially'], defaultValue: null }, // Keep MCQ as buttons or switch if desired
    { id: 'nps', label: '5. How likely are you to recommend UGM-AICare? (0=Not Likely, 10=Very Likely)', type: 'slider', min: 0, max: 10, step: 1, defaultValue: 5, labels: { 0: 'Not Likely', 10: 'Very Likely'} },
    { id: 'improvementSuggestion', label: '6. What is the *one main thing* we could improve?', type: 'textarea', required: true, minLength: 5, defaultValue: '' },
];

// Helper to get default values
const getDefaultAnswers = () => {
    return {
        easeOfUse: 3 as RatingValue,
        understanding: 3 as RatingValue,
        feltUnderstood: 3 as RatingValue,
        goalAchieved: null as GoalAchievedOption,
        nps: 5 as NpsValue,
        improvementSuggestion: ''
    };
};

// --- Main Component ---
const FeedbackForm: React.FC<FeedbackFormProps> = ({ onClose, onSubmitSuccess }) => {
    const { data: session, status } = useSession();

    // State for answers (using a single object for easier management)
    const [answers, setAnswers] = useState<{
        easeOfUse: RatingValue;
        understanding: RatingValue;
        feltUnderstood: RatingValue;
        goalAchieved: GoalAchievedOption;
        nps: NpsValue;
        improvementSuggestion: string;
    }>(getDefaultAnswers());

    const [currentStep, setCurrentStep] = useState(0); // State for current question index
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hashedUserId, setHashedUserId] = useState<string | null>(null);
    const [direction, setDirection] = useState(1); // For animation direction (1: forward, -1: backward)

    // --- Effect for Hashing User ID (Keep existing) ---
    useEffect(() => {
        const getHashedId = async () => {
            if (status === "authenticated" && session?.user?.id) { // Use session.user.id or appropriate field
                try {
                    const hash = await hashIdentifier(session.user.id);
                    setHashedUserId(hash);
                } catch(hashError) { console.error("Error hashing:", hashError); setHashedUserId(null); }
            } else { setHashedUserId(null); }
       };
        getHashedId();
    }, [session, status]);

    const totalSteps = feedbackQuestions.length;
    const currentQuestion = feedbackQuestions[currentStep];

    // --- Input Change Handlers ---
    // Generic handler for different input types
    const handleAnswerChange = (questionId: string, value: unknown) => {
        // Convert slider/number inputs from string to number if necessary
        const questionConfig = feedbackQuestions.find(q => q.id === questionId);
        let processedValue = value;
        if (questionConfig?.type === 'slider' && typeof value === 'string') {
            processedValue = parseInt(value, 10);
        }
        
        setAnswers(prev => ({ ...prev, [questionId]: processedValue }));
        setError(null); 
    };

    // --- Navigation Logic ---
    const handleNext = () => {
        // Validation (ensure required textarea has content)
        if (currentQuestion.type === 'textarea' && currentQuestion.required && answers.improvementSuggestion.trim().length < (currentQuestion.minLength || 0)) {
            setError(`Please provide a suggestion (minimum ${currentQuestion.minLength || 0} characters).`);
            return;
        }

       if (currentStep < totalSteps - 1) {
           setDirection(1); 
           setCurrentStep(currentStep + 1);
           setError(null); 
       } else {
           handleSubmit();
       }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setDirection(-1); // Set direction backward
            setCurrentStep(currentStep - 1);
            setError(null); // Clear error on navigation
        }
    };

    // --- Form Submission Logic ---
    const handleSubmit = useCallback(async () => {
        // Final validation before submit (especially for the last question if required)
         if (!answers.improvementSuggestion || answers.improvementSuggestion.trim().length < (feedbackQuestions[totalSteps - 1].minLength || 0)) {
             setError(`Please provide an improvement suggestion (minimum ${feedbackQuestions[totalSteps - 1].minLength || 0} characters).`);
             setCurrentStep(totalSteps - 1); // Go back to the last question
             return;
         }
        if (isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            // The apiClient already has the baseUrl configured.
            // The endpoint in feedback.py is /feedback, and apiClient's baseUrl includes /api/v1
            const endpoint = "/feedback"; 

            const payload = {
                user_identifier: hashedUserId,
                session_id: null, // General feedback
                ease_of_use_rating: answers.easeOfUse,
                chatbot_understanding_rating: answers.understanding,
                felt_understood_rating: answers.feltUnderstood,
                nps_rating: answers.nps,
                goal_achieved: answers.goalAchieved,
                improvement_suggestion: answers.improvementSuggestion.trim(),
            };

            console.log("Submitting final feedback payload to " + endpoint + ":", payload);
            // Use apiClient.post instead of axios.post
            await apiClient.post(endpoint, payload);

            onSubmitSuccess();
            onClose();

        } catch (err) {
            console.error("Feedback submission error object:", err); 
            let displayMessage = "Failed to submit feedback. Please try again later.";
            if (axios.isAxiosError(err)) {
                if (err.response) {
                    console.error("Backend error response data:", err.response.data); 
                    if (err.response.data && err.response.data.detail) {
                        if (Array.isArray(err.response.data.detail)) {
                            const firstError = err.response.data.detail[0];
                            // Check if 'loc' exists and is an array before trying to slice/join
                            const fieldPath = (firstError.loc && Array.isArray(firstError.loc) && firstError.loc.length > 1)
                                ? firstError.loc.slice(1).join(' > ') 
                                : (firstError.loc && Array.isArray(firstError.loc) && firstError.loc.length === 1 && firstError.loc[0] === 'authorization') 
                                    ? 'Authorization Header' // Specific message for authorization header
                                    : 'N/A';
                            displayMessage = `Validation Error: ${firstError.msg} (Field: ${fieldPath})`;
                        } else if (typeof err.response.data.detail === 'string') {
                            displayMessage = `Error: ${err.response.data.detail}`;
                        } else {
                            displayMessage = `Server error (Status ${err.response.status}): ${err.response.statusText || 'Unknown error'}`;
                        }
                    } else {
                        displayMessage = `Server error (Status ${err.response.status}): ${err.response.statusText || 'No detail provided'}`;
                    }
                } else if (err.request) {
                    displayMessage = "No response received from the server. Please check your connection.";
                } else {
                    displayMessage = `Request setup error: ${err.message}`;
                }
            } else if (err instanceof Error) {
                displayMessage = `Client error: ${err.message}`;
            }
            setError(displayMessage);
        } finally {
            setIsLoading(false);
        }
    }, [answers, hashedUserId, isLoading, onClose, onSubmitSuccess, totalSteps]); // Add 'answers' to dependency

     // --- Animation Variants ---
     const variants = {
         enter: (direction: number) => ({
             x: direction > 0 ? 500 : -500, // Start off-screen
             opacity: 0
         }),
         center: {
             x: 0, // Center position
             opacity: 1
         },
         exit: (direction: number) => ({
             x: direction < 0 ? 500 : -500, // Exit off-screen
             opacity: 0
         })
     };


    // --- Modern UI Rendering ---
    return (
        // Modal Container (assuming parent provides overlay)
        <div className="p-4 sm:p-6 bg-linear-to-br from-gray-800 via-gray-900 to-black text-white rounded-xl shadow-2xl w-full border border-gray-700 relative overflow-hidden">
             {/* Close Button */}
             <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors z-10" aria-label="Close feedback form">
                  <FiXCircle size={24} />
             </button>

            <h2 className="text-2xl font-bold mb-2 text-center text-[#FFCA40]">Share Your Feedback</h2>
            <p className="text-sm text-gray-400 mb-6 text-center">Your anonymous feedback helps us improve UGM-AICare.</p>

            {/* Progress Indicator */}
            <div className="mb-6 sm:mb-8">
                 <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Question {currentStep + 1} of {totalSteps}</span>
                      {/* Optional: calculate percentage */}
                      {/* <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span> */}
                 </div>
                 <div className="w-full bg-gray-700 rounded-full h-1.5">
                     <motion.div
                         className="bg-linear-to-r from-blue-500 to-teal-400 h-1.5 rounded-full"
                         initial={{ width: 0 }}
                         animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                         transition={{ duration: 0.5, ease: "easeInOut" }}
                     />
                 </div>
            </div>

            {/* Animated Question Area */}
            <div className="relative min-h-72 sm:min-h-64 md:min-h-60 overflow-hidden">
                 <AnimatePresence initial={false} custom={direction}>
                     <motion.div
                         key={currentStep} // Key change triggers animation
                         custom={direction}
                         variants={variants}
                         initial="enter"
                         animate="center"
                         exit="exit"
                         transition={{
                             x: { type: "spring", stiffness: 300, damping: 30 },
                             opacity: { duration: 0.2 }
                         }}
                         className="absolute w-full" // Position elements absolutely for transition
                     >
                        <label htmlFor={`feedback-${currentQuestion.id}`} className="block mb-4 text-base sm:text-lg font-semibold text-center px-4"> {/* Added padding */}
                            {currentQuestion.label}
                            {currentQuestion.required && <span className="text-red-400 ml-1">*</span>}
                        </label>

                        {/* Render input based on type */}
                        <div className="mt-4 flex flex-col items-center w-full space-y-4 px-4 sm:px-6"> {/* Added padding */}
                        {(currentQuestion.type === 'slider') && (
                                <div className='w-full max-w-md'>
                                    <input
                                        type="range"
                                        id={`feedback-${currentQuestion.id}`}
                                        min={currentQuestion.min}
                                        max={currentQuestion.max}
                                        step={currentQuestion.step}
                                        value={answers[currentQuestion.id as keyof typeof answers] as number ?? currentQuestion.defaultValue} // Use default value
                                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-lg accent-teal-400" // Basic slider styling
                                        disabled={isLoading}
                                    />
                                    {/* Labels for Min/Max/Current - CORRECTED ACCESS */}
                                    <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
                                        {/* Access label using the KNOWN min value for this question type */}
                                        <span>
                                            {currentQuestion.labels?.[currentQuestion.min as keyof typeof currentQuestion.labels] ?? currentQuestion.min}
                                        </span>
                                        {/* Display current value */}
                                        <span className="font-bold text-sm text-teal-300">
                                            {answers[currentQuestion.id as keyof typeof answers] as number ?? '-'} 
                                        </span>
                                        {/* Access label using the KNOWN max value for this question type */}
                                        <span>
                                            {currentQuestion.labels?.[currentQuestion.max as keyof typeof currentQuestion.labels] ?? currentQuestion.max}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {currentQuestion.type === 'mcq' && (
                                <div className="flex flex-wrap justify-center gap-2 sm:gap-3 px-1"> {/* Adjusted gap */}
                                    {(currentQuestion.options as string[]).map(opt => (
                                        <motion.button
                                            key={`${currentQuestion.id}-${opt}`}
                                            type="button"
                                            onClick={() => handleAnswerChange(currentQuestion.id, opt as GoalAchievedOption)}
                                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all duration-200 ${answers[currentQuestion.id as keyof typeof answers] === opt ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'}`}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            disabled={isLoading}
                                        >
                                            {opt}
                                        </motion.button>
                                    ))}
                                </div>
                            )}

                            {currentQuestion.type === 'nps' && (
                                <div className="flex flex-wrap justify-center gap-1.5 px-1">
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                                        <motion.button
                                            key={`nps-${score}`}
                                            type="button"
                                            onClick={() => handleAnswerChange(currentQuestion.id, score as NpsValue)}
                                            className={`flex items-center justify-center h-8 w-8 border rounded-md text-xs font-medium transition-all duration-150 ${answers.nps === score ? 'bg-linear-to-r from-teal-400 to-blue-500 text-white border-teal-400 shadow-lg scale-110' : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'}`}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            disabled={isLoading}
                                        >
                                            {score}
                                        </motion.button>
                                    ))}
                                </div>
                            )}

                            {currentQuestion.type === 'textarea' && (
                                <textarea
                                    id={`feedback-${currentQuestion.id}`}
                                    value={answers.improvementSuggestion}
                                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                                    placeholder="Please be specific..."
                                    rows={4}
                                    className="w-full max-w-md p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition"
                                    required={currentQuestion.required}
                                    minLength={currentQuestion.minLength}
                                    disabled={isLoading}
                                />
                            )}
                        </div>
                     </motion.div>
                 </AnimatePresence>
            </div>


            {/* Error Display */}
            {error && <p className="text-red-400 text-sm my-3 text-center bg-red-900 bg-opacity-30 p-2 rounded border border-red-700">{error}</p>}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-6 sm:mt-8 pt-4 border-t border-gray-700">
                <motion.button
                    type="button"
                    onClick={handlePrevious}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition text-sm font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentStep === 0 || isLoading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <FiArrowLeft className="mr-1" /> Previous
                </motion.button>

                <motion.button
                    type="button" // Change type to button, handle submission via onClick logic
                    onClick={handleNext} // Always call handleNext
                    className="px-5 py-2 bg-linear-to-r from-[#FFCA40] to-[#ffb700] text-[#001D58] font-bold rounded-lg transition shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center"
                    disabled={isLoading} // Only disable based on loading state now
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                     {currentStep === totalSteps - 1 ? (
                        <> Submit <FiSend className="ml-1.5" /> </>
                     ) : (
                        <> Next <FiArrowRight className="ml-1.5" /> </>
                     )}

                </motion.button>
            </div>
        </div>
    );
};

export default FeedbackForm;