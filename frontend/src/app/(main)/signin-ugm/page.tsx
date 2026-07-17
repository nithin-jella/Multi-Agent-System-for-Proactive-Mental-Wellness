"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import GoogleSignInButton from "@/components/ui/GoogleSignInButton";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import ErrorMessage from "../../../components/ErrorMessage";
import { FiShield, FiInfo, FiCheckCircle } from "@/icons";
// import AccountLinker from "@/components/AccountLinker";

export default function SignInUGM() {
  const router = useRouter();
  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Redirect if already authenticated
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col lg:flex-row relative pt-24">
      {/* Left Side - Institutional Context */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 px-12 py-12">
        <div className="flex flex-col justify-between w-full">
          <div>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <Image
                  src="/aika-avatar.png"
                  alt="UGM"
                  width={28}
                  height={28}
                  className="w-7 h-7"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Universitas Gadjah Mada</p>
                <h1 className="text-2xl font-bold text-white">UGM-AICare SSO Access</h1>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-4xl font-bold leading-tight">
                Verified access to Aika.
              </h2>
              <p className="text-white/70 text-base leading-relaxed">
                Sign in with your official UGM credentials to enter your Aika dashboard, aligned with campus policies and student support pathways.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-10">
              {[
                { title: "Institutional SSO", detail: "UGM-backed authentication" },
                { title: "Verified Access", detail: "Student-only sessions" },
                { title: "Privacy First", detail: "Confidential data handling" },
                { title: "Fast Onboarding", detail: "One click to begin" }
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-white/60 mt-1">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/50">
            <FiCheckCircle className="w-4 h-4 text-[#FFCA40]" />
            <span>Only @ugm.ac.id and @mail.ugm.ac.id accounts are accepted.</span>
          </div>
        </div>
      </div>

      {/* Right Side - Sign-In Card */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-lg max-w-md w-full"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#FFCA40]/10 flex items-center justify-center">
              <FiShield className="w-6 h-6 text-[#FFCA40]" />
            </div>
            <div>
              <h1 className="text-xl font-bold">UGM Single Sign-On</h1>
              <p className="text-white/60 text-sm">Access your student support dashboard.</p>
            </div>
          </div>
          
          {/* Wrap useSearchParams in a Suspense boundary */}
          <Suspense fallback={<div className="h-12"></div>}>
            <ErrorMessage setError={setError} />
          </Suspense>
          
          {error && (
            <div className="bg-red-500/15 border border-red-500/40 text-white p-3 rounded-lg mb-6 text-sm flex items-start gap-2">
              <FiInfo className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="flex justify-center">
            <GoogleSignInButton />
            {/* <AccountLinker /> */}
          </div>
          
          <div className="mt-6 text-center">
            <Link href="/signin" className="text-sm text-[#FFCA40] hover:underline">
              Sign in with email and password instead
            </Link>
          </div>
          
          <p className="text-xs text-center text-gray-400 mt-8">
            By signing in, you agree to our Terms of Service and Privacy Policy.
            Only UGM email addresses are allowed.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
