from __future__ import annotations

import argparse
import os
import subprocess
import sys
import threading
from pathlib import Path

from resilient_processing import ResilientProcessor
from sentences_common import AnkiDeckArchive, default_sentence_input_path, iter_normalized_sentences, validate_sentence_input_path


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Extract sentence audio files from the Anki deck.")
	parser.add_argument("--input", type=Path, default=default_sentence_input_path())
	parser.add_argument("--output", type=Path, default=Path("data/audio"))
	parser.add_argument("--log", type=Path, default=Path("logs/audio-download-errors.log"))
	parser.add_argument("--retries", type=int, default=3)
	parser.add_argument("--retry-delay-seconds", type=float, default=1.0)
	parser.add_argument("--state-db", type=Path, default=Path("logs/state/audio-download.sqlite3"))
	parser.add_argument("--workers", type=int, default=max(1, min(8, os.cpu_count() or 4)))
	parser.add_argument("--quiet-progress", action="store_true")
	parser.add_argument("--failed-only", action="store_true")
	parser.add_argument("--reset-state", action="store_true")
	return parser.parse_args()


def main() -> int:
	args = parse_args()
	deck_path = validate_sentence_input_path(args.input)
	args.output.mkdir(parents=True, exist_ok=True)
	args.log.parent.mkdir(parents=True, exist_ok=True)
	items = [item for item in iter_normalized_sentences(deck_path, public_audio_base_url="https://unused.local") if item["audio_path"]]
	processor = ResilientProcessor[dict](
		name="audio-download",
		state_db_path=args.state_db,
		log_path=args.log,
		retries=args.retries,
		progress_every=250,
		retry_delay_seconds=args.retry_delay_seconds
	)

	def get_item_id(item: dict) -> str:
		return item["id"]

	def describe_item(item: dict) -> str:
		return item["audio_path"]

	deck_local = threading.local()
	deck_instances: list[AnkiDeckArchive] = []
	deck_instances_lock = threading.Lock()

	def get_worker_deck() -> AnkiDeckArchive:
		deck = getattr(deck_local, "deck", None)
		if deck is None:
			deck = AnkiDeckArchive(deck_path)
			deck.__enter__()
			deck_local.deck = deck
			with deck_instances_lock:
				deck_instances.append(deck)
		return deck

	try:
		def process_item(item: dict) -> None:
			audio_path = item["audio_path"]
			destination = args.output / audio_path
			try:
				get_worker_deck().extract_media_file(audio_path, destination)
			except (FileNotFoundError, OSError, subprocess.CalledProcessError) as exc:
				raise RuntimeError(f"{audio_path} -> {destination}: {exc}") from exc

		summary = processor.run(
			items=items,
			get_item_id=get_item_id,
			process_item=process_item,
			failed_only=args.failed_only,
			reset_state=args.reset_state,
			log_progress=lambda message: print(message, file=sys.stderr),
			describe_item=describe_item,
			log_each_item=not args.quiet_progress,
			max_workers=max(1, args.workers)
		)
	finally:
		for deck in deck_instances:
			deck.__exit__(None, None, None)
	print(
		f"Finished audio extraction. total={summary.total} done={summary.done} failed={summary.failed} pending={summary.pending} in_progress={summary.in_progress}",
		file=sys.stderr
	)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
