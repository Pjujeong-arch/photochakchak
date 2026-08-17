/**
 * @param {{ items: import('../types/photochak').SkippedItem[] }} props
 */
export function SkippedList({ items }) {
  if (!items?.length) {
    return <p className="modal__empty">복사되지 않은 파일이 없습니다.</p>;
  }

  return (
    <>
      <p>복사되지 않은 파일 {items.length.toLocaleString()}개</p>
      <ul className="modal__list">
        {items.map((item, index) => (
          <li key={`${item.folder}-${item.name}-${index}`}>
            <span className="modal__folder">{item.folder}</span>
            <span className="modal__file">{item.name}</span>
            <span className="modal__why">
              {item.reason}
              {item.source ? ` · 원본 ${item.source}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
