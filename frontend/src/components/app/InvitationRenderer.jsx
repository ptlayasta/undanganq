import { useMemo, useState, useRef, useEffect } from "react";
import { Calendar, MapPin, Music2, VolumeX, Instagram, Copy, CalendarPlus, ExternalLink, Youtube } from "lucide-react";
import { toast } from "sonner";
import Countdown from "@/components/app/Countdown";
import Ornament from "@/components/app/Ornament";

function SectionLabel({ text, accent, mutedColor, variant = "floral" }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-[0.4em]" style={{ color: mutedColor }}>{text}</div>
      <Ornament variant={variant} color={accent} />
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

function MusicToggle({ url, accent, bg, preview }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = true;
    a.volume = 0.5;
    const p = a.play();
    if (p && p.then) p.then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src={url} preload="auto" />
      <button
        data-testid="music-toggle"
        onClick={toggle}
        aria-label={playing ? "Matikan musik" : "Nyalakan musik"}
        className={`${preview ? "sticky" : "fixed"} bottom-5 right-5 z-30 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105`}
        style={{ background: accent, color: bg?.startsWith("#1") ? "#1a1410" : "white" }}
      >
        <span className={`absolute inset-0 rounded-full ${playing ? "animate-ping" : ""}`} style={{ background: accent, opacity: 0.35 }} />
        <span className="relative">
          {playing ? <Music2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </span>
      </button>
    </>
  );
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
  const ornamentVariant = cfg.ornament_set || theme.ornament || "floral";
  const show = (key, defaultOn = true) => cfg[key] !== false && (cfg[key] === true || defaultOn);

  const targetDate = useMemo(() => {
    const ev = cfg.events?.[0];
    const date = ev?.date || cfg.event_date;
    const time = ev?.time_start || cfg.event_time || "10:00";
    if (!date) return null;
    return `${date}T${(time || "10:00").padEnd(5, "0")}:00`;
  }, [cfg]);

  const heroLabel = cfg.hero_label !== undefined && cfg.hero_label !== "" ? cfg.hero_label : ({
    wedding: "The Wedding of", engagement: "Engagement of", aqiqah: "Aqiqah",
    khitanan: "Khitanan", birthday: "Ulang Tahun", graduation: "Wisuda",
    anniversary: "Anniversary", baby_shower: "Baby Shower", syukuran: "Syukuran",
    corporate: "Corporate Event",
  }[event?.event_type] || "Undangan");

  const heroTitle = isWedding || event?.event_type === "engagement" || event?.event_type === "anniversary"
    ? `${cfg.bride_name || cfg.mother_name || ""} & ${cfg.groom_name || cfg.father_name || ""}`
    : event?.event_type === "aqiqah" ? cfg.baby_name || "Nama Bayi"
    : event?.event_type === "khitanan" ? cfg.child_name || "Nama Anak"
    : event?.event_type === "graduation" ? cfg.graduate_name || event?.title
    : event?.event_type === "baby_shower" ? `Baby ${cfg.mother_name || ""}`
    : event?.event_type === "syukuran" ? cfg.occasion || event?.title
    : event?.event_type === "corporate" ? cfg.event_name || event?.title
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
      <section
        className="relative px-6 pt-12 pb-10 text-center overflow-hidden"
        style={cfg.hero_bg ? {
          backgroundImage: `url(${cfg.hero_bg})`,
          backgroundSize: "cover",
          backgroundPosition: cfg.hero_bg_position || "center",
        } : {}}
      >
        {cfg.hero_bg && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: cfg.hero_overlay_color || (isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)"), opacity: (cfg.hero_overlay_opacity ?? 45) / 100 }}
          />
        )}
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.4em]" style={{ color: cfg.hero_text_color || accent }}>{heroLabel}</div>
          <Ornament variant={ornamentVariant} color={cfg.hero_text_color || accent} />
          <h1
            className="mt-3 leading-[1.0]"
            style={{ fontFamily: `${theme.font_heading}, serif`, fontSize: preview ? "2.6rem" : "3.6rem", color: cfg.hero_text_color || textColor }}
          >
            {heroTitle}
          </h1>
          {cfg.hashtag && (
            <div className="mt-3 text-xs italic" style={{ color: cfg.hero_text_color || mutedColor, opacity: 0.85 }}>{cfg.hashtag}</div>
          )}
          <Ornament variant={ornamentVariant} color={cfg.hero_text_color || accent} />
          {targetDate && (
            <div className="mt-3 text-sm" style={{ color: cfg.hero_text_color || mutedColor, fontFamily: `${theme.font_heading}, serif`, fontSize: "1.1rem", opacity: 0.9 }}>
              {fmtDateID(cfg.events?.[0]?.date || cfg.event_date)}
            </div>
          )}
        </div>
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
      {show("show_verse") && cfg.verse_text && (
        <section className="px-8 py-10 text-center">
          <p className="italic leading-relaxed" style={{ fontFamily: `${theme.font_heading}, serif`, color: textColor, fontSize: "1.1rem" }}>
            &ldquo;{cfg.verse_text}&rdquo;
          </p>
          {cfg.verse_ref && <div className="mt-3 text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>&mdash; {cfg.verse_ref} &mdash;</div>}
        </section>
      )}

      {/* BRIDE & GROOM */}
      {show("show_couple") && isWedding && (
        <section className="px-6 py-10" style={{ background: cardBg }}>
          <SectionLabel text="The Bride & Groom" accent={accent} mutedColor={mutedColor} variant={ornamentVariant} />
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
      {show("show_love_story") && isWedding && cfg.love_story?.length > 0 && (
        <section className="px-6 py-12">
          <SectionLabel text="Our Love Story" accent={accent} mutedColor={mutedColor} variant={ornamentVariant} />
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
      {show("show_gallery") && cfg.gallery?.length > 0 && (
        <section className="px-6 py-12" style={{ background: cardBg }}>
          <SectionLabel text="Portrait of Us" accent={accent} mutedColor={mutedColor} variant={ornamentVariant} />
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
      {show("show_video") && videoEmbed && (
        <section className="px-6 py-12">
          <SectionLabel text="Our Video Gallery" accent={accent} mutedColor={mutedColor} variant={ornamentVariant} />
          <div className="mt-6 rounded-xl overflow-hidden shadow-lg">
            <div className="aspect-video">
              <iframe src={videoEmbed} title="Wedding video" className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </section>
      )}
      {show("show_video") && !videoEmbed && cfg.video_url && (
        <section className="px-6 py-8 text-center">
          <a href={cfg.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm" style={{ color: accent }}>
            <Youtube className="w-4 h-4" /> Tonton Video Kami
          </a>
        </section>
      )}

      {/* SAVE THE DATE + COUNTDOWN */}
      {show("show_countdown") && targetDate && (
        <section className="px-6 py-12 text-center" style={{ background: cardBg }}>
          <SectionLabel text="Save the Date" accent={accent} mutedColor={mutedColor} variant={ornamentVariant} />
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

      {/* EVENTS with Google Maps embed */}
      {show("show_events") && (cfg.events?.length > 0 || cfg.venue) && (
        <section className="px-6 py-12">
          <SectionLabel text={isWedding ? "The Wedding Day" : "Detail Acara"} accent={accent} mutedColor={mutedColor} variant={ornamentVariant} />
          <p className="mt-4 text-center text-sm italic max-w-md mx-auto" style={{ color: mutedColor, fontFamily: `${theme.font_heading}, serif`, fontSize: "1.05rem" }}>
            {cfg.story || "Dengan penuh sukacita, kami mengundang Bapak/Ibu/Saudara/i untuk hadir."}
          </p>
          <div className="mt-8 space-y-5">
            {(cfg.events && cfg.events.length > 0 ? cfg.events : [{ name: "Acara", date: cfg.event_date, time_start: cfg.event_time, venue: cfg.venue, address: cfg.venue_address }]).map((ev, i) => {
              const mapQuery = encodeURIComponent(`${ev.venue || ""} ${ev.address || ""}`.trim());
              const mapSrc = ev.maps_url && ev.maps_url.includes("google.com/maps") && ev.maps_url.includes("embed")
                ? ev.maps_url
                : (mapQuery ? `https://www.google.com/maps?q=${mapQuery}&output=embed` : null);
              return (
                <div key={i} className="rounded-2xl overflow-hidden border" style={{ background: cardBg, borderColor: `${accent}44` }}>
                  <div className="p-6 text-center">
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
                {(ev.maps_url || mapQuery) && (
                  <button onClick={() => openMaps(ev.maps_url || `https://www.google.com/maps?q=${mapQuery}`)} className="mt-4 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border" style={{ borderColor: accent, color: accent }}>
                    <MapPin className="w-3.5 h-3.5" /> Buka Maps <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                  </div>
                  {mapSrc && (
                    <div className="w-full aspect-[16/10] border-t" style={{ borderColor: `${accent}22` }}>
                      <iframe
                        src={mapSrc}
                        title={`Peta ${ev.venue || ev.name}`}
                        className="w-full h-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* GIFT */}
      {show("show_gift") && cfg.banks?.length > 0 && (
        <section className="px-6 py-12" style={{ background: cardBg }}>
          <SectionLabel text={isWedding ? "Wedding Gift" : "Amplop Digital"} accent={accent} mutedColor={mutedColor} variant={ornamentVariant} />
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

      {/* Music player - floating on/off toggle */}
      {cfg.music_url && <MusicToggle url={cfg.music_url} accent={accent} bg={theme.bg} preview={preview} />}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
