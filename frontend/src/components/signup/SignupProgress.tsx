"use client";

import { motion } from "framer-motion";
import { FiCheck } from "@/icons";

interface SignupProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export default function SignupProgress({ 
  currentStep, 
  totalSteps, 
  stepLabels = ["Account", "Personal", "Academic", "Preferences"] 
}: SignupProgressProps) {
  return (
    <div className="w-full mb-8">
      {/* Progress Bar */}
      <div className="relative">
        {/* Background Bar */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ 
              width: `${(currentStep / totalSteps) * 100}%` 
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="h-full bg-linear-to-r from-[#FFCA40] to-[#FFD700]"
          />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between mt-4">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const isUpcoming = stepNumber > currentStep;

            return (
              <div key={index} className="flex flex-col items-center flex-1">
                {/* Circle Indicator */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ 
                    scale: isCurrent ? 1.1 : 1,
                    backgroundColor: isCompleted 
                      ? "#FFCA40" 
                      : isCurrent 
                        ? "#FFCA40" 
                        : "rgba(255, 255, 255, 0.2)"
                  }}
                  transition={{ duration: 0.3 }}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    border-2 
                    ${isCompleted ? "border-[#FFCA40]" : ""}
                    ${isCurrent ? "border-[#FFCA40] shadow-lg shadow-[#FFCA40]/50" : ""}
                    ${isUpcoming ? "border-white/30" : ""}
                  `}
                >
                  {isCompleted ? (
                    <FiCheck className="w-5 h-5 text-[#001D58]" />
                  ) : (
                    <span 
                      className={`
                        text-sm font-bold
                        ${isCurrent ? "text-[#001D58]" : "text-white/60"}
                      `}
                    >
                      {stepNumber}
                    </span>
                  )}
                </motion.div>

                {/* Step Label */}
                <motion.p
                  animate={{
                    color: isCurrent ? "#FFCA40" : isCompleted ? "#6A98F0" : "rgba(255, 255, 255, 0.5)"
                  }}
                  className="text-xs font-medium mt-2 text-center hidden sm:block"
                >
                  {stepLabels[index]}
                </motion.p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Step Counter */}
      <div className="text-center mt-4 sm:hidden">
        <p className="text-white/70 text-sm">
          Step <span className="text-[#FFCA40] font-bold">{currentStep}</span> of {totalSteps}:{" "}
          <span className="text-white font-medium">{stepLabels[currentStep - 1]}</span>
        </p>
      </div>
    </div>
  );
}
