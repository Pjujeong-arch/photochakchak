/**
 * @param {{
 *   email?: string,
 *   subscribed?: boolean,
 *   paying?: boolean,
 *   onLogin: () => void,
 *   onPay: () => void,
 * }} props
 */
export function SubscribeOffer({
  email,
  subscribed = false,
  paying = false,
  onLogin,
  onPay,
}) {
  return (
    <div className="sub-offer">
      <p className="sub-offer__price">
        <b>월 2,900원</b>
        <span>언제든 취소</span>
      </p>
      <p className="sub-offer__lead">
        폴더 정리는 구독 없이 쓰실 수 있습니다. 구독하시면 AI 사진 추천을 받을
        수 있어요.
      </p>
      <ul className="sub-offer__steps">
        <li>베스트 10 시연 후 고른 사진을 원하는 폴더로 복사</li>
        <li>인물 3 · 풍경 3 샘플 추천</li>
        <li>원본은 이동·삭제하지 않고 복사만</li>
      </ul>
      {subscribed ? (
        <p className="sub-offer__ok">구독 중 · {email}</p>
      ) : !email ? (
        <button className="btn btn--start" type="button" onClick={onLogin}>
          구글 로그인부터
        </button>
      ) : (
        <button
          className="btn btn--start"
          type="button"
          disabled={paying}
          onClick={onPay}
        >
          {paying ? "처리 중…" : "구독하기"}
        </button>
      )}
    </div>
  );
}
