"""베스트컷 선별 파이프라인 — 정리된 앨범(또는 원본)에서 Top-N 복사."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, List, Optional

from .quality_scorer import PhotoQualityScore, QualityScorer

BEST_DIR_NAME = "AI_베스트컷"
REPORT_NAME = "best_cut_report.json"


@dataclass
class BestCutOptions:
    source_dir: Path
    dest_root: Path
    top_n: int = 30
    min_score: float = 55.0
    extensions: Optional[set] = None


@dataclass
class BestCutResult:
    selected: List[PhotoQualityScore] = field(default_factory=list)
    scanned: int = 0
    output_dir: Optional[Path] = None
    report_path: Optional[Path] = None


ProgressCb = Optional[Callable[[int, int, str], None]]


def run_best_cut_selection(
    scorer: QualityScorer,
    options: BestCutOptions,
    progress: ProgressCb = None,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> BestCutResult:
    exts = options.extensions or {
        ".jpg",
        ".jpeg",
        ".png",
        ".tif",
        ".tiff",
        ".webp",
        ".bmp",
    }
    files = [
        p
        for p in options.source_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in exts
    ]
    total = len(files)
    scores: List[PhotoQualityScore] = []

    for i, path in enumerate(files, start=1):
        if cancel_check and cancel_check():
            break
        s = scorer.score(path)
        scores.append(s)
        if progress:
            progress(i, total, f"[AI준비] {path.name} → {s.overall:.0f}점")

    ranked = sorted(scores, key=lambda x: x.overall, reverse=True)
    picked = [s for s in ranked if s.overall >= options.min_score][: options.top_n]

    out = options.dest_root / BEST_DIR_NAME
    out.mkdir(parents=True, exist_ok=True)

    for rank, item in enumerate(picked, start=1):
        dest = out / f"{rank:03d}_{item.overall:.0f}_{item.path.name}"
        if not dest.exists():
            shutil.copy2(item.path, dest)

    report = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "backend": scorer.name,
        "scanned": total,
        "selected": len(picked),
        "top_n": options.top_n,
        "min_score": options.min_score,
        "items": [s.as_dict() for s in picked],
    }
    report_path = out / REPORT_NAME
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return BestCutResult(
        selected=picked,
        scanned=total,
        output_dir=out,
        report_path=report_path,
    )
