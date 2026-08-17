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
        <b>월 4,900원</b>
        <span>베스트 10 · 인물/풍경 샘플 · 취소 언제든</span>
      </p>
      <ol className="sub-offer__steps">
        <li>
          <b>1. 구글 로그인</b>
          계정만 확인하고, 이 단계에서 결제하지 않아요.
        </li>
        <li>
          <b>2. 토스페이먼츠 결제</b>
          카드·계좌·간편결제. 성공 시에만 서버가 구독을 켭니다.
        </li>
        <li>
          <b>3. 웹훅으로 반영</b>
          결제 완료 이벤트가 오면 이 계정만 베스트 10이 열려요.
        </li>
      </ol>
      <p className="sub-offer__note">
        실서비스는 토스페이먼츠(한국) 또는 Stripe Checkout. 시크릿은 서버
        환경변수만 쓰고, 브라우저에는 넣지 않아요. 지금은 로그인 뒤{" "}
        <b>체험 구독</b>으로 같은 잠금을 풀어 볼 수 있어요.
      </p>
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
          {paying ? "처리 중…" : "체험 구독 켜기"}
        </button>
      )}
    </div>
  );
}
