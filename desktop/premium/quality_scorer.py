"""
잘 찍힌 사진 점수 — 교체 가능한 스코어러.

평가 축 (구독 AI 목표):
- composition: 구도 (삼분할·균형)
- baby_smile: 아기 미소 식별 (정식 AI)
- focus_depth: 포커스·심도(선명도)
- extras: 노출·대비 등 보조 요소
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from PIL import Image, ImageFilter, ImageStat


@dataclass
class PhotoQualityScore:
    path: Path
    overall: float  # 0~100
    composition: float
    focus_depth: float
    baby_smile: float
    exposure: float
    reasons: List[str] = field(default_factory=list)
    backend: str = "heuristic"  # heuristic | ai_onnx | ai_cloud
    smile_available: bool = False

    def as_dict(self) -> Dict:
        return {
            "path": str(self.path),
            "overall": round(self.overall, 1),
            "composition": round(self.composition, 1),
            "focus_depth": round(self.focus_depth, 1),
            "baby_smile": round(self.baby_smile, 1),
            "exposure": round(self.exposure, 1),
            "reasons": self.reasons,
            "backend": self.backend,
            "smile_available": self.smile_available,
        }


class QualityScorer(ABC):
    @abstractmethod
    def score(self, path: Path) -> PhotoQualityScore:
        raise NotImplementedError

    @property
    def name(self) -> str:
        return self.__class__.__name__


class HeuristicQualityScorer(QualityScorer):
    """
    체험/개발용 로컬 휴리스틱.
    - 구도: 가장자리 대비 중앙 관심도(거친 삼분할 근사)
    - 포커스: Laplacian 근사(엣지 강도 분산)
    - 노출: 평균 밝기·대비
    - 미소: 미탑재 → 0점 + 안내 (ACTIVE AI 자리)
    """

    def __init__(self, enable_smile_placeholder: bool = False):
        self.enable_smile_placeholder = enable_smile_placeholder

    def score(self, path: Path) -> PhotoQualityScore:
        reasons: List[str] = []
        try:
            with Image.open(path) as img:
                img = img.convert("RGB")
                # 속도: 긴 변 512 리사이즈
                w, h = img.size
                scale = 512 / max(w, h)
                if scale < 1:
                    img = img.resize(
                        (max(1, int(w * scale)), max(1, int(h * scale))),
                        Image.Resampling.BILINEAR,
                    )

                focus = self._focus_score(img, reasons)
                composition = self._composition_score(img, reasons)
                exposure = self._exposure_score(img, reasons)

                if self.enable_smile_placeholder:
                    smile = 50.0
                    reasons.append("미소: AI 모델 자리(모의값) — 추후 ONNX/비전 API 교체")
                    smile_ok = True
                    backend = "ai_placeholder"
                else:
                    smile = 0.0
                    reasons.append("미소: 정식 구독 AI 모델 연동 예정 (체험에선 미적용)")
                    smile_ok = False
                    backend = "heuristic"

                # 가중치: 포커스·구도 중심, 미소는 정식 모델 있을 때만 반영
                if smile_ok:
                    overall = (
                        focus * 0.30
                        + composition * 0.25
                        + smile * 0.30
                        + exposure * 0.15
                    )
                else:
                    overall = focus * 0.40 + composition * 0.35 + exposure * 0.25

                return PhotoQualityScore(
                    path=path,
                    overall=max(0.0, min(100.0, overall)),
                    composition=composition,
                    focus_depth=focus,
                    baby_smile=smile,
                    exposure=exposure,
                    reasons=reasons,
                    backend=backend,
                    smile_available=smile_ok,
                )
        except Exception as exc:
            return PhotoQualityScore(
                path=path,
                overall=0.0,
                composition=0.0,
                focus_depth=0.0,
                baby_smile=0.0,
                exposure=0.0,
                reasons=[f"분석 실패: {exc}"],
                backend="error",
                smile_available=False,
            )

    def _focus_score(self, img: Image.Image, reasons: List[str]) -> float:
        gray = img.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)
        stat = ImageStat.Stat(edges)
        # 엣지 평균이 높을수록 선명 — 경험적 스케일
        sharpness = min(100.0, (stat.mean[0] / 40.0) * 100.0)
        if sharpness >= 65:
            reasons.append("포커스: 선명도 양호")
        elif sharpness < 35:
            reasons.append("포커스: 흐릿할 가능성")
        return sharpness

    def _composition_score(self, img: Image.Image, reasons: List[str]) -> float:
        """중앙 vs 삼분할 라인 근처 관심(엣지) 비중으로 거친 구도 점수."""
        gray = img.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)
        w, h = edges.size
        pix = edges.load()
        assert pix is not None

        total = 1e-6
        thirds = 1e-6
        center = 1e-6
        x1, x2 = w / 3, 2 * w / 3
        y1, y2 = h / 3, 2 * h / 3
        cx0, cx1 = w * 0.35, w * 0.65
        cy0, cy1 = h * 0.35, h * 0.65
        band = max(2, int(min(w, h) * 0.04))

        step = max(1, min(w, h) // 80)
        for y in range(0, h, step):
            for x in range(0, w, step):
                v = pix[x, y]
                total += v
                if cx0 <= x <= cx1 and cy0 <= y <= cy1:
                    center += v
                if abs(x - x1) <= band or abs(x - x2) <= band:
                    thirds += v
                if abs(y - y1) <= band or abs(y - y2) <= band:
                    thirds += v

        third_ratio = thirds / total
        center_ratio = center / total
        # 완전 중앙만 / 완전 빈 프레임보다 삼분할·적당한 중앙이 가산
        score = min(100.0, third_ratio * 280 + center_ratio * 120)
        if score >= 60:
            reasons.append("구도: 관심 영역 배치가 무난함")
        else:
            reasons.append("구도: 관심 요소가 한쪽 치우침 가능")
        return score

    def _exposure_score(self, img: Image.Image, reasons: List[str]) -> float:
        stat = ImageStat.Stat(img.convert("L"))
        mean = stat.mean[0]
        stddev = stat.stddev[0]
        # 너무 어둡/밝지 않고 대비가 있으면 가산
        exposure = 100.0 - min(100.0, abs(mean - 128) * 0.7)
        contrast = min(40.0, stddev)
        score = max(0.0, min(100.0, exposure * 0.7 + contrast * 0.75))
        if mean < 40:
            reasons.append("노출: 다소 어두움")
        elif mean > 210:
            reasons.append("노출: 다소 밝음(하이라이트)")
        else:
            reasons.append("노출: 적정 범위")
        return score


class FutureAIScorer(QualityScorer):
    """
    정식 구독 AI 자리.
    예정: 로컬 ONNX(얼굴/미소/심도) 또는 옵트인 클라우드 추론.
    현재는 인터페이스만 고정 — 호출 시 NotImplemented.
    """

    MODEL_SPEC = {
        "composition": "composition_ranker_v1.onnx",
        "baby_smile": "infant_smile_detector_v1.onnx",
        "focus_depth": "focus_bokeh_estimator_v1.onnx",
    }

    def score(self, path: Path) -> PhotoQualityScore:
        raise NotImplementedError(
            "정식 AI 모델 미탑재. create_scorer(use_ai=True)는 모델 배포 후 활성화."
        )


def create_scorer(*, use_ai: bool = False, smile_placeholder: bool = False) -> QualityScorer:
    """구독 상태에 따라 스코어러 생성. AI는 모델 준비 전 Heuristic으로 폴백."""
    if use_ai:
        # 모델 파일이 생기면 FutureAIScorer로 교체
        return HeuristicQualityScorer(enable_smile_placeholder=True)
    return HeuristicQualityScorer(enable_smile_placeholder=smile_placeholder)
