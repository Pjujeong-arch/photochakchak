/**
 * @param {{ tipKind: 'folder' | 'zip' }} props
 */
export function StorageTips({ tipKind }) {
  const where =
    tipKind === "zip" ? "ZIP을 잘 받아뒀는지" : "새 폴더에 잘 들어왔는지";

  return (
    <>
      <p className="modal__woof-note">
        {where} 확인한 뒤 아래 용량 팁을 보면 된다멍.
      </p>
      <div className="modal__woof">
        <p>
          다 복사했다멍! <b>기타파일</b>은 사진·영상이 아닌 상자야 왈.
        </p>
        <p>
          <b>저장공간 팁</b> — 새 폴더를 킁킁 확인한 뒤, 예전 원본 폴더는 직접
          지워도 된다개. 클라우드에 올린 원본이 있으면 폰·PC 사본도 정리하면
          용량이 확 늘어나 왈.
        </p>
        <p>
          같은 연사는 해시로 이미 건너뛰었어. 베스트만 남기고 나머지는
          외장·앨범 아카이브가 편하다멍.
        </p>
        <p className="modal__woof-note">
          원본은 내가 안 지워. 마음에 안 들면 「실행 취소」다멍.
        </p>
      </div>
    </>
  );
}
