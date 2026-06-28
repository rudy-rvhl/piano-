// Generated "album art" for a song — a deterministic gradient derived from the
// title/composer, with an elegant monogram and a music glyph. Looks consistent
// and premium without depending on any network image.

interface CoverProps {
  title: string;
  composer?: string;
  kind?: "musicxml" | "pdf";
  playing?: boolean;
}

const GLYPHS = ["♪", "♫", "♬", "𝄞", "🎹"];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "♪";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function Cover({ title, composer, kind, playing }: CoverProps) {
  const seed = hashStr((composer || "") + "|" + title);
  const h1 = seed % 360;
  const h2 = (h1 + 38) % 360;
  const angle = 110 + (seed % 60);
  const bg = {
    backgroundImage: `linear-gradient(${angle}deg, hsl(${h1} 70% 48%), hsl(${h2} 72% 30%))`,
  };
  const glyph = kind === "pdf" ? "📄" : GLYPHS[seed % GLYPHS.length];
  const initials = monogram(composer || title);

  return (
    <div className="cover" style={bg}>
      <div className="cover-grain" />
      <div className="cover-disc" />
      <div className="cover-glyph" aria-hidden>
        {glyph}
      </div>
      <div className="cover-monogram">{initials}</div>

      <div className="cover-overlay">
        <span className="play-badge">{playing ? "❚❚" : "▶"}</span>
      </div>

      {playing && (
        <div className="eq" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
