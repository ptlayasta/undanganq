import { useMemo, useState } from "react";
import { Calendar, MapPin, Music2, Instagram, Copy, CalendarPlus, ExternalLink, Youtube } from "lucide-react";
import { toast } from "sonner";
import Countdown from "@/components/app/Countdown";

function Ornament({ color = "#c9a961", size = 60 }) {
  return (
    <svg width={size} height="12" viewBox="0 0 120 12" fill="none" className="mx-auto opacity-80">
      <path d="M2 6 Q30 -2 60 6 T118 6" stroke={color} strokeWidth="1" fill="none" />
      <circle cx="60" cy="6" r="2" fill={color} />
      <circle cx="18" cy="6" r="1" fill={color} />
      <circle cx="102" cy="6" r="1" fill={color} />
    </svg>
  );
}

function SectionLabel({ text, accent, mutedColor }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-[0.4em]" style={{ color: mutedColor }}>{text}</div>
      <Ornament color={accent} />
    </div>
  );
}

function fmtDateID(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
  catch { return d; }
}

function ytEmbed(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (!m) return null;
  return `https://www.youtube.com/embed/${m[1]}`;
}

function gcalUrl(cfg) {
  const ev = cfg.events?.[0];
  const date = ev?.date || cfg.event_date;
  const time = ev?.time_start || cfg.event_time || "10:00";
  if (!date) return null;
  const [Y, M, D] = date.split("-");
  const [h, m] = time.split(":");
  const start = `${Y}${M}${D}T${(h || "10").padStart(2, "0")}${(m || "00").padStart(2, "0")}00`;
  const end = `${Y}${M}${D}T${String(Number(h || 10) + 2).padStart(2, "0")}${(m || "00").padStart(2, "0")}00`;
  const text = encodeURIComponent(`${cfg.bride_name || ""} & ${cfg.groom_name || ""} Wedding`);
  const loc = encodeURIComponent(`${ev?.venue || cfg.venue || ""}, ${ev?.address || cfg.venue_address || ""}`);
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&location=${loc}`;
}

export default function InvitationRenderer({ event, template, guest, preview = false }) {
  const cfg = event?.config || {};
  const theme = template?.theme || { primary: "#8a6a3a", accent: "#c9a961", bg: "#f4ecdd", font_heading: "Cormorant Garamond" };
  const isDark = theme.bg && theme.bg.startsWith("#1");
  const textColor = isDark ? "#f4ecdd" : "#2a2018";
  const mutedColor = isDark ? "#b8a992" : "#8a7b6b";
  const accent = theme.accent || "#c9a961";
  const cardBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)";

  const isWedding = event?.event_type === "wedding";
  const [lightbox, setLightbox] = useState(null);

  const targetDate = useMemo(() => {
    const ev = cfg.events?.[0];
    const date = ev?.date || cfg.event_date;
    const time = ev?.time_start || cfg.event_time || "10:00";
    if (!date) return null;
    return `${date}T${(time || "10:00").padEnd(5, "0")}:00`;
  }, [cfg]);

  const heroTitle = isWedding
    ? `${cfg.bride_name || "Bride"} & ${cfg.groom_name || "Groom"}`
    : event?.event_type === "aqiqah" ? cfg.baby_name || "Nama Bayi"
    : cfg.celebrant || event?.title;

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin`);
  };

  const openMaps = (url) => window.open(url || "#", "_blank");

  const videoEmbed = ytEmbed(cfg.video_url);

  return (
    <div
      className="min-h-full relative"
      style={{ background: theme.bg, color: textColor, fontFamily: "Figtree, sans-serif" }}
      data-testid="invitation-renderer"
    >
      {/* HERO */}
      <section className="relative px-6 pt-12 pb-10 text-center overflow-hidden">
        <div className="text-[10px] uppercase tracking-[0.4em]" style={{ color: accent }}>
          {isWedding ? "The Wedding of" : event?.event_type === "aqiqah" ? "Aqiqah" : "Undangan"}
        </div>
        <Ornament color={accent} />
        <h1
          className="mt-3 leading-[1.0]"
          style={{ fontFamily: `${theme.font_heading}, serif`, fontSize: preview ? "2.6rem" : "3.6rem", color: textColor }}
        >
          {heroTitle}
        </h1>
        {cfg.hashtag && (
          <div className="mt-3 text-xs italic" style={{ color: mutedColor }}>{cfg.hashtag}</div>
        )}
        <Ornament color={accent} />
        {targetDate && (
          <div className="mt-3 text-sm" style={{ color: mutedColor, fontFamily: `${theme.font_heading}, serif`, fontSize: "1.1rem" }}>
            {fmtDateID(cfg.events?.[0]?.date || cfg.event_date)}
          </div>
        )}
      </section>

      {/* GUEST GREETING */}
      {guest?.name && (
        <section className="px-6 py-6 text-center" style={{ background: cardBg, borderTop: `1px solid ${accent}33`, borderBottom: `1px solid ${accent}33` }}>
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: mutedColor }}>Kepada Yth.</div>
          <div className="mt-2 text-2xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: textColor }}>{guest.name}</div>
          <div className="text-xs mt-1" style={{ color: mutedColor }}>di tempat</div>
        </section>
      )}

      {/* VERSE */}
      {cfg.verse_text && (
        <section className="px-8 py-10 text-center">
          <p className="italic leading-relaxed" style={{ fontFamily: `${theme.font_heading}, serif`, color: textColor, fontSize: "1.1rem" }}>
            &ldquo;{cfg.verse_text}&rdquo;
          </p>
          {cfg.verse_ref && <div className="mt-3 text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>&mdash; {cfg.verse_ref} &mdash;</div>}
        </section>
      )}

      {/* BRIDE & GROOM */}
      {isWedding && (
        <section className="px-6 py-10" style={{ background: cardBg }}>
          <SectionLabel text="The Bride & Groom" accent={accent} mutedColor={mutedColor} />
          <div className="mt-8 space-y-8">
            {[
              { key: "groom", name: cfg.groom_full_name || cfg.groom_name, photo: cfg.groom_photo, parents: cfg.groom_parents, ig: cfg.groom_instagram },
              { key: "bride", name: cfg.bride_full_name || cfg.bride_name, photo: cfg.bride_photo, parents: cfg.bride_parents, ig: cfg.bride_instagram },
            ].map((p, i) => (
              <div key={p.key} className="text-center">
                {p.photo ? (
                  <img src={p.photo} alt={p.name} className="w-40 h-40 object-cover rounded-full mx-auto border-4" style={{ borderColor: accent }} />
                ) : (
                  <div className="w-40 h-40 rounded-full mx-auto border-4 flex items-center justify-center" style={{ borderColor: accent, background: `${accent}22` }}>
                    <span className="text-5xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: accent }}>
                      {(p.name || "?").slice(0, 1)}
                    </span>
                  </div>
                )}
                <h3 className="mt-5 text-3xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: textColor }}>{p.name || "-"}</h3>
                {p.parents && <p className="mt-2 text-sm max-w-xs mx-auto" style={{ color: mutedColor }}>{p.key === "groom" ? "The Son of " : "The Daughter of "}{p.parents}</p>}
                {p.ig && (
                  <a href={`https://instagram.com/${p.ig.replace("@", "")}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs" style={{ color: accent }}>
                    <Instagram className="w-3.5 h-3.5" /> @{p.ig.replace("@", "")}
                  </a>
                )}
                {i === 0 && (
                  <div className="my-8 text-4xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: accent }}>&</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LOVE STORY */}
      {isWedding && cfg.love_story?.length > 0 && (
        <section className="px-6 py-12">
          <SectionLabel text="Our Love Story" accent={accent} mutedColor={mutedColor} />
          <div className="mt-8 space-y-8">
            {cfg.love_story.map((s, i) => (
              <div key={i} className="text-center">
                {s.photo && (
                  <img src={s.photo} alt="" className="w-full max-w-xs aspect-[4/5] object-cover rounded-2xl mx-auto border-4" style={{ borderColor: `${accent}55` }} />
                )}
                <div className="mt-4 text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>{s.date}</div>
                <h4 className="mt-1 text-2xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: textColor }}>{s.title}</h4>
                <p className="mt-3 text-sm max-w-md mx-auto leading-relaxed" style={{ color: mutedColor }}>{s.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GALLERY */}
      {cfg.gallery?.length > 0 && (
        <section className="px-6 py-12" style={{ background: cardBg }}>
          <SectionLabel text="Portrait of Us" accent={accent} mutedColor={mutedColor} />
          <div className="mt-8 grid grid-cols-2 gap-2">
            {cfg.gallery.slice(0, 8).map((url, i) => (
              <button key={i} onClick={() => setLightbox(url)} className="aspect-square overflow-hidden rounded-lg group">
                <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* VIDEO */}
      {videoEmbed && (
        <section className="px-6 py-12">
          <SectionLabel text="Our Video Gallery" accent={accent} mutedColor={mutedColor} />
          <div className="mt-6 rounded-xl overflow-hidden shadow-lg">
            <div className="aspect-video">
              <iframe src={videoEmbed} title="Wedding video" className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </section>
      )}
      {!videoEmbed && cfg.video_url && (
        <section className="px-6 py-8 text-center">
          <a href={cfg.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm" style={{ color: accent }}>
            <Youtube className="w-4 h-4" /> Tonton Video Kami
          </a>
        </section>
      )}

      {/* SAVE THE DATE + COUNTDOWN */}
      {targetDate && (
        <section className="px-6 py-12 text-center" style={{ background: cardBg }}>
          <SectionLabel text="Save the Date" accent={accent} mutedColor={mutedColor} />
          <div className="mt-6">
            <Countdown targetDate={targetDate} accent={accent} textColor={textColor} />
          </div>
          {gcalUrl(cfg) && (
            <a data-testid="btn-add-calendar" href={gcalUrl(cfg)} target="_blank" rel="noreferrer"
               className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm"
               style={{ background: accent, color: isDark ? "#1a1410" : "white" }}>
              <CalendarPlus className="w-4 h-4" /> Add to Google Calendar
            </a>
          )}
        </section>
      )}

      {/* WEDDING EVENTS */}
      {(cfg.events?.length > 0 || cfg.venue) && (
        <section className="px-6 py-12">
          <SectionLabel text="The Wedding Day" accent={accent} mutedColor={mutedColor} />
          <p className="mt-4 text-center text-sm italic max-w-md mx-auto" style={{ color: mutedColor, fontFamily: `${theme.font_heading}, serif`, fontSize: "1.05rem" }}>
            {cfg.story || "Dengan penuh sukacita, kami mengundang Bapak/Ibu/Saudara/i untuk hadir."}
          </p>
          <div className="mt-8 space-y-5">
            {(cfg.events && cfg.events.length > 0 ? cfg.events : [{ name: "Acara", date: cfg.event_date, time_start: cfg.event_time, venue: cfg.venue, address: cfg.venue_address }]).map((ev, i) => (
              <div key={i} className="rounded-2xl p-6 text-center border" style={{ background: cardBg, borderColor: `${accent}44` }}>
                <div className="text-[10px] uppercase tracking-[0.35em]" style={{ color: accent }}>{ev.name || "Acara"}</div>
                <div className="mt-3 text-2xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: textColor }}>
                  {fmtDateID(ev.date)}
                </div>
                {(ev.time_start || ev.time_end) && (
                  <div className="mt-1 text-sm" style={{ color: mutedColor }}>
                    {ev.time_start || ""}{ev.time_end ? ` - ${ev.time_end}` : ""} WIB
                  </div>
                )}
                <Ornament color={accent} size={40} />
                {ev.venue && <div className="mt-2 font-semibold" style={{ color: textColor }}>{ev.venue}</div>}
                {ev.address && <p className="mt-1 text-xs" style={{ color: mutedColor }}>{ev.address}</p>}
                {ev.maps_url && (
                  <button onClick={() => openMaps(ev.maps_url)} className="mt-4 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border" style={{ borderColor: accent, color: accent }}>
                    <MapPin className="w-3.5 h-3.5" /> View Maps <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* WEDDING GIFT */}
      {cfg.show_gift && cfg.banks?.length > 0 && (
        <section className="px-6 py-12" style={{ background: cardBg }}>
          <SectionLabel text="Wedding Gift" accent={accent} mutedColor={mutedColor} />
          <p className="mt-4 text-center text-sm max-w-sm mx-auto" style={{ color: mutedColor }}>
            Doa restu dan kehadiran Anda sudah lebih dari cukup. Namun jika Anda ingin memberi hadiah, kami menyediakan amplop digital.
          </p>
          <div className="mt-6 space-y-3 max-w-sm mx-auto">
            {cfg.banks.map((b, i) => (
              <div key={i} className="rounded-xl p-4 border" style={{ background: theme.bg, borderColor: `${accent}44` }} data-testid={`bank-${i}`}>
                <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>{b.bank}</div>
                <div className="mt-2 font-mono font-semibold" style={{ color: textColor }}>{b.account_number}</div>
                <div className="text-xs" style={{ color: mutedColor }}>a.n. {b.account_name}</div>
                <button
                  data-testid={`copy-bank-${i}`}
                  onClick={() => copy(b.account_number, "Nomor rekening")}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                  style={{ background: accent, color: isDark ? "#1a1410" : "white" }}
                >
                  <Copy className="w-3 h-3" /> Salin
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Music player */}
      {cfg.music_url && (
        <div className={`${preview ? "sticky" : "fixed"} bottom-4 right-4 z-30`}>
          <details className="rounded-full px-3 py-2 text-xs shadow-lg" style={{ background: theme.bg, border: `1px solid ${accent}`, color: textColor }}>
            <summary className="flex items-center gap-1.5 cursor-pointer list-none"><Music2 className="w-3.5 h-3.5" style={{ color: accent }} /> Musik</summary>
            <audio controls autoPlay src={cfg.music_url} className="mt-2 w-56" />
          </details>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
