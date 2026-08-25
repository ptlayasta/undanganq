import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import Header from "@/components/app/Header";
import { toast } from "sonner";
import { CheckCircle2, QrCode, ArrowRight, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const PAYMENT_METHODS = [
  { id: "QRIS", label: "QRIS", desc: "Semua e-wallet & mobile banking" },
  { id: "BCA_VA", label: "BCA Virtual Account", desc: "Transfer via ATM/M-banking" },
  { id: "GOPAY", label: "GoPay", desc: "Bayar dengan GoPay" },
  { id: "OVO", label: "OVO", desc: "Bayar dengan OVO" },
  { id: "DANA", label: "DANA", desc: "Bayar dengan DANA" },
];

export default function Publish() {
  const { eventId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState("QRIS");
  const [openPay, setOpenPay] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate("/", { replace: true }); }, [loading, user, navigate]);
  useEffect(() => { (async () => {
    try { const { data } = await apiClient.get(`/events/${eventId}`); setEvent(data); } catch (e) { /* ignore */ }
  })(); }, [eventId]);

  const publishFree = async () => {
    setBusy(true);
    try {
      await apiClient.post(`/events/${eventId}/publish-free`);
      toast.success("Undangan diterbitkan (versi gratis)");
      navigate("/dashboard");
    } catch { toast.error("Gagal terbitkan"); } finally { setBusy(false); }
  };

  const startCheckout = async () => {
    try {
      const { data } = await apiClient.post(`/events/${eventId}/checkout`);
      setCheckout(data);
      setOpenPay(true);
    } catch { toast.error("Checkout gagal"); }
  };

  const completePayment = async () => {
    setBusy(true);
    try {
      await apiClient.post(`/payments/${checkout.payment_id}/complete`);
      toast.success("Pembayaran berhasil! Undangan terbit sebagai Premium.");
      setOpenPay(false);
      navigate("/dashboard");
    } catch { toast.error("Konfirmasi gagal"); } finally { setBusy(false); }
  };

  if (!event) return <div className="min-h-screen"><Header /></div>;

  return (
    <div className="min-h-screen" data-testid="publish-page">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <span className="overline">Terbitkan Undangan</span>
        <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Siap dibagikan ke tamu Anda?</h1>
        <p className="text-neutral-500 mt-2 font-body">Pilih paket yang sesuai. Anda bisa upgrade kapan saja.</p>

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="rounded-3xl border border-[#e2dfd9] bg-white p-8" data-testid="tier-free">
            <div className="overline">Gratis</div>
            <div className="mt-3 font-heading text-4xl font-bold">Rp0</div>
            <ul className="mt-6 space-y-2 text-sm text-neutral-700 font-body">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#4a5d4e] mt-0.5" /> Halaman undangan publik</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#4a5d4e] mt-0.5" /> RSVP dashboard</li>
              <li className="flex gap-2 opacity-50"><span className="w-4 h-4 mt-0.5">✕</span> Kirim link via WhatsApp</li>
              <li className="flex gap-2 opacity-50"><span className="w-4 h-4 mt-0.5">✕</span> Template premium</li>
            </ul>
            <button data-testid="btn-publish-free" disabled={busy} onClick={publishFree} className="btn-ghost w-full mt-6 justify-center">Terbitkan Gratis</button>
          </div>

          <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 relative overflow-hidden" data-testid="tier-premium">
            <Sparkles className="absolute -top-4 -right-4 w-32 h-32 text-[#d4af37]/10" />
            <div className="overline" style={{ color: "#d4af37" }}>Premium</div>
            <div className="mt-3 font-heading text-4xl font-bold">Rp149.000</div>
            <ul className="mt-6 space-y-2 text-sm text-white/85 font-body">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#d4af37] mt-0.5" /> Semua fitur gratis</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#d4af37] mt-0.5" /> Kirim link personal via WhatsApp</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#d4af37] mt-0.5" /> Template premium & musik</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#d4af37] mt-0.5" /> Tamu tanpa batas</li>
            </ul>
            <button data-testid="btn-checkout" onClick={startCheckout} className="btn-primary w-full mt-6 justify-center">
              Bayar dengan Xendit <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      <Dialog open={openPay} onOpenChange={setOpenPay}>
        <DialogContent className="max-w-md" data-testid="dialog-checkout">
          <DialogHeader>
            <DialogTitle className="font-heading">Bayar dengan Xendit</DialogTitle>
          </DialogHeader>
          <div className="text-xs px-3 py-2 rounded bg-yellow-50 text-yellow-800 border border-yellow-200">
            MOCKED · Simulasi pembayaran Xendit untuk demo.
          </div>
          <div className="text-2xl font-heading font-bold mt-2">Rp149.000</div>
          <div className="space-y-2 mt-4">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                data-testid={`method-${m.id}`}
                onClick={() => setSelectedMethod(m.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${selectedMethod === m.id ? "border-[#c05c46] bg-[#faf3ef]" : "border-[#e2dfd9] hover:border-neutral-400"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{m.label}</div>
                    <div className="text-xs text-neutral-500">{m.desc}</div>
                  </div>
                  {m.id === "QRIS" && <QrCode className="w-5 h-5 text-neutral-400" />}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <button data-testid="btn-confirm-payment" disabled={busy} onClick={completePayment} className="btn-primary w-full justify-center">
              {busy ? "Memproses..." : "Saya Sudah Bayar (Simulasi)"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
