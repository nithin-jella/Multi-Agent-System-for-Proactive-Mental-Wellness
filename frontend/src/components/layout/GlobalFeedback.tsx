// src/components/layout/GlobalFeedback.tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useSidebar } from '@/context/SidebarContext'; // Import the context hook
import FeedbackForm from '@/components/features/feedback/FeedBackForm';
// import { Button } from '@/components/ui/Button';

export default function GlobalFeedback() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { isSidebarOpen } = useSidebar(); // Get sidebar state from context

  const handleFeedbackSuccess = () => {
    toast.success("Terima kasih atas feedback-nya!");
    setShowFeedbackModal(false);
  };

  return (
    <>
      {/* Conditionally Rendered Feedback Button */}
      <AnimatePresence>
        {isSidebarOpen && ( // Only render if sidebar is open
          <motion.button
            key="global-feedback-button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFeedbackModal(true)}
            // Position it bottom-right (or preferred global position)
            className="fixed bottom-6 right-6 z-50 bg-ugm-gold text-ugm-blue-dark px-5 py-3 rounded-full shadow-lg hover:bg-opacity-90 transition-all font-semibold flex items-center space-x-2"
            aria-label="Give Feedback"
          >
            <span>Beri Feedback</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
         {showFeedbackModal && (
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-100 p-4" // Ensure high z-index
               onClick={() => setShowFeedbackModal(false)}
             >
               <motion.div
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.9, opacity: 0 }}
                 transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                 onClick={(e) => e.stopPropagation()}
                 className='w-full max-w-2xl rounded-lg bg-white text-gray-800 shadow-2xl overflow-hidden'
               >
                    <FeedbackForm
                      onClose={() => setShowFeedbackModal(false)}
                      onSubmitSuccess={handleFeedbackSuccess}
                    />
               </motion.div>
             </motion.div>
         )}
      </AnimatePresence>
    </>
  );
}