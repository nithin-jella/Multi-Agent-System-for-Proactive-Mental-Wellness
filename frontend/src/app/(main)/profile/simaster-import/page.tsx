"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  FiCheck,
  FiChevronRight,
  FiExternalLink,
  FiInfo,
  FiLoader,
  FiShield,
  FiUser,
  FiZap,
  FiBookmark,
} from "react-icons/fi";
import { HiOutlineAcademicCap } from "react-icons/hi2";
import ParticleBackground from "@/components/ui/ParticleBackground";
import apiClient from "@/services/api";

interface SimasterImportData {
  nim?: string;
  name?: string;
  faculty?: string;
  department?: string;
  major?: string;
  batch_year?: string;
  email?: string;
  photo_url?: string;
}

type ImportStep = "ready" | "waiting" | "preview" | "importing" | "success";

export default function SimasterImportPage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentStep, setCurrentStep] = useState<ImportStep>("ready");
  const [importData, setImportData] = useState<SimasterImportData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Generate the bookmarklet code (minified for URL)
  const getBookmarkletCode = useCallback(() => {
    const returnUrl = typeof window !== "undefined" ? window.location.origin : "";
    
    // Minified bookmarklet script
    return `javascript:(function(){if(!window.location.hostname.includes('simaster.ugm.ac.id')){alert('⚠️ Buka halaman ini di simaster.ugm.ac.id terlebih dahulu!');return;}var d={},t=document.body.innerText;var np=[/NIM[:\\s]*([0-9]+\\/[0-9]+\\/[0-9]+)/i,/NIM[:\\s]*([0-9]{6,})/i];for(var p of np){var m=t.match(p);if(m){d.nim=m[1].trim();break;}}var nm=[/Nama\\s+Lengkap[:\\s]*([A-Za-z\\s\\.,']+?)(?=\\n|Tempat|NIM|Email|$)/i,/Nama[:\\s]*([A-Za-z\\s\\.,']+?)(?=\\n|Tempat|NIM|Email|Fakultas|$)/i];for(var p of nm){var m=t.match(p);if(m&&m[1].trim().length>2){d.name=m[1].trim().replace(/\\s+/g,' ');break;}}var fm=t.match(/Fakultas[:\\s]*([A-Za-z\\s]+?)(?=\\n|Departemen|Program|Prodi|$)/i);if(fm)d.faculty=fm[1].trim();var dm=t.match(/Departemen[:\\s]*([A-Za-z\\s]+?)(?=\\n|Program|Prodi|Angkatan|$)/i);if(dm)d.department=dm[1].trim();var pm=[/Program\\s+Studi[:\\s]*([A-Za-z\\s\\-]+?)(?=\\n|Angkatan|Fakultas|$)/i,/Prodi[:\\s]*([A-Za-z\\s\\-]+?)(?=\\n|Angkatan|$)/i];for(var p of pm){var m=t.match(p);if(m){d.major=m[1].trim();break;}}var am=t.match(/Angkatan[:\\s]*([0-9]{4})/i);if(am)d.batch_year=am[1];var em=t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]*ugm\\.ac\\.id)/i);if(em)d.email=em[1];if(!d.nim&&!d.name){alert('❌ Data tidak ditemukan. Pastikan Anda di halaman profil SIMASTER.');return;}var e=btoa(unescape(encodeURIComponent(JSON.stringify(d))));window.location.href='${returnUrl}/profile/simaster-import?data='+e;})();`;
  }, []);

  // Handle data from URL params (when returning from SIMASTER)
  useEffect(() => {
    const dataParam = searchParams.get("data");
    if (dataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
        setImportData(decoded);
        setCurrentStep("preview");
      } catch {
        toast.error("Data tidak valid. Silakan coba lagi.");
        setCurrentStep("ready");
      }
    }
  }, [searchParams]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Proceed to waiting step
  const handleProceedToWaiting = () => {
    setCurrentStep("waiting");
  };

  // Confirm import to backend
  const handleConfirmImport = async () => {
    if (!importData) return;

    setCurrentStep("importing");
    try {
      await apiClient.post("/api/v1/profile/import-simaster", {
        nim: importData.nim,
        name: importData.name,
        email: importData.email,
        faculty: importData.faculty,
        department: importData.department,
        major: importData.major,
        batch_year: importData.batch_year,
      });
      setCurrentStep("success");
      toast.success("Data SIMASTER berhasil diimpor!");

      // Redirect to profile after delay
      setTimeout(() => {
        router.push("/profile");
      }, 2500);
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Gagal mengimpor data. Silakan coba lagi.");
      setCurrentStep("preview");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#232946] via-[#1a1f35] to-[#0d0f1a]">
        <FiLoader className="h-8 w-8 animate-spin text-[#FFCA40]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#232946] via-[#1a1f35] to-[#0d0f1a]">
      <ParticleBackground />

      <div className="relative z-10 mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-lg">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFCA40]/20">
              <HiOutlineAcademicCap className="h-8 w-8 text-[#FFCA40]" />
            </div>
            <h1 className="text-2xl font-bold text-white">Import dari SIMASTER</h1>
            <p className="mt-2 text-sm text-white/60">
              Isi profil otomatis dengan data akademik UGM Anda
            </p>
          </div>

          {/* Step: Ready - Initial state */}
          {currentStep === "ready" && (
            <div className="space-y-6">
              {/* Benefits */}
              <div className="grid gap-3">
                <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                  <FiZap className="h-5 w-5 text-[#FFCA40]" />
                  <span className="text-sm text-white/80">Impor data dalam hitungan detik</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                  <FiShield className="h-5 w-5 text-green-400" />
                  <span className="text-sm text-white/80">Aman & data diproses di browser Anda</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                  <FiCheck className="h-5 w-5 text-blue-400" />
                  <span className="text-sm text-white/80">NIM, nama, fakultas, dan jurusan</span>
                </div>
              </div>

              {/* Main CTA Button */}
              <button
                onClick={handleProceedToWaiting}
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#FFCA40] px-6 py-4 font-semibold text-[#232946] transition-all hover:bg-[#FFD866] hover:shadow-lg hover:shadow-[#FFCA40]/20"
              >
                <HiOutlineAcademicCap className="h-5 w-5" />
                Mulai Import dari SIMASTER
                <FiChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>

              {/* Privacy Note */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <FiInfo className="mt-0.5 h-5 w-5 shrink-0 text-white/40" />
                  <p className="text-xs text-white/50">
                    Anda akan diminta login ke SIMASTER di tab baru. Script ekstraksi berjalan
                    di browser Anda. Password SIMASTER Anda tidak pernah dibagikan ke kami.
                  </p>
                </div>
              </div>

              {/* Manual Alternative */}
              <div className="border-t border-white/10 pt-6">
                <button
                  onClick={() => router.push("/profile")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-transparent px-6 py-3 text-sm text-white/60 transition-all hover:border-white/40 hover:text-white/80"
                >
                  <FiUser className="h-4 w-4" />
                  Atau isi profil manual
                </button>
              </div>
            </div>
          )}

          {/* Step: Waiting - Show bookmarklet instructions */}
          {currentStep === "waiting" && (
            <div className="space-y-6">
              {/* Step 1: Drag Bookmarklet */}
              <div className="rounded-xl border-2 border-dashed border-[#FFCA40]/50 bg-[#FFCA40]/5 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFCA40] text-sm font-bold text-[#232946]">
                    1
                  </div>
                  <span className="font-medium text-white">Seret tombol ini ke Bookmark Bar</span>
                </div>
                
                <div className="flex flex-col items-center gap-4">
                  {/* The draggable bookmarklet button */}
                  <a
                    href={getBookmarkletCode()}
                    onClick={(e) => {
                      e.preventDefault();
                      toast("Seret tombol ini ke bookmark bar browser Anda!", { icon: "👆" });
                    }}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={() => {
                      setIsDragging(false);
                      toast.success("Bagus! Sekarang buka SIMASTER dan klik bookmark tersebut.", { duration: 5000 });
                    }}
                    className={`inline-flex cursor-grab items-center gap-2 rounded-lg bg-[#FFCA40] px-5 py-3 font-semibold text-[#232946] shadow-lg transition-all active:cursor-grabbing ${
                      isDragging ? "scale-95 opacity-70" : "hover:scale-105 hover:shadow-xl"
                    }`}
                    draggable="true"
                  >
                    <FiBookmark className="h-5 w-5" />
                    📥 Import SIMASTER
                  </a>
                  
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                    Seret ke atas ke bookmark bar
                  </div>
                </div>

                {/* Show bookmark bar hint */}
                <div className="mt-4 rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-white/60">
                    <strong className="text-white/80">Tidak melihat Bookmark Bar?</strong><br />
                    Tekan <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">Ctrl+Shift+B</kbd> (Windows) atau <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">Cmd+Shift+B</kbd> (Mac)
                  </p>
                </div>
              </div>

              {/* Step 2: Open SIMASTER */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">Buka SIMASTER & Login</p>
                    <p className="mt-1 text-sm text-white/60">
                      Login dengan akun UGM Anda, lalu buka halaman profil/biodata
                    </p>
                    <a
                      href="https://simaster.ugm.ac.id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/20"
                    >
                      <FiExternalLink className="h-4 w-4" />
                      Buka SIMASTER
                    </a>
                  </div>
                </div>
              </div>

              {/* Step 3: Click Bookmarklet */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-white">Klik Bookmark</p>
                    <p className="mt-1 text-sm text-white/60">
                      Di halaman profil SIMASTER, klik bookmark &quot;📥 Import SIMASTER&quot; yang sudah disimpan
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Guide */}
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                <div className="flex items-start gap-3">
                  <FiInfo className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                  <div>
                    <p className="text-sm text-blue-300">
                      Setelah klik bookmark di SIMASTER, Anda akan otomatis kembali ke halaman ini dengan data profil Anda.
                    </p>
                  </div>
                </div>
              </div>

              {/* Back button */}
              <button
                onClick={() => setCurrentStep("ready")}
                className="w-full text-center text-sm text-white/40 hover:text-white/60"
              >
                ← Kembali
              </button>
            </div>
          )}

          {/* Step: Preview - Show extracted data */}
          {currentStep === "preview" && importData && (
            <div className="space-y-6">
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                <div className="flex items-center gap-3">
                  <FiCheck className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="font-medium text-green-300">Data Berhasil Diambil!</p>
                    <p className="text-sm text-green-300/70">Periksa data di bawah sebelum mengimpor</p>
                  </div>
                </div>
              </div>

              {/* Data Preview Cards */}
              <div className="space-y-2">
                {importData.nim && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/60">NIM</span>
                    <span className="font-medium text-white">{importData.nim}</span>
                  </div>
                )}
                {importData.name && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/60">Nama</span>
                    <span className="font-medium text-white">{importData.name}</span>
                  </div>
                )}
                {importData.email && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/60">Email</span>
                    <span className="font-medium text-white">{importData.email}</span>
                  </div>
                )}
                {importData.faculty && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/60">Fakultas</span>
                    <span className="font-medium text-white">{importData.faculty}</span>
                  </div>
                )}
                {importData.department && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/60">Departemen</span>
                    <span className="font-medium text-white">{importData.department}</span>
                  </div>
                )}
                {importData.major && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/60">Program Studi</span>
                    <span className="font-medium text-white">{importData.major}</span>
                  </div>
                )}
                {importData.batch_year && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/60">Angkatan</span>
                    <span className="font-medium text-white">{importData.batch_year}</span>
                  </div>
                )}
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleConfirmImport}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFCA40] px-6 py-4 font-semibold text-[#232946] transition-all hover:bg-[#FFD866]"
              >
                <FiCheck className="h-5 w-5" />
                Konfirmasi & Simpan ke Profil
              </button>

              {/* Cancel */}
              <button
                onClick={() => {
                  setImportData(null);
                  setCurrentStep("ready");
                  router.replace("/profile/simaster-import");
                }}
                className="w-full text-center text-sm text-white/40 hover:text-white/60"
              >
                Batalkan
              </button>
            </div>
          )}

          {/* Step: Importing */}
          {currentStep === "importing" && (
            <div className="space-y-6 text-center">
              <FiLoader className="mx-auto h-12 w-12 animate-spin text-[#FFCA40]" />
              <div>
                <p className="text-lg font-medium text-white">Menyimpan data...</p>
                <p className="mt-2 text-sm text-white/60">Mohon tunggu sebentar</p>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {currentStep === "success" && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <FiCheck className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-green-300">Import Berhasil!</p>
                <p className="mt-2 text-sm text-white/60">
                  Data SIMASTER Anda telah disimpan. Mengalihkan ke profil...
                </p>
              </div>
              <div className="flex justify-center">
                <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full animate-[progress_2.5s_ease-out_forwards] bg-green-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom keyframes for progress animation */}
      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
