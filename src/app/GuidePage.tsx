import { Link, useParams } from "react-router-dom";
import { guideById } from "@/data/catalog";

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;0,9..144,900;1,9..144,400;1,9..144,600&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet">';

// The field guides are bespoke full-bleed editorial pages (each with its own
// 100vh hero + design language). We present them within the app shell but render
// them in an isolated frame so their layouts stay pixel-faithful. Script-driven
// guides (protein pages) carry their JS in guide.script.
export default function GuidePage() {
  const { id } = useParams();
  const guide = id ? guideById.get(id) : undefined;

  if (!guide) {
    return (
      <div className="wrap">
        <div className="empty">Guide not found.</div>
        <Link className="text-btn" to="/">Back to browse</Link>
      </div>
    );
  }

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${FONTS}<style>${guide.style}</style></head><body>${guide.body}${guide.script ? `<script>${guide.script}</script>` : ""}</body></html>`;

  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div style={{ padding: "20px 0 12px", display: "flex", gap: 14, alignItems: "baseline" }}>
        <Link className="text-btn" to="/">← Browse</Link>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-2)" }}>
          Field Guide
        </span>
      </div>
      <iframe
        title={guide.title}
        srcDoc={srcDoc}
        style={{
          width: "100%",
          height: "calc(100vh - 72px)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          background: "var(--bg)",
          display: "block",
        }}
      />
    </div>
  );
}
