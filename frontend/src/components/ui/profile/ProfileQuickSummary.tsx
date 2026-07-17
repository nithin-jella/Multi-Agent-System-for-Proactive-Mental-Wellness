type ProfileQuickSummaryProps = {
  fullName: string;
  primaryEmail?: string | null;
  phone?: string | null;
  city?: string | null;
  university?: string | null;
  major?: string | null;
};

function SummaryItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-sm text-white">{value?.trim() ? value : "Not provided"}</p>
    </div>
  );
}

export default function ProfileQuickSummary({
  fullName,
  primaryEmail,
  phone,
  city,
  university,
  major,
}: ProfileQuickSummaryProps) {
  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-white/50">Core profile</p>
        <h2 className="text-xl font-semibold text-white">Identity & contact summary</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryItem label="Full name" value={fullName} />
        <SummaryItem label="Primary email" value={primaryEmail} />
        <SummaryItem label="Phone" value={phone} />
        <SummaryItem label="City" value={city} />
        <SummaryItem label="University" value={university} />
        <SummaryItem label="Major" value={major} />
      </div>
    </section>
  );
}
