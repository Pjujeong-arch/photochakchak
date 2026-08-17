/**
 * @param {{
 *   result: import('../types/photochak').RankResult,
 *   mode: "sample" | "top10",
 * }} props
 */
export function RankResults({ result, mode }) {
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
                <RankCard key={`${group.key}-${item.id}`} item={item} />
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
 * }} props
 */
function RankCard({ item }) {
  const rank = item.rank != null ? `${item.rank}위 · ` : "";
  const src =
    typeof item.preview === "string" && item.preview.startsWith("data:image/")
      ? item.preview
      : "";

  return (
    <article className="rank-card">
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
