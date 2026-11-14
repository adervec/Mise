import { Link } from "react-router-dom";
import type { Item } from "@/data/types";
import { t } from "@/i18n";
import { BADGE_PRIORITY, CAT_LABELS, DIET_BY_KEY } from "@/data/catalog";

export default function Card({ item }: { item: Item }) {
  const badges = item.diet
    ? BADGE_PRIORITY.filter((k) => item.diet![k]).map((k) => DIET_BY_KEY[k])
    : [];

  return (
    <Link className="card" to={`/i/${item.id}`} data-cat={item.cat}>
      <div className="card-head">
        <span className="card-cat" data-cat={item.cat}>
          {t(CAT_LABELS[item.cat])}
        </span>
        <span className="card-time">
          {item.timeLabel && <span>{item.timeLabel}</span>}
          {item.nutrition?.cal != null && (
            <span className="card-cal">{t("{n} cal", { n: item.nutrition.cal })}</span>
          )}
        </span>
      </div>
      <h3>{item.title}</h3>
      <p className="card-summary">{item.summary}</p>
      {badges.length > 0 && (
        <div className="card-diet">
          {badges.map((b) => (
            <span className="diet-badge" key={b.key}>
              {t(b.badge)}
            </span>
          ))}
        </div>
      )}
      {item.tags.length > 0 && (
        <div className="card-tags">
          {item.tags.slice(0, 5).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
