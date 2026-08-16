"""구독/권한 게이트 — 결제 연동 전 로컬 플래그로 준비."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional


class SubscriptionStatus(str, Enum):
    NONE = "none"  # 미구독 — AI 베스트컷 잠금
    TRIAL = "trial"  # 체험 — 로컬 휴리스틱만 (미소 AI 제외/안내)
    ACTIVE = "active"  # 구독 중 — 향후 정식 AI 스코어러


DEFAULT_LICENSE_NAME = ".photochak_subscription.json"


@dataclass
class SubscriptionState:
    status: SubscriptionStatus
    plan: str
    expires_at: Optional[str]
    note: str = ""

    @property
    def can_use_best_cut(self) -> bool:
        return self.status in (SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE)

    @property
    def can_use_ai_smile(self) -> bool:
        """아기 미소 등 본격 AI는 ACTIVE만. TRIAL은 휴리스틱 안내."""
        return self.status == SubscriptionStatus.ACTIVE


class SubscriptionGate:
    """
    향후 Stripe/스토어 영수증 검증으로 교체할 자리.
    지금은 로컬 JSON으로 trial/active를 시뮬레이션한다.
    """

    def __init__(self, license_path: Optional[Path] = None):
        self.license_path = license_path or (Path.home() / DEFAULT_LICENSE_NAME)

    def get_state(self) -> SubscriptionState:
        if not self.license_path.exists():
            return SubscriptionState(
                status=SubscriptionStatus.NONE,
                plan="free",
                expires_at=None,
                note="무료 MVP — 연/월 정돈만 사용 가능",
            )
        try:
            data = json.loads(self.license_path.read_text(encoding="utf-8"))
        except Exception:
            return SubscriptionState(
                SubscriptionStatus.NONE, "free", None, "구독 정보를 읽을 수 없음"
            )

        status = SubscriptionStatus(data.get("status", "none"))
        expires = data.get("expires_at")
        if expires:
            try:
                if datetime.fromisoformat(expires) < datetime.now():
                    return SubscriptionState(
                        SubscriptionStatus.NONE,
                        "free",
                        expires,
                        "구독/체험이 만료되었습니다",
                    )
            except ValueError:
                pass

        return SubscriptionState(
            status=status,
            plan=str(data.get("plan", status.value)),
            expires_at=expires,
            note=str(data.get("note", "")),
        )

    def activate_trial(self, days: int = 7) -> SubscriptionState:
        expires = (datetime.now() + timedelta(days=days)).isoformat(timespec="seconds")
        payload = {
            "status": SubscriptionStatus.TRIAL.value,
            "plan": "trial",
            "expires_at": expires,
            "note": "로컬 체험 — 구도/포커스 휴리스틱. 미소 AI는 정식 구독 예정",
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
        self.license_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return self.get_state()

    def activate_mock_subscription(self, days: int = 30) -> SubscriptionState:
        """개발용: 결제 없이 ACTIVE 시뮬레이션."""
        expires = (datetime.now() + timedelta(days=days)).isoformat(timespec="seconds")
        payload = {
            "status": SubscriptionStatus.ACTIVE.value,
            "plan": "photochak_plus_mock",
            "expires_at": expires,
            "note": "개발용 모의 구독 — 추후 결제 검증으로 교체",
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
        self.license_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return self.get_state()

    def clear(self) -> None:
        if self.license_path.exists():
            self.license_path.unlink()
