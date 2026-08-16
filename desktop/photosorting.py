"""
포토착착 v1.1
이탈 인터뷰 반영:
- EXIF 없는 카톡/캡처 → 파일명·파일일로 날짜 추정
- 실행 전 미리보기 + 용량 경고
- 동일 사진 해시 중복 스킵
- 이번 실행 복사본만 Undo
"""

from __future__ import annotations

import ctypes
import hashlib
import json
import os
import sys
import queue
import re
import shutil
import threading
import tkinter as tk
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Dict, Generator, List, Optional, Set, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image
from PIL.ExifTags import TAGS

from premium import (
    BestCutOptions,
    SubscriptionGate,
    SubscriptionStatus,
    create_scorer,
    run_best_cut_selection,
)

# ---------------------------------------------------------------------------
# 상수
# ---------------------------------------------------------------------------
APP_TITLE = "포토착착 v1.2 - MVP정돈 + 구독AI 베스트컷 준비"
CHUNK_SIZE = 500
UNCLASSIFIED_DIR = "미분류"
OTHER_DIR = "기타파일"
MANIFEST_NAME = ".photochak_last_run.json"
SKIP_NAMES = {MANIFEST_NAME.lower(), "thumbs.db", "desktop.ini"}
HASH_CHUNK = 1024 * 1024
ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001
ES_DISPLAY_REQUIRED = 0x00000002
ES_AWAYMODE_REQUIRED = 0x00000040


def set_copy_awake(on: bool) -> None:
    """복사 중 Windows 절전·화면 꺼짐을 막는다. 끝나면 해제한다."""
    if sys.platform != "win32":
        return
    flags = ES_CONTINUOUS
    if on:
        flags |= ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED | ES_AWAYMODE_REQUIRED
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(flags)
    except Exception:
        pass
IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".tif",
    ".tiff",
    ".webp",
    ".bmp",
    ".gif",
    ".heic",
    ".heif",
}
VIDEO_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".m4v",
    ".avi",
    ".mkv",
    ".webm",
    ".wmv",
    ".3gp",
}
MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
EXIF_DATE_TAGS = {36867, 36868, 306}

# 파일명 날짜 패턴 (카톡·카메라·스크린샷 흔한 형식)
FILENAME_DATE_PATTERNS = [
    re.compile(r"(20\d{2})[-_\.]?(0[1-9]|1[0-2])[-_\.]?(0[1-9]|[12]\d|3[01])"),
    re.compile(r"(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[_-]?\d{4,6}"),
]


# ---------------------------------------------------------------------------
# 날짜 / 파일 유틸
# ---------------------------------------------------------------------------
@dataclass
class DateGuess:
    dt: Optional[datetime]
    source: str  # exif | filename | filedate | none


def _valid_year(dt: datetime) -> bool:
    """1970-01 같은 깨진 타임스탬프·미래 이상치 제외."""
    now = datetime.now()
    return 1995 <= dt.year <= now.year + 1


def extract_exif_date(filepath: Path) -> Optional[datetime]:
    try:
        with Image.open(filepath) as img:
            exif = img.getexif()
            if not exif:
                return None

            for tag_id in EXIF_DATE_TAGS:
                raw = exif.get(tag_id)
                if not raw:
                    try:
                        raw = exif.get_ifd(0x8769).get(tag_id)
                    except Exception:
                        raw = None
                if raw:
                    parsed = _parse_exif_datetime(str(raw))
                    if parsed and _valid_year(parsed):
                        return parsed

            for tag_id, value in exif.items():
                name = TAGS.get(tag_id, "")
                if name in ("DateTimeOriginal", "DateTimeDigitized", "DateTime"):
                    parsed = _parse_exif_datetime(str(value))
                    if parsed and _valid_year(parsed):
                        return parsed
    except Exception:
        return None
    return None


def _parse_exif_datetime(value: str) -> Optional[datetime]:
    value = value.strip()
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y:%m:%d"):
        try:
            return datetime.strptime(value[:19] if len(value) >= 19 else value, fmt)
        except ValueError:
            continue
    return None


def extract_filename_date(filepath: Path) -> Optional[datetime]:
    name = filepath.stem
    for pattern in FILENAME_DATE_PATTERNS:
        m = pattern.search(name)
        if not m:
            continue
        groups = m.groups()
        try:
            if len(groups) >= 3:
                y, mo, d = int(groups[0]), int(groups[1]), int(groups[2])
            else:
                continue
            dt = datetime(y, mo, d)
            if _valid_year(dt):
                return dt
        except ValueError:
            continue
    return None


def extract_file_date(filepath: Path) -> Optional[datetime]:
    """생성일(가능하면) → 수정일 순. 깨진 연도는 무시."""
    try:
        st = filepath.stat()
        candidates = []
        # Windows: st_ctime ≈ 생성 시각
        candidates.append(datetime.fromtimestamp(st.st_ctime))
        candidates.append(datetime.fromtimestamp(st.st_mtime))
        for dt in candidates:
            if _valid_year(dt):
                return dt
    except Exception:
        return None
    return None


def resolve_date(filepath: Path, use_fallbacks: bool = True) -> DateGuess:
    """
    우선순위: EXIF → 파일명 → 파일일 → 없음
    (이탈 Q2/Q4: 카톡·캡처가 날짜없음에만 몰리는 문제 완화)
    """
    exif = extract_exif_date(filepath)
    if exif:
        return DateGuess(exif, "exif")

    if not use_fallbacks:
        return DateGuess(None, "none")

    by_name = extract_filename_date(filepath)
    if by_name:
        return DateGuess(by_name, "filename")

    by_file = extract_file_date(filepath)
    if by_file:
        return DateGuess(by_file, "filedate")

    return DateGuess(None, "none")


def iter_image_files(root: Path) -> Generator[Path, None, None]:
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            path = Path(dirpath) / name
            lower = name.lower()
            if not name or name.startswith(".") or lower in SKIP_NAMES:
                continue
            yield path


def unique_dest_path(dest_dir: Path, filename: str) -> Path:
    candidate = dest_dir / filename
    if not candidate.exists():
        return candidate
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    i = 1
    while True:
        candidate = dest_dir / f"{stem}_{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            block = f.read(HASH_CHUNK)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def disk_free_bytes(path: Path) -> Optional[int]:
    try:
        return shutil.disk_usage(path).free
    except Exception:
        return None


def format_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} TB"


def target_rel(guess: DateGuess, src: Optional[Path] = None) -> Tuple[Path, str]:
    """반환: (상대경로, 상태키 ok|estimated|unclassified|other)."""
    if src is not None and src.suffix.lower() not in MEDIA_EXTENSIONS:
        return Path(OTHER_DIR), "other"
    if guess.dt and guess.source == "exif":
        return Path(f"{guess.dt.year:04d}-{guess.dt.month:02d}"), "ok"
    if guess.dt and guess.source in ("filename", "filedate"):
        return Path(f"{guess.dt.year:04d}-{guess.dt.month:02d}"), "estimated"
    return Path(UNCLASSIFIED_DIR), "unclassified"


SOURCE_LABEL = {
    "exif": "EXIF",
    "filename": "파일명추정",
    "filedate": "파일일추정",
    "none": "미분류",
}


# ---------------------------------------------------------------------------
# 미리보기 / 복사 워커
# ---------------------------------------------------------------------------
@dataclass
class PreviewResult:
    total: int = 0
    by_source: Counter = field(default_factory=Counter)
    by_folder: Counter = field(default_factory=Counter)
    duplicates: int = 0
    bytes_needed: int = 0
    sample_logs: List[str] = field(default_factory=list)


class AnalyzeWorker(threading.Thread):
    """복사 없이 분류 결과·용량·중복을 미리 집계."""

    def __init__(
        self,
        source: Path,
        destination: Path,
        event_queue: queue.Queue,
        cancel_event: threading.Event,
        use_fallbacks: bool,
        skip_duplicates: bool,
    ):
        super().__init__(daemon=True)
        self.source = source
        self.destination = destination
        self.event_queue = event_queue
        self.cancel_event = cancel_event
        self.use_fallbacks = use_fallbacks
        self.skip_duplicates = skip_duplicates

    def run(self) -> None:
        try:
            files = list(iter_image_files(self.source))
            total = len(files)
            self.event_queue.put(("scan_total", total, "preview"))

            result = PreviewResult(total=total)
            seen: Set[str] = set()
            hash_by_size: Dict[int, List[Tuple[Path, Optional[str]]]] = {}

            for idx, src in enumerate(files, start=1):
                if self.cancel_event.is_set():
                    self.event_queue.put(("cancelled_preview",))
                    return

                size = src.stat().st_size
                is_dup = False

                if self.skip_duplicates:
                    # 같은 크기끼리만 해시 비교 (속도)
                    bucket = hash_by_size.setdefault(size, [])
                    digest = None
                    for _prev, prev_hash in bucket:
                        if prev_hash is None:
                            continue
                        digest = digest or file_hash(src)
                        if digest == prev_hash:
                            is_dup = True
                            break
                    if not is_dup:
                        digest = digest or file_hash(src)
                        if digest in seen:
                            is_dup = True
                        else:
                            seen.add(digest)
                            bucket.append((src, digest))

                if is_dup:
                    result.duplicates += 1
                    if len(result.sample_logs) < 40:
                        result.sample_logs.append(f"[중복예정] {src.name} — 복사 생략")
                else:
                    if src.suffix.lower() not in MEDIA_EXTENSIONS:
                        rel = Path(OTHER_DIR)
                        result.by_source["other"] += 1
                        result.by_folder[str(rel)] += 1
                        result.bytes_needed += size
                        if len(result.sample_logs) < 40:
                            result.sample_logs.append(
                                f"[기타파일] {src.name} → {rel}\\"
                            )
                    else:
                        guess = resolve_date(src, self.use_fallbacks)
                        rel, _status = target_rel(guess, src)
                        result.by_source[guess.source] += 1
                        result.by_folder[str(rel)] += 1
                        result.bytes_needed += size
                        if len(result.sample_logs) < 40:
                            result.sample_logs.append(
                                f"[{SOURCE_LABEL[guess.source]}] {src.name} → {rel}\\"
                            )

                if idx % 20 == 0 or idx == total:
                    self.event_queue.put(("scan_progress", idx, total, "preview"))

            free = disk_free_bytes(self.destination)
            self.event_queue.put(("preview_done", result, free))
        except Exception as exc:
            self.event_queue.put(("fatal", str(exc)))


class SortWorker(threading.Thread):
    def __init__(
        self,
        source: Path,
        destination: Path,
        event_queue: queue.Queue,
        cancel_event: threading.Event,
        use_fallbacks: bool,
        skip_duplicates: bool,
    ):
        super().__init__(daemon=True)
        self.source = source
        self.destination = destination
        self.event_queue = event_queue
        self.cancel_event = cancel_event
        self.use_fallbacks = use_fallbacks
        self.skip_duplicates = skip_duplicates

    def run(self) -> None:
        set_copy_awake(True)
        try:
            files = list(iter_image_files(self.source))
            total = len(files)
            self.event_queue.put(("scan_total", total, "copy"))

            stats = {
                "ok": 0,
                "estimated": 0,
                "unclassified": 0,
                "other": 0,
                "duplicate": 0,
                "error": 0,
                "total": total,
            }
            copied_paths: List[str] = []
            seen_hashes: Set[str] = set()
            processed = 0

            for i in range(0, total, CHUNK_SIZE):
                if self.cancel_event.is_set():
                    self._save_manifest(copied_paths, stats)
                    self.event_queue.put(("cancelled", stats))
                    return

                for src in files[i : i + CHUNK_SIZE]:
                    if self.cancel_event.is_set():
                        self._save_manifest(copied_paths, stats)
                        self.event_queue.put(("cancelled", stats))
                        return

                    status, message, dest_file = self._process_one(src, seen_hashes)
                    stats[status] = stats.get(status, 0) + 1
                    if dest_file:
                        copied_paths.append(str(dest_file))
                    processed += 1
                    self.event_queue.put(("progress", processed, total, message))

            self._save_manifest(copied_paths, stats)
            self.event_queue.put(("done", stats))
        except Exception as exc:
            self.event_queue.put(("fatal", str(exc)))
        finally:
            set_copy_awake(False)

    def _process_one(
        self, src: Path, seen_hashes: Set[str]
    ) -> Tuple[str, str, Optional[Path]]:
        try:
            if self.skip_duplicates:
                digest = file_hash(src)
                if digest in seen_hashes:
                    return (
                        "duplicate",
                        f"[중복스킵] {src.name} — 이미 같은 사진이 있어 건너뜀",
                        None,
                    )
                seen_hashes.add(digest)

            if src.suffix.lower() not in MEDIA_EXTENSIONS:
                guess = DateGuess(None, "other")
            else:
                guess = resolve_date(src, self.use_fallbacks)
            rel, status = target_rel(guess, src)
            dest_dir = self.destination / rel
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_file = unique_dest_path(dest_dir, src.name)
            shutil.copy2(src, dest_file)

            label = {
                "ok": "EXIF",
                "estimated": SOURCE_LABEL[guess.source],
                "unclassified": "미분류",
                "other": "기타파일",
            }[status]
            return status, f"[{label}] {src.name} ──▶ {dest_dir}\\", dest_file
        except Exception as exc:
            return "error", f"[실패] {src.name} ──▶ {exc}", None

    def _save_manifest(self, copied_paths: List[str], stats: dict) -> None:
        manifest = {
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "source": str(self.source),
            "destination": str(self.destination),
            "copied_files": copied_paths,
            "stats": stats,
        }
        path = self.destination / MANIFEST_NAME
        try:
            path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass


class BestCutWorker(threading.Thread):
    """구독/체험 베스트컷 — MVP 복사 워커와 분리."""

    def __init__(
        self,
        source: Path,
        destination: Path,
        event_queue: queue.Queue,
        cancel_event: threading.Event,
        use_ai: bool,
        top_n: int,
    ):
        super().__init__(daemon=True)
        self.source = source
        self.destination = destination
        self.event_queue = event_queue
        self.cancel_event = cancel_event
        self.use_ai = use_ai
        self.top_n = top_n

    def run(self) -> None:
        try:
            scorer = create_scorer(use_ai=self.use_ai, smile_placeholder=self.use_ai)

            def on_progress(done: int, total: int, msg: str) -> None:
                self.event_queue.put(("progress", done, max(total, 1), msg))

            result = run_best_cut_selection(
                scorer,
                BestCutOptions(
                    source_dir=self.source,
                    dest_root=self.destination,
                    top_n=self.top_n,
                    min_score=55.0,
                ),
                progress=on_progress,
                cancel_check=self.cancel_event.is_set,
            )
            self.event_queue.put(("bestcut_done", result))
        except Exception as exc:
            self.event_queue.put(("fatal", str(exc)))


# ---------------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------------
class PhotoChakApp(tk.Tk):
    """이탈 페르소나(이지은) Pain 반영 — 미리보기·추정·중복·Undo + 구독 AI 준비."""

    def __init__(self) -> None:
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("840x780")
        self.minsize(720, 640)

        self.source_var = tk.StringVar()
        self.dest_var = tk.StringVar()
        self.progress_var = tk.DoubleVar(value=0.0)
        self.status_var = tk.StringVar(
            value="먼저 [미리보기]로 어떻게 분류될지·용량이 괜찮은지 확인하세요."
        )
        self.use_fallback_var = tk.BooleanVar(value=True)
        self.skip_dup_var = tk.BooleanVar(value=True)
        self.sub_status_var = tk.StringVar(value="")

        self._event_queue: queue.Queue = queue.Queue()
        self._cancel_event = threading.Event()
        self._running = False
        self._preview: Optional[PreviewResult] = None
        self._preview_free: Optional[int] = None
        self._gate = SubscriptionGate()

        self._build_ui()
        self._refresh_subscription_label()
        self.after(100, self._poll_queue)

    def _build_ui(self) -> None:
        pad = {"padx": 16, "pady": 6}
        main = ttk.Frame(self, padding=12)
        main.pack(fill=tk.BOTH, expand=True)

        ttk.Label(main, text="포토착착", font=("Segoe UI", 18, "bold")).pack(
            anchor=tk.W, **pad
        )
        ttk.Label(
            main,
            text=(
                "카톡·캡처처럼 EXIF가 없는 사진도 파일명/파일일로 추정합니다.\n"
                "복사 전에 미리보고, 중복은 건너뛰며, 마음에 안 들면 이번 실행만 취소할 수 있습니다."
            ),
            wraplength=760,
            justify=tk.LEFT,
        ).pack(anchor=tk.W, padx=16, pady=(0, 8))

        # 폴더
        step1 = ttk.LabelFrame(main, text="[1] 정리할 사진 폴더", padding=10)
        step1.pack(fill=tk.X, **pad)
        row1 = ttk.Frame(step1)
        row1.pack(fill=tk.X)
        ttk.Entry(row1, textvariable=self.source_var).pack(
            side=tk.LEFT, fill=tk.X, expand=True
        )
        ttk.Button(row1, text="폴더 선택", command=self._pick_source).pack(
            side=tk.LEFT, padx=(8, 0)
        )

        step2 = ttk.LabelFrame(main, text="[2] 정리본 저장 폴더 (원본과 다른 위치)", padding=10)
        step2.pack(fill=tk.X, **pad)
        row2 = ttk.Frame(step2)
        row2.pack(fill=tk.X)
        ttk.Entry(row2, textvariable=self.dest_var).pack(
            side=tk.LEFT, fill=tk.X, expand=True
        )
        ttk.Button(row2, text="폴더 선택", command=self._pick_dest).pack(
            side=tk.LEFT, padx=(8, 0)
        )

        # 옵션
        opt = ttk.LabelFrame(main, text="정리 옵션 (이탈 원인 보완)", padding=10)
        opt.pack(fill=tk.X, **pad)
        ttk.Checkbutton(
            opt,
            text="EXIF 없으면 파일명·파일 날짜로 추정 (카톡/캡처 대응)",
            variable=self.use_fallback_var,
        ).pack(anchor=tk.W)
        ttk.Checkbutton(
            opt,
            text="내용이 같은 중복 사진은 하나만 복사 (해시 비교)",
            variable=self.skip_dup_var,
        ).pack(anchor=tk.W)

        # 구독 AI 베스트컷 (MVP 이후)
        premium = ttk.LabelFrame(
            main,
            text="[구독 준비] AI 베스트컷 — 잘 찍힌 사진만 골라 모으기",
            padding=10,
        )
        premium.pack(fill=tk.X, **pad)
        ttk.Label(
            premium,
            text=(
                "구도 · 포커스/심도 · 노출 + (정식) 아기 미소 식별.\n"
                "MVP 연/월 정돈 이후 단계. 지금은 체험(로컬 휴리스틱) 또는 구독 게이트만 연결."
            ),
            wraplength=760,
            foreground="#444444",
        ).pack(anchor=tk.W)
        ttk.Label(premium, textvariable=self.sub_status_var, wraplength=760).pack(
            anchor=tk.W, pady=(6, 4)
        )
        prem_btns = ttk.Frame(premium)
        prem_btns.pack(fill=tk.X, pady=(4, 0))
        ttk.Button(
            prem_btns, text="7일 체험 켜기", command=self._start_trial
        ).pack(side=tk.LEFT)
        ttk.Button(
            prem_btns, text="AI 베스트컷 실행", command=self._start_best_cut
        ).pack(side=tk.LEFT, padx=(8, 0))
        ttk.Button(
            prem_btns, text="구독 상태 새로고침", command=self._refresh_subscription_label
        ).pack(side=tk.LEFT, padx=(8, 0))

        # 버튼
        btn_row = ttk.Frame(main)
        btn_row.pack(fill=tk.X, pady=12, padx=16)
        self.preview_btn = ttk.Button(
            btn_row, text="① 미리보기 (복사 안 함)", command=self._start_preview
        )
        self.preview_btn.pack(side=tk.LEFT, expand=True, fill=tk.X)
        self.start_btn = ttk.Button(
            btn_row, text="② 자동 분류 시작", command=self._start_sort
        )
        self.start_btn.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(8, 0))
        self.undo_btn = ttk.Button(
            btn_row, text="실행 취소", command=self._undo_last_run
        )
        self.undo_btn.pack(side=tk.LEFT, padx=(8, 0))
        self.cancel_btn = ttk.Button(
            btn_row, text="중지", command=self._cancel_work, state=tk.DISABLED
        )
        self.cancel_btn.pack(side=tk.LEFT, padx=(8, 0))

        prog = ttk.LabelFrame(main, text="진행 / 미리보기 요약", padding=10)
        prog.pack(fill=tk.X, **pad)
        ttk.Progressbar(prog, variable=self.progress_var, maximum=100).pack(fill=tk.X)
        ttk.Label(prog, textvariable=self.status_var, wraplength=760).pack(
            anchor=tk.W, pady=(6, 0)
        )

        log_frame = ttk.LabelFrame(main, text="상세 로그", padding=10)
        log_frame.pack(fill=tk.BOTH, expand=True, **pad)
        self.log_text = tk.Text(log_frame, height=14, wrap=tk.WORD, state=tk.DISABLED)
        scroll = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scroll.set)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def _pick_source(self) -> None:
        path = filedialog.askdirectory(title="정리할 사진 폴더")
        if path:
            self.source_var.set(path)
            self._preview = None

    def _pick_dest(self) -> None:
        path = filedialog.askdirectory(title="저장 폴더")
        if path:
            self.dest_var.set(path)
            self._preview = None

    def _log(self, message: str) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _clear_log(self) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _validate_folders(self) -> Optional[Tuple[Path, Path]]:
        source = Path(self.source_var.get().strip())
        dest = Path(self.dest_var.get().strip())
        if not source.is_dir():
            messagebox.showwarning("포토착착", "정리할 사진 폴더를 선택해 주세요.")
            return None
        if not dest.is_dir():
            messagebox.showwarning("포토착착", "저장 폴더를 선택해 주세요.")
            return None
        if source.resolve() == dest.resolve():
            messagebox.showwarning("포토착착", "원본과 저장 폴더는 달라야 합니다.")
            return None
        try:
            dest.resolve().relative_to(source.resolve())
            messagebox.showwarning(
                "포토착착",
                "저장 폴더는 원본 바깥에 있어야 합니다.",
            )
            return None
        except ValueError:
            pass
        return source, dest

    def _refresh_subscription_label(self) -> None:
        state = self._gate.get_state()
        label = {
            SubscriptionStatus.NONE: "상태: 무료 MVP (AI 베스트컷 잠김)",
            SubscriptionStatus.TRIAL: "상태: 체험 중 — 구도/포커스 휴리스틱 (미소 AI는 정식 구독)",
            SubscriptionStatus.ACTIVE: "상태: 구독 활성 — AI 스코어러 자리 연결됨(모델 교체 준비)",
        }[state.status]
        extra = f" · 만료 {state.expires_at}" if state.expires_at else ""
        self.sub_status_var.set(label + extra)

    def _start_trial(self) -> None:
        if self._running:
            return
        state = self._gate.activate_trial(7)
        self._refresh_subscription_label()
        messagebox.showinfo(
            "포토착착 Plus 체험",
            "7일 체험이 켜졌습니다.\n\n"
            "· 구도 / 포커스·심도 / 노출: 로컬 휴리스틱으로 바로 체험\n"
            "· 아기 미소 식별: 정식 구독 AI 모델 연동 예정\n\n"
            f"{state.note}",
        )

    def _start_best_cut(self) -> None:
        if self._running:
            return
        state = self._gate.get_state()
        if not state.can_use_best_cut:
            go = messagebox.askyesno(
                "구독 필요",
                "AI 베스트컷은 구독(또는 체험) 기능입니다.\n\n"
                "지금 7일 체험을 켤까요?",
            )
            if go:
                self._start_trial()
                state = self._gate.get_state()
            if not state.can_use_best_cut:
                return

        folders = self._validate_folders()
        if not folders:
            return
        source, dest = folders

        prefer_sorted = messagebox.askyesno(
            "AI 베스트컷",
            "어디서 고를까요?\n\n"
            "· 예: 저장 폴더(연/월 정리본)에서 베스트컷 선별 (권장)\n"
            "· 아니오: 원본 폴더에서 선별\n\n"
            "상위 30장을 'AI_베스트컷' 폴더로 복사합니다. 원본은 유지됩니다.",
        )
        scan_root = dest if prefer_sorted else source

        self._clear_log()
        self.progress_var.set(0)
        self.status_var.set("AI 베스트컷 분석 중…")
        self._log(
            "— 베스트컷: 구도·포커스·노출 점수화 "
            f"({'미소 플레이스홀더 포함' if state.can_use_ai_smile else '미소 AI 제외·체험'}) —"
        )
        self._cancel_event.clear()
        self._set_busy(True)
        BestCutWorker(
            scan_root,
            dest,
            self._event_queue,
            self._cancel_event,
            use_ai=state.can_use_ai_smile,
            top_n=30,
        ).start()

    def _set_busy(self, busy: bool) -> None:
        self._running = busy
        state = tk.DISABLED if busy else tk.NORMAL
        self.preview_btn.configure(state=state)
        self.start_btn.configure(state=state)
        self.undo_btn.configure(state=state)
        self.cancel_btn.configure(state=tk.NORMAL if busy else tk.DISABLED)

    def _start_preview(self) -> None:
        if self._running:
            return
        folders = self._validate_folders()
        if not folders:
            return
        source, dest = folders

        self._clear_log()
        self.progress_var.set(0)
        self.status_var.set("미리보기 분석 중… (아직 복사하지 않습니다)")
        self._log("— 미리보기 시작: 분류 예정 경로·중복·필요 용량을 계산합니다 —")
        self._cancel_event.clear()
        self._set_busy(True)
        AnalyzeWorker(
            source,
            dest,
            self._event_queue,
            self._cancel_event,
            self.use_fallback_var.get(),
            self.skip_dup_var.get(),
        ).start()

    def _start_sort(self) -> None:
        if self._running:
            return
        folders = self._validate_folders()
        if not folders:
            return
        source, dest = folders

        # 미리보기 없으면 한 번 더 확인
        if self._preview is None:
            go = messagebox.askyesno(
                "포토착착",
                "아직 미리보기를 안 하셨습니다.\n"
                "용량 부족·미분류 대량 발생을 확인하려면 미리보기를 권장합니다.\n\n"
                "그래도 바로 복사할까요?",
            )
            if not go:
                return
        else:
            needed = self._preview.bytes_needed
            free = self._preview_free
            warn = ""
            if free is not None and needed > free:
                warn = (
                    f"\n⚠ 저장 공간 부족 가능!\n"
                    f"필요 약 {format_bytes(needed)} / 남음 {format_bytes(free)}\n"
                )
            go = messagebox.askyesno(
                "포토착착 — 복사 확인",
                "미리보기 결과로 복사를 시작합니다.\n"
                f"· 복사 예정: {self._preview.total - self._preview.duplicates:,}장\n"
                f"· 중복 스킵: {self._preview.duplicates:,}장\n"
                f"· 필요 용량: 약 {format_bytes(needed)}\n"
                f"{warn}\n"
                "원본은 그대로 두고 복사만 합니다. 진행할까요?",
            )
            if not go:
                return

        self._clear_log()
        self.progress_var.set(0)
        self.status_var.set("복사 준비 중…")
        self._log("원본은 유지합니다. 문제는 「실행 취소」로 이번 복사본만 되돌릴 수 있습니다.")
        self._cancel_event.clear()
        self._set_busy(True)
        SortWorker(
            source,
            dest,
            self._event_queue,
            self._cancel_event,
            self.use_fallback_var.get(),
            self.skip_dup_var.get(),
        ).start()

    def _cancel_work(self) -> None:
        if self._running:
            self._cancel_event.set()
            self.status_var.set("중지 요청… 현재 파일만 마치고 멈춥니다.")

    def _undo_last_run(self) -> None:
        if self._running:
            return
        dest = Path(self.dest_var.get().strip())
        manifest_path = dest / MANIFEST_NAME
        if not dest.is_dir() or not manifest_path.exists():
            messagebox.showinfo(
                "포토착착",
                "되돌릴 기록이 없습니다.\n"
                f"저장 폴더에 {MANIFEST_NAME} 이 있어야 합니다.",
            )
            return

        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception as exc:
            messagebox.showerror("포토착착", f"기록 파일을 읽을 수 없습니다.\n{exc}")
            return

        files = data.get("copied_files") or []
        if not files:
            messagebox.showinfo("포토착착", "삭제할 복사본이 기록에 없습니다.")
            return

        ok = messagebox.askyesno(
            "실행 취소 (Undo)",
            f"지난 실행에서 복사한 {len(files):,}개 파일만 삭제합니다.\n"
            "원본 사진은 절대 건드리지 않습니다.\n\n"
            "계속할까요?",
        )
        if not ok:
            return

        deleted = 0
        errors = 0
        for p in files:
            try:
                path = Path(p)
                if path.is_file():
                    path.unlink()
                    deleted += 1
            except Exception:
                errors += 1

        # 빈 연/월 폴더 정리 (선택적, 안전하게 비어 있을 때만)
        for root, dirs, filenames in os.walk(dest, topdown=False):
            if Path(root) == dest:
                continue
            if Path(root).name == MANIFEST_NAME:
                continue
            try:
                if not os.listdir(root):
                    Path(root).rmdir()
            except Exception:
                pass

        try:
            manifest_path.unlink()
        except Exception:
            pass

        self._log(f"[실행취소] 복사본 {deleted:,}개 삭제 · 실패 {errors:,}")
        self.status_var.set(f"실행 취소 완료 — {deleted:,}개 복사본 삭제 (원본 유지)")
        messagebox.showinfo(
            "포토착착",
            f"이번 실행 복사본 {deleted:,}개를 삭제했습니다.\n원본은 그대로입니다.",
        )

    def _show_preview(self, result: PreviewResult, free: Optional[int]) -> None:
        self._preview = result
        self._preview_free = free

        self._log("-" * 48)
        self._log(f"[미리보기] 전체 {result.total:,}장")
        self._log(
            f"  · EXIF: {result.by_source.get('exif', 0):,}  "
            f"· 파일명추정: {result.by_source.get('filename', 0):,}  "
            f"· 파일일추정: {result.by_source.get('filedate', 0):,}  "
            f"· 미분류: {result.by_source.get('none', 0):,}  "
            f"· 기타파일: {result.by_source.get('other', 0):,}"
        )
        self._log(f"  · 중복 스킵 예정: {result.duplicates:,}장")
        self._log(f"  · 필요 용량(중복 제외): 약 {format_bytes(result.bytes_needed)}")
        if free is not None:
            self._log(f"  · 저장 드라이브 여유: {format_bytes(free)}")
            if result.bytes_needed > free:
                self._log("  ⚠ 용량 부족 가능 — 다른 드라이브로 저장을 권장합니다.")

        top_folders = result.by_folder.most_common(8)
        if top_folders:
            self._log("  · 많이 들어갈 폴더:")
            for name, cnt in top_folders:
                self._log(f"      {name}\\  → {cnt:,}장")

        for line in result.sample_logs[:25]:
            self._log(line)
        if len(result.sample_logs) > 25:
            self._log(f"  … 외 샘플 생략")

        none_cnt = result.by_source.get("none", 0)
        est = result.by_source.get("filename", 0) + result.by_source.get("filedate", 0)
        summary = (
            f"미리보기 완료 — 복사 {result.total - result.duplicates:,}장 "
            f"(추정 {est:,} · 미분류 {none_cnt:,} · 기타 {result.by_source.get('other', 0):,} · 중복 {result.duplicates:,}) / "
            f"필요 {format_bytes(result.bytes_needed)}"
        )
        self.status_var.set(summary)
        self.progress_var.set(100 if result.total else 0)

        msg = (
            f"전체 {result.total:,}장 중\n"
            f"· EXIF 확실: {result.by_source.get('exif', 0):,}장\n"
            f"· 파일명/파일일 추정: {est:,}장\n"
            f"· 미분류: {none_cnt:,}장\n"
            f"· 기타파일: {result.by_source.get('other', 0):,}장\n"
            f"· 중복 스킵: {result.duplicates:,}장\n"
            f"· 필요 용량: 약 {format_bytes(result.bytes_needed)}\n"
        )
        if free is not None:
            msg += f"· 여유 용량: {format_bytes(free)}\n"
            if result.bytes_needed > free:
                msg += "\n⚠ 공간이 부족할 수 있습니다. 다른 저장 위치를 고르세요.\n"
        if none_cnt > result.total * 0.3 and result.total:
            msg += (
                "\n미분류가 30%를 넘습니다.\n"
                "카톡·캡처 비중이 크면 추정 옵션을 켠 뒤 다시 미리보세요.\n"
            )
        msg += "\n괜찮으면 「② 자동 분류 시작」을 누르세요."
        messagebox.showinfo("미리보기 결과", msg)

    def _poll_queue(self) -> None:
        try:
            while True:
                event = self._event_queue.get_nowait()
                kind = event[0]

                if kind == "scan_total":
                    total, mode = event[1], event[2]
                    label = "미리보기" if mode == "preview" else "복사"
                    self.status_var.set(f"{label}: 총 {total:,}장")
                    if total == 0:
                        self._log("이미지 파일이 없습니다.")

                elif kind == "scan_progress":
                    processed, total, _mode = event[1], event[2], event[3]
                    pct = (processed / total) * 100 if total else 0
                    self.progress_var.set(pct)
                    self.status_var.set(f"분석 중 {pct:.0f}% ({processed:,}/{total:,})")

                elif kind == "preview_done":
                    self._set_busy(False)
                    self._show_preview(event[1], event[2])

                elif kind == "cancelled_preview":
                    self._set_busy(False)
                    self.status_var.set("미리보기를 중지했습니다.")
                    self._log("미리보기 중지됨")

                elif kind == "progress":
                    processed, total, message = event[1], event[2], event[3]
                    pct = (processed / total) * 100 if total else 0
                    self.progress_var.set(pct)
                    self.status_var.set(f"{pct:.0f}% ({processed:,}/{total:,})")
                    self._log(message)

                elif kind == "done":
                    stats = event[1]
                    self.progress_var.set(100 if stats["total"] else 0)
                    summary = (
                        f"완료 — EXIF {stats.get('ok', 0):,} · "
                        f"추정 {stats.get('estimated', 0):,} · "
                        f"미분류 {stats.get('unclassified', 0):,} · "
                        f"기타 {stats.get('other', 0):,} · "
                        f"중복스킵 {stats.get('duplicate', 0):,} · "
                        f"실패 {stats.get('error', 0):,}"
                    )
                    self.status_var.set(summary)
                    self._log("-" * 48)
                    self._log(summary)
                    self._log(
                        f"마음에 안 들면 「실행 취소」로 이번 복사본만 삭제할 수 있습니다. "
                        f"(기록: {MANIFEST_NAME})"
                    )
                    self._set_busy(False)
                    self._show_done_dialog(stats)

                elif kind == "cancelled":
                    stats = event[1]
                    msg = (
                        f"중지됨 — 복사 "
                        f"{stats.get('ok', 0) + stats.get('estimated', 0) + stats.get('unclassified', 0):,} · "
                        f"중복스킵 {stats.get('duplicate', 0):,}"
                    )
                    self.status_var.set(msg)
                    self._log(msg + " / 중지 전까지 복사분은 실행 취소로 되돌릴 수 있습니다.")
                    self._set_busy(False)

                elif kind == "bestcut_done":
                    result = event[1]
                    self._set_busy(False)
                    self.progress_var.set(100 if result.scanned else 0)
                    summary = (
                        f"베스트컷 완료 — 스캔 {result.scanned:,}장 중 "
                        f"{len(result.selected):,}장 선별 → {result.output_dir}"
                    )
                    self.status_var.set(summary)
                    self._log("-" * 48)
                    self._log(summary)
                    for item in result.selected[:10]:
                        self._log(
                            f"  · {item.overall:.0f}점 | 구도 {item.composition:.0f} "
                            f"포커스 {item.focus_depth:.0f} 미소 {item.baby_smile:.0f} "
                            f"| {item.path.name}"
                        )
                    if result.report_path:
                        self._log(f"리포트: {result.report_path}")
                    messagebox.showinfo(
                        "AI 베스트컷",
                        f"{len(result.selected):,}장을 골라 복사했습니다.\n"
                        f"폴더: {result.output_dir}\n\n"
                        "체험은 구도·포커스·노출 휴리스틱입니다.\n"
                        "아기 미소 AI는 정식 구독 모델 연동 자리만 마련되어 있습니다.",
                    )

                elif kind == "fatal":
                    messagebox.showerror(
                        "포토착착",
                        f"오류가 났습니다. 원본은 변경되지 않았습니다.\n\n{event[1]}",
                    )
                    self.status_var.set("오류로 중단 — 원본 유지")
                    self._set_busy(False)

        except queue.Empty:
            pass
        self.after(100, self._poll_queue)

    def _show_done_dialog(self, stats: dict) -> None:
        dest = self.dest_var.get().strip()
        if stats["total"] == 0:
            messagebox.showinfo("포토착착", "처리할 사진이 없었습니다.")
            return

        open_folder = messagebox.askyesno(
            "포토착착 — 정리 완료",
            "다 복사했다멍! 원본은 그대로 있어 왈.\n\n"
            f"· EXIF 분류: {stats.get('ok', 0):,}장\n"
            f"· 파일명/파일일 추정: {stats.get('estimated', 0):,}장\n"
            f"· 미분류: {stats.get('unclassified', 0):,}장\n"
            f"· 기타파일: {stats.get('other', 0):,}장  ← 사진·영상이 아닌 파일을 모아둔 바구니야 왈\n"
            f"· 중복 스킵: {stats.get('duplicate', 0):,}장\n"
            f"· 실패: {stats.get('error', 0):,}장\n\n"
            "새 폴더 한 번만 킁킁 확인하고, 괜찮으면 예전 폴더는 지워도 된다개.\n"
            "그래야 용량이 절약돼 왈왈! (원본은 내가 안 지워~ 네가 직접 지우는 거야)\n"
            "마음에 안 들면 「실행 취소」다멍.\n\n"
            "정리된 폴더를 열어볼까 왈?",
        )
        if open_folder and dest:
            try:
                os.startfile(dest)
            except Exception:
                messagebox.showinfo("포토착착", f"경로:\n{dest}")


def main() -> None:
    app = PhotoChakApp()
    app.mainloop()


if __name__ == "__main__":
    main()
