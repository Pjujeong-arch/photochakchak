"""
포토착착 Premium — MVP 이후 구독형 AI 베스트컷 선별 준비 모듈.

원칙:
- MVP 핵심(연/월 복사)과 분리
- 실제 AI 모델은 교체 가능 인터페이스 뒤로 숨김
- 구독 없으면 게이트, 체험은 로컬 휴리스틱만
"""

from .subscription import SubscriptionGate, SubscriptionStatus
from .quality_scorer import (
    HeuristicQualityScorer,
    PhotoQualityScore,
    QualityScorer,
    create_scorer,
)
from .best_cut import BestCutOptions, BestCutResult, run_best_cut_selection

__all__ = [
    "SubscriptionGate",
    "SubscriptionStatus",
    "HeuristicQualityScorer",
    "PhotoQualityScore",
    "QualityScorer",
    "create_scorer",
    "BestCutOptions",
    "BestCutResult",
    "run_best_cut_selection",
]
