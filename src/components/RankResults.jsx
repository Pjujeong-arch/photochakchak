/**
 * @param {{
 *   result: import('../types/photochak').RankResult,
 *   mode: "sample" | "top10",
 *   selected?: Set<string>,
 *   onToggle?: (id: string) => void,
 * }} props
 */
export function RankResults({ result, mode, selected, onToggle }) {
  const groups =
    mode === "top10"
      ? [{ key: "top10", title: "베스트 10" }]
      : mode === "sample"
        ? [
            { key: "portraits", title: "인물 샘플" },
            { key: "landscapes", title: "풍경 샘플" },
          ]
        : [
            { key: "portraits", title: "인물 샘플" },
            { key: "landscapes", title: "풍경 샘플" },
            { key: "top10", title: "베스트 10" },
          ];

  return (
    <>
      {groups.map((group) => {
        const items =
          group.key === "portraits"
            ? result.portraits
            : group.key === "landscapes"
              ? result.landscapes
              : result.top10;
        const list = Array.isArray(items) ? items : [];
        if (!list.length) return null;
        return (
          <div key={group.key}>
            <h3 className="rank-h">{group.title}</h3>
            <div className="rank-grid">
              {list.map((item) => (
                <RankCard
                  key={`${group.key}-${item.id}`}
                  item={item}
                  selected={Boolean(selected && selected.has(item.id))}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        );
      })}
      {result.nextRun ? (
        <p className="rank-next">
          <b>다음 실행 추천</b> — {result.nextRun}
        </p>
      ) : null}
    </>
  );
}

/**
 * @param {{
 *   item: import('../types/photochak').RankItem,
 *   selected?: boolean,
 *   onToggle?: (id: string) => void,
 * }} props
 */
function RankCard({ item, selected = false, onToggle }) {
  const rank = item.rank != null ? `${item.rank}위 · ` : "";
  const src =
    typeof item.preview === "string" && item.preview.startsWith("data:image/")
      ? item.preview
      : "";
  const selectable = typeof onToggle === "function";

  return (
    <article className={`rank-card${selected ? " is-selected" : ""}`}>
      {selectable ? (
        <label className="rank-card__pick">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(item.id)}
          />
          선택
        </label>
      ) : null}
      {src ? <img src={src} alt="" /> : null}
      <p>
        <b>
          {rank}
          {item.name || ""}
        </b>
      </p>
      <p className="rank-card__meta">{item.genre || ""}</p>
      <p className="rank-card__why">{item.reason || ""}</p>
    </article>
  );
}

/** @param {import('../types/photochak').RankResult} result @param {"sample" | "top10"} mode */
export function listRankItems(result, mode) {
  if (mode === "top10") return Array.isArray(result.top10) ? result.top10 : [];
  return [...(result.portraits || []), ...(result.landscapes || [])];
}
