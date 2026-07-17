"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FiAlertTriangle, FiCheckCircle, FiCopy, FiInfo, FiLink, FiLoader } from "react-icons/fi";

import apiClient from "@/services/api";

type StatusState = {
  tone: "success" | "error" | "info";
  message: string;
};

export default function AccountLinker() {
  const { data: session, status, update } = useSession();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [linkStatus, setLinkStatus] = useState<StatusState | null>(null);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [linkedAddress, setLinkedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (typeof session?.user?.wallet_address === "string") {
      setLinkedAddress(session.user.wallet_address);
    } else {
      setLinkedAddress(null);
    }
  }, [session?.user?.wallet_address]);

  const shortAddress = useMemo(() => {
    if (!linkedAddress) return null;
    return `${linkedAddress.slice(0, 6)}...${linkedAddress.slice(-4)}`;
  }, [linkedAddress]);

  const linkWallet = async () => {
    if (status !== "authenticated") {
      setLinkStatus({ tone: "info", message: "Please sign in before linking a wallet." });
      return;
    }

    if (!isConnected || !address) {
      setLinkStatus({
        tone: "error",
        message: "Please connect your wallet first using the Connect Wallet button above.",
      });
      return;
    }

    try {
      setLoading(true);
      setLinkStatus(null);

      const signature = await signMessageAsync({ message: "Linking DID to UGM-AICare" });

      const { data } = await apiClient.post("/link-did", {
        wallet_address: address,
        signature,
      });

      const normalisedAddress = data?.address ?? address;
      await update({ wallet_address: normalisedAddress });
      setLinkedAddress(normalisedAddress);

      setLinkStatus({
        tone: "success",
        message: `Wallet linked: ${normalisedAddress.slice(0, 6)}...${normalisedAddress.slice(-4)}`,
      });
      toast.success("Wallet linked successfully");
    } catch (error: unknown) {
      console.error("Failed to link wallet", error);

      const detail =
        (error as { response?: { data?: { detail?: string } }; message?: string }).response?.data?.detail ??
        (error as Error).message ??
        "Something went wrong while linking your wallet.";

      if (detail.toLowerCase().includes("already linked")) {
        setLinkStatus({ tone: "info", message: detail });
        toast(detail);
      } else if (detail.toLowerCase().includes("user rejected")) {
        setLinkStatus({ tone: "info", message: "Wallet connection was cancelled." });
      } else {
        setLinkStatus({ tone: "error", message: detail });
        toast.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!linkedAddress) return;

    try {
      await navigator.clipboard.writeText(linkedAddress);
      setCopySuccess(true);
      toast.success("Wallet address copied to clipboard");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy address", err);
      setLinkStatus({ tone: "error", message: "We couldn't copy the address. Please try manually." });
    }
  };

  if (status === "loading" || linkedAddress === undefined) {
    return (
      <div className="w-full max-w-md animate-pulse rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
        <div className="h-5 w-32 rounded-full bg-white/10" />
        <div className="mt-4 h-10 w-40 rounded-full bg-white/10" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-white shadow-sm backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/50">Digital identity</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold">
          <FiLink className="h-5 w-5 text-[#FFCA40]" /> Wallet connection
        </h2>
        <p className="mt-1 text-sm text-white/60">Connect your wallet to secure your decentralised identity.</p>
      </div>

      {status !== "authenticated" ? (
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
          Please sign in to manage wallet connections.
        </div>
      ) : (
        <>
          {/* RainbowKit Connect Button - Supports 100+ wallets */}
          <div className="flex justify-center">
            <ConnectButton accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
          </div>

          {linkedAddress ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <FiCheckCircle className="h-4 w-4" />
                Wallet linked
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/80">
                <code className="truncate" title={linkedAddress}>
                  {shortAddress ?? linkedAddress}
                </code>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-wide text-white/70 transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
                >
                  {copySuccess ? (
                    <>
                      <FiCheckCircle className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <FiCopy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : isConnected && address ? (
            <div className="space-y-3">
              <p className="text-sm text-white/60">
                Wallet connected. Click below to link it to your AICare account.
              </p>
              <button
                type="button"
                onClick={linkWallet}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFCA40] px-4 py-2 text-sm font-semibold text-[#001D58] transition hover:bg-[#ffd45c] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" /> Linking...
                  </>
                ) : (
                  "Link Digital Identity"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-white/60">
                Connect your wallet using the button above to link it with your AICare account.
              </p>
            </div>
          )}
        </>
      )}

      {linkStatus && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
            linkStatus.tone === "success"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
              : linkStatus.tone === "info"
              ? "border-white/20 bg-white/10 text-white/70"
              : "border-red-400/40 bg-red-400/10 text-red-200"
          }`}
        >
          {linkStatus.tone === "success" ? (
            <FiCheckCircle className="mt-0.5 h-3.5 w-3.5" />
          ) : linkStatus.tone === "info" ? (
            <FiInfo className="mt-0.5 h-3.5 w-3.5" />
          ) : (
            <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          )}
          <span>{linkStatus.message}</span>
        </div>
      )}
    </div>
  );
}
