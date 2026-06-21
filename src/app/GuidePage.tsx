import { Link, useParams } from "react-router-dom";
import { guideById } from "@/data/catalog";

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,400&family=JetBrains+Mono:wght@400;500;700&family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">';

export default function GuidePage() {
  const { id } = useParams();
  const guide = id ? guideById.get(id) : undefined;

  if (!guide) {
    return (
      <div className="wrap">
        <div className="empty">Guide not found.</div>
        <Link className="text-btn" to="/">
          Back to browse
        </Link>
      </div>
    );
  }

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8">${FONTS}<style>${guide.style}</style></head><body>${guide.body}</body></html>`;

  return (
    <div className="wrap" style={{ paddingBottom: 60 }}>
      <div style={{ padding: "24px 0 12px" }}>
        <Link className="text-btn" to="/">
          ← Browse
        </Link>
      </div>
      <iframe
        title={guide.title}
        srcDoc={srcDoc}
        style={{
          width: "100%",
          height: "calc(100vh - 80px)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          background: "var(--bg)",
        }}
      />
    </div>
  );
}
