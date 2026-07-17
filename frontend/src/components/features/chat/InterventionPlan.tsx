// src/components/features/chat/InterventionPlan.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InterventionPlan as InterventionPlanType } from '@/types/chat';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Heart,
  BookOpen,
  Play,
} from 'lucide-react';

interface InterventionPlanProps {
  plan: InterventionPlanType;
}

export function InterventionPlan({ plan }: InterventionPlanProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const totalSteps = plan.plan_steps.length;
  const completedCount = completedSteps.size;
  const progressPercent = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mt-4 bg-white/95 backdrop-blur-xl border-2 border-ugm-blue/20 rounded-2xl overflow-hidden shadow-2xl hover:shadow-ugm-blue/20"
    >
      {/* Enhanced Header with Gradient */}
      <div className="bg-linear-to-br from-ugm-blue via-ugm-blue to-ugm-blue-light p-5 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-ugm-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-3 bg-linear-to-br from-ugm-gold to-ugm-gold-light rounded-2xl shadow-xl shrink-0">
                <Sparkles className="w-6 h-6 text-ugm-blue" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  Rencana Dukungan untuk Kamu
                  <span className="text-xs font-semibold text-ugm-gold bg-ugm-gold/20 px-3 py-1 rounded-full border border-ugm-gold/40">
                    {completedCount}/{totalSteps} selesai
                  </span>
                </h4>
                <p className="text-sm text-white/90 mt-1 leading-relaxed">
                  Aku telah menyiapkan beberapa langkah yang bisa membantu. Yuk coba satu per satu!
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-105 shrink-0"
              aria-label={isExpanded ? 'Tutup rencana' : 'Buka rencana'}
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-white" />
              ) : (
                <ChevronDown className="w-5 h-5 text-white" />
              )}
            </button>
          </div>

          {/* Enhanced Progress Bar */}
          {totalSteps > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/80 font-semibold">Progres Kamu</span>
                <span className="text-ugm-gold font-bold">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-3 bg-white/15 rounded-full overflow-hidden backdrop-blur-sm border border-white/20">
                <motion.div
                  className="h-full bg-linear-to-r from-ugm-gold via-ugm-gold-light to-ugm-gold rounded-full shadow-lg relative overflow-hidden"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  <motion.div
                    animate={{ x: ['0%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent"
                    style={{ width: '50%' }}
                  />
                </motion.div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-linear-to-b from-gray-50/50 to-white"
          >
            {/* Plan Steps */}
            {plan.plan_steps.length > 0 && (
              <div className="p-5 space-y-3">
                <h5 className="text-sm font-bold text-ugm-blue flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-ugm-blue/10 flex items-center justify-center">
                    <Heart className="w-4 h-4 text-pink-500" />
                  </div>
                  Langkah-Langkah Aksi
                </h5>
                {plan.plan_steps.map((step, index) => {
                  const isCompleted = completedSteps.has(step.id);
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer group',
                        isCompleted
                          ? 'bg-linear-to-r from-green-50 to-emerald-50 border-green-300/60 shadow-sm'
                          : 'bg-white border-gray-200 hover:border-ugm-blue/50 hover:shadow-md'
                      )}
                      onClick={() => toggleStep(step.id)}
                    >
                      <div className="shrink-0 mt-0.5 transition-transform group-hover:scale-110">
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600 drop-shadow-sm" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-ugm-blue/40 flex items-center justify-center text-xs font-bold text-ugm-blue bg-white shadow-sm group-hover:border-ugm-blue group-hover:bg-ugm-blue/5">
                            {index + 1}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-semibold leading-relaxed',
                            isCompleted
                              ? 'text-gray-500 line-through'
                              : 'text-ugm-blue-dark'
                          )}
                        >
                          {step.label}
                        </p>
                        {step.duration_min && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-600 bg-gray-100 w-fit px-2.5 py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="font-medium">{step.duration_min} menit</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Resource Cards */}
            {plan.resource_cards.length > 0 && (
              <div className="px-5 pb-5 space-y-3">
                <h5 className="text-sm font-bold text-ugm-blue flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-ugm-blue/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-ugm-gold" />
                  </div>
                  Sumber Bantuan Tambahan
                </h5>
                {plan.resource_cards.map((card, index) => {
                  // Check if this is an interactive activity
                  const isActivity = card.resource_type === 'activity' && card.activity_id;
                  
                  if (isActivity) {
                    // Render activity card with special styling
                    return (
                      <motion.div
                        key={card.resource_id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (plan.plan_steps.length + index) * 0.1 }}
                      >
                        <Link
                          href={`/activities?play=${card.activity_id}`}
                          className="block p-4 rounded-xl border-2 bg-linear-to-br from-emerald-50 to-teal-50 border-emerald-300/60 hover:border-emerald-400 hover:shadow-lg transition-all cursor-pointer group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-emerald-800 group-hover:text-emerald-700 transition-colors">
                                  {card.title}
                                </p>
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  Interaktif
                                </span>
                              </div>
                              <p className="text-xs text-emerald-700/80 mt-1 leading-relaxed">
                                {card.summary}
                              </p>
                              <p className="text-xs text-emerald-600 mt-2 font-medium flex items-center gap-1">
                                <Play className="w-3 h-3" />
                                Klik untuk mulai latihan
                              </p>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  }
                  
                  // Regular link resource card
                  return (
                    <motion.a
                      key={card.resource_id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (plan.plan_steps.length + index) * 0.1 }}
                      href={card.url || '#'}
                      target={card.url ? '_blank' : undefined}
                      rel={card.url ? 'noopener noreferrer' : undefined}
                      className={cn(
                        'block p-4 rounded-xl border-2 transition-all',
                        card.url
                          ? 'bg-white border-purple-200/80 hover:border-ugm-gold/60 hover:shadow-lg cursor-pointer group'
                          : 'bg-gray-50 border-gray-200 cursor-default'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ugm-blue-dark group-hover:text-ugm-blue transition-colors">
                            {card.title}
                          </p>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                            {card.summary}
                          </p>
                        </div>
                        {card.url && (
                          <ExternalLink className="w-4 h-4 text-ugm-blue shrink-0 mt-0.5 group-hover:text-ugm-gold transition-colors" />
                        )}
                      </div>
                    </motion.a>
                  );
                })}
              </div>
            )}

            {/* Next Check-in */}
            {plan.next_check_in && (
              <div className="px-5 pb-5">
                <div className="p-4 bg-linear-to-br from-blue-50 to-purple-50 border-2 border-blue-200/60 rounded-xl shadow-sm">
                  <p className="text-sm text-ugm-blue-dark leading-relaxed">
                    <span className="font-bold">Check-in berikutnya:</span>{' '}
                    {new Date(plan.next_check_in).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <p className="text-xs text-gray-700 mt-2 leading-relaxed">
                    Aku akan tanya kabar kamu lagi di waktu itu ya! 💙
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
