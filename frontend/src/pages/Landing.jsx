import { motion } from "framer-motion";
import { loginWithGoogle, useAuth } from "@/lib/auth";
import Header from "@/components/app/Header";
import { CheckCircle2, Send, Sparkles, Music4, Users, QrCode, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HERO_IMG = "https://images.unsplash.com/photo-1670529776180-60e4132ab90c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxiZWF1dGlmdWwlMjB3ZWRkaW5nJTIwdmVudWV8ZW58MHx8fHwxNzg3NjQzMjk0fDA&ixlib=rb-4.1.0&q=85";
const COUPLE_1 = "https://images.unsplash.com/photo-1650377509488-724221735c19?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwzfHxpbmRvbmVzaWFuJTIwd2VkZGluZyUyMGNvdXBsZXxlbnwwfHx8fDE3ODc2NDMyODN8MA&ixlib=rb-4.1.0&q=85";
const FLORAL = "https://images.unsplash.com/photo-1543157145-f78c636d023d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwxfHxib3RhbmljYWwlMjBmbG9yYWwlMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc4NzY0MzI4OHww&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const goStart = () => (user ? navigate("/dashboard") : loginWithGoogle());

  return (
    <div className="min-h-screen inv-bg" data-testid="landing-page">
      <Header variant="landing" />

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="overline">Undangan Digital · Nusantara</span>
            <h1 className="font-heading font-extrabold tracking-tight text-5xl sm:text-6xl lg:text-7xl mt-4 leading-[0.98]">
              Kirim undangan yang <span className="italic font-serif text-[#c05c46]">berkesan</span>,<br />
              lewat WhatsApp.
            </h1>
            <p className="mt-6 text-lg text-neutral-600 max-w-xl font-body">
              Buat undangan pernikahan, aqiqah, dan ulang tahun dengan template elegan.
              Kelola tamu, kirim link personal via WhatsApp, dan pantau RSVP real-time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button data-testid="hero-get-started" onClick={goStart} className="btn-primary">
                Mulai Gratis <ChevronRight className="w-4 h-4" />
              </button>
              <button data-testid="hero-see-templates" onClick={() => navigate("/templates")} className="btn-ghost">
                Lihat Template
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500 font-body">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#4a5d4e]" /> Bahasa Indonesia</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#4a5d4e]" /> QRIS · VA · e-wallet</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#4a5d4e]" /> Musik & Video</span>
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-5 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full overflow-hidden border-8 border-white shadow-xl rotate-[-6deg] floating">
              <img src={FLORAL} alt="floral" className="w-full h-full object-cover" />
            </div>
            <div className="phone-frame mx-auto">
              <div className="phone-inner inv-bg text-center px-6 pt-10 pb-8" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                <div className="overline">The Wedding of</div>
                <h2 className="font-serif text-4xl mt-3">Andi &amp; Rina</h2>
                <div className="divider-gold" />
                <img src={COUPLE_1} alt="couple" className="w-full h-48 object-cover rounded-2xl mt-2" />
                <p className="mt-5 text-sm text-neutral-700 font-body">
                  Sabtu, 15 Juni 2026<br />Bali, Indonesia
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs bg-white border border-[#e2dfd9] rounded-full px-3 py-1.5">
                  <QrCode className="w-3.5 h-3.5" /> RSVP di halaman ini
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* BENTO FEATURES */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-10">
          <span className="overline">Fitur Utama</span>
          <h2 className="font-heading font-bold text-4xl sm:text-5xl mt-3 tracking-tight max-w-2xl">
            Semua yang Anda butuhkan untuk hari besar.
          </h2>
        </div>

        <div className="bento">
          <div className="col-span-12 lg:col-span-7 min-h-[280px]" style={{ background: "linear-gradient(135deg, #4a5d4e 0%, #2e3d31 100%)", color: "white" }}>
            <span className="overline" style={{ color: "#d4af37" }}>Editor Modern</span>
            <h3 className="font-heading text-3xl font-bold mt-3">Editor drag-and-form, live preview mobile.</h3>
            <p className="mt-3 text-white/70 font-body">
              Ubah teks, warna, foto, video, dan musik latar. Preview langsung dalam bingkai HP di sisi kanan.
            </p>
            <Sparkles className="w-32 h-32 text-white/10 absolute -bottom-4 -right-4" />
          </div>
          <div className="col-span-12 lg:col-span-5 min-h-[280px]">
            <span className="overline">WhatsApp Bulk</span>
            <h3 className="font-heading text-2xl font-bold mt-3">Link personal untuk setiap tamu.</h3>
            <p className="mt-3 text-neutral-600 font-body text-sm">
              <span className="font-mono text-[#c05c46]">yourevent.com/pak-budi</span> — pesan disesuaikan dengan nama tamu.
            </p>
            <div className="mt-6 flex items-center gap-2 text-[#25d366]">
              <Send className="w-5 h-5" /> <span className="font-semibold">Kirim ke 500+ tamu sekali klik</span>
            </div>
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-4 min-h-[220px]">
            <Users className="w-8 h-8 text-[#c05c46]" />
            <h3 className="font-heading text-xl font-bold mt-4">RSVP Real-time</h3>
            <p className="mt-2 text-neutral-600 text-sm font-body">Dashboard dengan grafik hadir, tidak hadir, dan pending.</p>
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-4 min-h-[220px]">
            <Music4 className="w-8 h-8 text-[#c05c46]" />
            <h3 className="font-heading text-xl font-bold mt-4">Musik & Video</h3>
            <p className="mt-2 text-neutral-600 text-sm font-body">Upload lagu latar dan video pre-wedding tanpa batas.</p>
          </div>
          <div className="col-span-12 lg:col-span-4 min-h-[220px]" style={{ background: FLORAL ? `url(${FLORAL}) center/cover` : "", color: "white" }}>
            <div className="absolute inset-0 bg-black/45" />
            <div className="relative">
              <span className="overline" style={{ color: "#f5c88a" }}>Bahasa Nusantara</span>
              <h3 className="font-heading text-2xl font-bold mt-3 text-white">Wedding · Aqiqah · Ultah</h3>
              <p className="mt-2 text-white/80 text-sm font-body">Template kultural untuk momen paling penting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <span className="overline">Harga</span>
            <h2 className="font-heading font-bold text-4xl mt-3 tracking-tight">Mulai gratis. Upgrade saat siap.</h2>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-8 rounded-3xl border border-[#e2dfd9] bg-white">
            <div className="overline">Gratis</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-5xl font-bold">Rp0</span>
              <span className="text-neutral-500">selamanya</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-neutral-700 font-body">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#4a5d4e] mt-0.5" /> 3 template dasar</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#4a5d4e] mt-0.5" /> Sampai 30 tamu</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#4a5d4e] mt-0.5" /> Halaman undangan publik</li>
              <li className="flex gap-2 opacity-50"><CheckCircle2 className="w-4 h-4 mt-0.5" /> Tanpa pengiriman WhatsApp</li>
            </ul>
            <button data-testid="pricing-free-cta" onClick={goStart} className="btn-ghost w-full mt-6 justify-center">Mulai Gratis</button>
          </div>
          <div className="p-8 rounded-3xl bg-[#1a1a1a] text-white relative overflow-hidden">
            <span className="absolute top-6 right-6 text-xs px-2 py-1 rounded-full bg-[#d4af37] text-black font-bold">POPULER</span>
            <div className="overline" style={{ color: "#d4af37" }}>Premium</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-5xl font-bold">Rp149rb</span>
              <span className="text-white/50">/undangan</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-white/85 font-body">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#d4af37] mt-0.5" /> Semua template premium</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#d4af37] mt-0.5" /> Tamu tanpa batas</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#d4af37] mt-0.5" /> Pengiriman WhatsApp bulk</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#d4af37] mt-0.5" /> Upload musik & video</li>
            </ul>
            <button data-testid="pricing-premium-cta" onClick={goStart} className="btn-primary w-full mt-6 justify-center">Bayar dengan QRIS</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e2dfd9] py-10 mt-10">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-sm text-neutral-500 font-body">
          <span>© 2026 Undangan Digital</span>
          <span className="overline">Made with love in Indonesia</span>
        </div>
      </footer>
    </div>
  );
}
