import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api";
import InvitationRenderer from "@/components/app/InvitationRenderer";
import { toast } from "sonner";
import { Check, X, Users, MessageCircle, Send, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PublicInvitation() {
  const { slug, guestSlug } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [opened, setOpened] = useState(false);
  const [rsvp, setRsvp] = useState({ status: "", guest_count: 1, notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wishes, setWishes] = useState([]);
  const [wishForm, setWishForm] = useState({ name: guestSlug ? "" : "", message: "", attending: "" });
  const [wishBusy, setWishBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [inv, tpl, ws] = await Promise.all([
          apiClient.get(`/public/inv/${slug}`, { params: guestSlug ? { guest: guestSlug } : {} }),
          apiClient.get(`/templates`),
          apiClient.get(`/public/inv/${slug}/wishes`).catch(() => ({ data: [] })),
        ]);
        setData(inv.data);
        setTemplates(tpl.data);
        setWishes(ws.data || []);
        if (inv.data.guest?.name) setWishForm((w) => ({ ...w, name: inv.data.guest.name }));
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
        rsvp_status: rsvp.status, guest_count: Number(rsvp.guest_count) || 1, notes: rsvp.notes,
      });
      setSubmitted(true);
      toast.success("Terima kasih atas konfirmasinya!");
    } catch { toast.error("Gagal kirim RSVP"); } finally { setBusy(false); }
  };

  const submitWish = async () => {
    if (!wishForm.name.trim() || !wishForm.message.trim()) return toast.error("Nama dan pesan wajib diisi");
    setWishBusy(true);
    try {
      const { data: w } = await apiClient.post(`/public/inv/${slug}/wishes`, {
        ...wishForm,
        guest_slug: guestSlug || null,
        guest_count: rsvp.guest_count || 1,
      });
      setWishes((prev) => [w, ...prev]);
      // If cascade RSVP happened, sync local state too
      if (w.rsvp_updated) {
        setSubmitted(true);
        setRsvp((r) => ({ ...r, status: wishForm.attending, notes: wishForm.message }));
      }
      setWishForm((f) => ({ ...f, message: "", attending: "" }));
      toast.success(w.rsvp_updated ? "Ucapan & RSVP terkirim" : "Ucapan terkirim");
    } catch { toast.error("Gagal kirim ucapan"); } finally { setWishBusy(false); }
  };

  if (notFound) {
    return <div className="min-h-screen flex items-center justify-center text-center px-6">
      <div>
        <div className="font-heading text-3xl font-bold">Undangan tidak ditemukan</div>
        <p className="text-neutral-500 mt-2">Link mungkin salah atau undangan belum diterbitkan.</p>
      </div>
    </div>;
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#c9a961] border-t-transparent rounded-full animate-spin" /></div>;

  const template = templates.find((t) => t.template_id === data.event.template_id);
  const theme = template?.theme || { primary: "#8a6a3a", accent: "#c9a961", bg: "#f4ecdd", font_heading: "Cormorant Garamond" };
  const cfg = data.event.config || {};
  const isDark = theme.bg?.startsWith("#1");
  const accent = theme.accent || "#c9a961";
  const heroTitle = data.event.event_type === "wedding"
    ? `${cfg.bride_name || ""} & ${cfg.groom_name || ""}`
    : cfg.baby_name || cfg.celebrant || data.event.title;

  return (
    <div className="min-h-screen" data-testid="public-invitation" style={{ background: theme.bg }}>
      <AnimatePresence>
        {!opened && (
          <motion.div
            key="cover"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.9 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
            style={{
              background: cfg.hero_bg ? `url(${cfg.hero_bg}) center/cover` : theme.bg,
              color: cfg.hero_text_color || (isDark ? "#f4ecdd" : "#2a2018"),
            }}
            data-testid="cover-gate"
          >
            {cfg.hero_bg && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: cfg.hero_overlay_color || "rgba(0,0,0,0.45)", opacity: (cfg.hero_overlay_opacity ?? 55) / 100 }}
              />
            )}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(https://katsudoto.id/media/template/exclusive/anselma/original/Orn-17.png)", backgroundSize: "180px", backgroundRepeat: "space" }} />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.4em]" style={{ color: cfg.hero_text_color || accent }}>
                {cfg.hero_label !== undefined && cfg.hero_label !== "" ? cfg.hero_label : "The Wedding of"}
              </div>
              <motion.h1
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }}
                className="mt-4"
                style={{ fontFamily: `${theme.font_heading}, serif`, fontSize: "4rem", lineHeight: 1 }}
              >
                {heroTitle}
              </motion.h1>
              {cfg.hashtag && <div className="mt-3 italic text-sm" style={{ color: accent }}>{cfg.hashtag}</div>}
              {data.guest?.name && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-10">
                  <div className="text-[10px] uppercase tracking-[0.3em] opacity-70">Kepada Yth.</div>
                  <div className="mt-2 text-xl" style={{ fontFamily: `${theme.font_heading}, serif` }}>{data.guest.name}</div>
                </motion.div>
              )}
              <motion.button
                data-testid="btn-open-invitation"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
                onClick={() => setOpened(true)}
                className="mt-12 inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm shadow-lg hover:scale-105 transition-transform"
                style={{ background: accent, color: isDark ? "#1a1410" : "white" }}
              >
                <Mail className="w-4 h-4" /> Buka Undangan
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto shadow-2xl" style={{ background: theme.bg }}>
        <InvitationRenderer event={data.event} template={template} guest={data.guest} />

        {/* RSVP */}
        {data.guest && (
          <section className="px-6 py-12" data-testid="rsvp-form-section" style={{ background: theme.bg }}>
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-[0.4em]" style={{ color: accent }}>RSVP</div>
              <h3 className="mt-3 text-3xl" style={{ fontFamily: `${theme.font_heading}, serif` }}>Konfirmasi Kehadiran</h3>
            </div>
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm border" style={{ borderColor: `${accent}44` }}>
              {submitted ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: `${accent}22` }}>
                    <Check className="w-7 h-7" style={{ color: accent }} />
                  </div>
                  <div className="mt-3 font-heading text-xl font-bold">Terima kasih!</div>
                  <p className="text-sm text-neutral-500 mt-1">Respon Anda: <b>{rsvp.status === "attending" ? "Hadir" : "Tidak Hadir"}</b></p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button data-testid="btn-attending" onClick={() => setRsvp((r) => ({ ...r, status: "attending" }))}
                            className={`py-3 rounded-lg border-2 font-semibold text-sm ${rsvp.status === "attending" ? "border-[#4a5d4e] bg-[#4a5d4e] text-white" : "border-[#e2dfd9]"}`}>
                      <Check className="w-4 h-4 inline mr-1.5" /> Hadir
                    </button>
                    <button data-testid="btn-not-attending" onClick={() => setRsvp((r) => ({ ...r, status: "not_attending" }))}
                            className={`py-3 rounded-lg border-2 font-semibold text-sm ${rsvp.status === "not_attending" ? "border-[#c05c46] bg-[#c05c46] text-white" : "border-[#e2dfd9]"}`}>
                      <X className="w-4 h-4 inline mr-1.5" /> Berhalangan
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
                    <Textarea data-testid="input-notes" rows={2} value={rsvp.notes} onChange={(e) => setRsvp((r) => ({ ...r, notes: e.target.value }))} placeholder="Selamat, semoga bahagia..." className="mt-1" />
                  </div>
                  <button data-testid="btn-submit-rsvp" disabled={busy} onClick={submitRsvp} className="w-full py-3 rounded-full text-sm font-semibold" style={{ background: accent, color: isDark ? "#1a1410" : "white" }}>
                    {busy ? "Mengirim..." : "Kirim Konfirmasi"}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* WISHES / GUESTBOOK */}
        {cfg.show_wishes !== false && (
          <section className="px-6 py-12" data-testid="wishes-section" style={{ background: theme.bg }}>
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-[0.4em]" style={{ color: accent }}>Wedding Wish</div>
              <h3 className="mt-3 text-3xl" style={{ fontFamily: `${theme.font_heading}, serif` }}>Ucapan & Doa</h3>
              <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: "#8a7b6b" }}>
                Bagikan doa dan ucapan terbaik Anda untuk perjalanan baru kami.
              </p>
            </div>

            <div className="mt-6 rounded-2xl bg-white p-5 border" style={{ borderColor: `${accent}44` }}>
              <div className="space-y-3">
                <Input data-testid="input-wish-name" placeholder="Nama Anda" value={wishForm.name} onChange={(e) => setWishForm((f) => ({ ...f, name: e.target.value }))} />
                <Textarea data-testid="input-wish-message" rows={3} placeholder="Tuliskan doa & ucapan Anda..." value={wishForm.message} onChange={(e) => setWishForm((f) => ({ ...f, message: e.target.value }))} />
                <div className="flex gap-2">
                  {[
                    { k: "attending", l: "Hadir" },
                    { k: "not_attending", l: "Tidak" },
                    { k: "maybe", l: "Mungkin" },
                  ].map((o) => (
                    <button key={o.k}
                            data-testid={`wish-att-${o.k}`}
                            onClick={() => setWishForm((f) => ({ ...f, attending: f.attending === o.k ? "" : o.k }))}
                            className={`flex-1 py-2 rounded-lg text-xs border-2 ${wishForm.attending === o.k ? "border-current" : "border-[#e2dfd9]"}`}
                            style={{ color: wishForm.attending === o.k ? accent : "#8a7b6b" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <button data-testid="btn-submit-wish" disabled={wishBusy} onClick={submitWish} className="w-full py-2.5 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2" style={{ background: accent, color: isDark ? "#1a1410" : "white" }}>
                  <Send className="w-4 h-4" /> {wishBusy ? "Mengirim..." : "Kirim Ucapan"}
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-3 max-h-96 overflow-y-auto" data-testid="wishes-list">
              {wishes.length === 0 ? (
                <div className="text-center text-xs py-4" style={{ color: "#8a7b6b" }}>
                  <MessageCircle className="w-5 h-5 mx-auto opacity-40" />
                  Jadilah yang pertama berdoa untuk kami.
                </div>
              ) : (
                wishes.map((w) => (
                  <div key={w.wish_id} className="rounded-lg bg-white p-3 border" style={{ borderColor: `${accent}22` }} data-testid={`wish-${w.wish_id}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{w.name}</div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                        {w.attending === "attending" ? "Hadir" : w.attending === "not_attending" ? "Tidak Hadir" : w.attending === "maybe" ? "Mungkin" : ""}
                      </div>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: "#3a3028" }}>{w.message}</p>
                    <div className="mt-1 text-[10px]" style={{ color: "#a89988" }}>
                      {new Date(w.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        <footer className="px-6 py-10 text-center text-xs" style={{ background: theme.bg, color: "#a89988" }}>
          <div className="mb-2 text-2xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: accent }}>Terima Kasih</div>
          Undangan Digital · {heroTitle}
        </footer>
      </div>
    </div>
  );
}
