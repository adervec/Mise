import { useMemo } from "react";
import { Link } from "react-router-dom";
import { items, guides, recipes, CAT_LABELS, CATEGORY_ORDER } from "@/data/catalog";
import { useFilters, applyFilters, SORT_LABELS, type SortMode } from "./filters";
import { useUi } from "./ui";
import Card from "./Card";
import { t } from "@/i18n";

export default function Browse() {
  const { search, cat, sort, diet, setSearch, setCat, setSort } = useFilters();
  const openSettings = useUi((s) => s.openSettings);

  const techniqueCount = items.filter((i) => i.cat === "technique").length;
  const ingredientCount = items.filter((i) => i.cat === "ingredient").length;

  const visible = useMemo(
    () => applyFilters(items, { search, cat, sort, diet }),
    [search, cat, sort, diet]
  );

  const showGuides = cat === "all" && !search.trim();

  return (
    <div className="wrap">
      <header className="hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow">{t("Interactive Cookbook")}</div>
            <h1 className="title">
              Mise <em>en place</em>
            </h1>
            <p className="lede">
              {t("A cookbook you can run. Browse {n} recipes, then hit Execute to cook along with a live flow chart — every station and timer in real time.", { n: recipes.length })}
            </p>
          </div>
          <div className="stats">
            <div>
              <b>{recipes.length}</b> {t.n("recipe", "recipes", recipes.length)}
            </div>
            <div>
              <b>{techniqueCount}</b> {t.n("technique", "techniques", techniqueCount)}
            </div>
            <div>
              <b>{ingredientCount}</b> {t.n("ingredient", "ingredients", ingredientCount)}
            </div>
          </div>
        </div>
      </header>

      <div className="controls">
        <div className="wrap controls-inner" style={{ padding: 0 }}>
          <div className="search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              id="search"
              placeholder={t("Search recipes, techniques, ingredients…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sort-wrap">
            <label htmlFor="sort">{t("Sort")}</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                <option key={m} value={m}>
                  {t(SORT_LABELS[m])}
                </option>
              ))}
            </select>
          </div>
          <button className="icon-btn" onClick={openSettings}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {t("Settings")}
          </button>
          <div className="count">
            {t("{n} shown", { n: visible.length })}
          </div>
        </div>
      </div>

      <div className="filters">
        <button
          className={"chip" + (cat === "all" ? " active" : "")}
          onClick={() => setCat("all")}
        >
          {t("All")}
        </button>
        {CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            className={"chip" + (cat === c ? " active" : "")}
            data-cat={c}
            onClick={() => setCat(c)}
          >
            <span className="dot" />
            {t(CAT_LABELS[c])}
          </button>
        ))}
      </div>

      {showGuides && (
        <>
          <div className="filters" style={{ paddingBottom: 0 }}>
            <span
              className="card-cat"
              style={{ fontSize: 11, letterSpacing: ".14em", color: "var(--accent-2)" }}
            >
              {t("Field Guides")}
            </span>
          </div>
          <div className="grid" style={{ paddingBottom: 8 }}>
            {guides.map((g) => (
              <Link key={g.id} className="card" to={`/guide/${g.id}`} data-cat="reference">
                <div className="card-head">
                  <span className="card-cat" data-cat="reference">
                    {t("Field Guide")}
                  </span>
                </div>
                <h3>{g.title}</h3>
                <p className="card-summary">{g.summary}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {visible.length > 0 ? (
        <div className="grid">
          {visible.map((it) => (
            <Card key={it.id} item={it} />
          ))}
        </div>
      ) : (
        <div className="empty">{t("No matches. Try clearing a filter.")}</div>
      )}

      <footer>
        <div className="ornament">Mise</div>
        {t("Built from the Home Kitchen Masterclass · {n} cards", { n: items.length })}
      </footer>
    </div>
  );
}
