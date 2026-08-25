import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import InvitationRenderer from "@/components/app/InvitationRenderer";
import { toast } from "sonner";
import { Check, X, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PublicInvitation() {
  const { slug, guestSlug } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [rsvp, setRsvp] = useState({ status: "", guest_count: 1, notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [inv, tpl] = await Promise.all([
          apiClient.get(`/public/inv/${slug}`, { params: guestSlug ? { guest: guestSlug } : {} }),
          apiClient.get(`/templates`),
        ]);
        setData(inv.data);
        setTemplates(tpl.data);
        if (inv.data.guest?.rsvp_status && inv.data.guest.rsvp_status !== "pending") {
          setSubmitted(true);
          setRsvp({ status: inv.data.guest.rsvp_status, guest_count: inv.data.guest.guest_count, notes: inv.data.guest.notes });
        }
      } catch {
        setNotFound(true);
      }
    })();
  }, [slug, guestSlug]);

  const submitRsvp = async () => {
    if (!rsvp.status) return toast.error("Pilih hadir atau tidak hadir");
    setBusy(true);
    try {
      await apiClient.post(`/public/inv/${slug}/${guestSlug}/rsvp`, {
        rsvp_status: rsvp.status,
        guest_count: Number(rsvp.guest_count) || 1,
        notes: rsvp.notes,
      });
      setSubmitted(true);
      toast.success("Terima kasih atas konfirmasinya!");
    } catch { toast.error("Gagal kirim RSVP"); } finally { setBusy(false); }
  };

  if (notFound) {
    return <div className="min-h-screen flex items-center justify-center text-center px-6">
      <div>
        <div className="font-heading text-3xl font-bold">Undangan tidak ditemukan</div>
        <p className="text-neutral-500 mt-2">Link mungkin salah atau undangan belum diterbitkan.</p>
      </div>
    </div>;
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#c05c46] border-t-transparent rounded-full animate-spin" /></div>;

  const template = templates.find((t) => t.template_id === data.event.template_id);

  return (
    <div className="min-h-screen" data-testid="public-invitation">
      <InvitationRenderer event={data.event} template={template} guest={data.guest} />
      {data.guest && (
        <section className="max-w-md mx-auto px-6 py-10" data-testid="rsvp-form-section" style={{ background: template?.theme?.bg || "#f9f8f6" }}>
          <div className="rounded-2xl bg-white border border-[#e2dfd9] p-6 shadow-lg">
            <div className="overline text-center">Konfirmasi Kehadiran</div>
            {submitted ? (
              <div className="mt-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#4a5d4e]/10 mx-auto flex items-center justify-center">
                  <Check className="w-7 h-7 text-[#4a5d4e]" />
                </div>
                <div className="mt-3 font-heading text-xl font-bold">Terima kasih!</div>
                <p className="text-sm text-neutral-500 mt-2">Respon Anda: <b>{rsvp.status === "attending" ? "Hadir" : "Tidak Hadir"}</b></p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    data-testid="btn-attending"
                    onClick={() => setRsvp((r) => ({ ...r, status: "attending" }))}
                    className={`py-3 rounded-lg border-2 font-semibold transition-colors ${rsvp.status === "attending" ? "border-[#4a5d4e] bg-[#4a5d4e] text-white" : "border-[#e2dfd9] hover:border-[#4a5d4e]"}`}
                  >
                    <Check className="w-4 h-4 inline mr-1.5" /> Hadir
                  </button>
                  <button
                    data-testid="btn-not-attending"
                    onClick={() => setRsvp((r) => ({ ...r, status: "not_attending" }))}
                    className={`py-3 rounded-lg border-2 font-semibold transition-colors ${rsvp.status === "not_attending" ? "border-[#c05c46] bg-[#c05c46] text-white" : "border-[#e2dfd9] hover:border-[#c05c46]"}`}
                  >
                    <X className="w-4 h-4 inline mr-1.5" /> Tidak
                  </button>
                </div>
                {rsvp.status === "attending" && (
                  <div>
                    <label className="text-xs text-neutral-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Jumlah orang</label>
                    <Input data-testid="input-guest-count" type="number" min={1} max={10} value={rsvp.guest_count} onChange={(e) => setRsvp((r) => ({ ...r, guest_count: e.target.value }))} className="mt-1" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-neutral-500">Pesan (opsional)</label>
                  <Textarea data-testid="input-notes" rows={2} value={rsvp.notes} onChange={(e) => setRsvp((r) => ({ ...r, notes: e.target.value }))} className="mt-1" placeholder="Selamat, semoga bahagia..." />
                </div>
                <button data-testid="btn-submit-rsvp" disabled={busy} onClick={submitRsvp} className="btn-primary w-full justify-center">
                  {busy ? "Mengirim..." : "Kirim Konfirmasi"}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
