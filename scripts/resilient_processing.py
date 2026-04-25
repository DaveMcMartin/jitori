from __future__ import annotations

from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Generic, Iterable, Sequence, TypeVar

ItemType = TypeVar("ItemType")


@dataclass(frozen=True)
class ProcessingSummary:
	total: int
	processed_now: int
	done: int
	failed: int
	pending: int
	in_progress: int


class ProcessingState:
	def __init__(self, database_path: Path) -> None:
		self.database_path = database_path
		self.database_path.parent.mkdir(parents=True, exist_ok=True)
		self.connection = sqlite3.connect(str(self.database_path))
		self.connection.execute("PRAGMA journal_mode=WAL")
		self.connection.execute("PRAGMA synchronous=NORMAL")
		self.connection.execute(
			"""
			CREATE TABLE IF NOT EXISTS task_item (
				item_id TEXT PRIMARY KEY,
				status TEXT NOT NULL DEFAULT 'pending',
				attempts INTEGER NOT NULL DEFAULT 0,
				last_error TEXT NOT NULL DEFAULT '',
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
			"""
		)
		self.connection.execute(
			"""
			CREATE TABLE IF NOT EXISTS metadata (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			)
			"""
		)
		self.connection.commit()
		self.pending_changes = 0

	def close(self) -> None:
		self.flush()
		self.connection.close()

	def clear(self) -> None:
		self.connection.execute("DELETE FROM task_item")
		self.connection.execute("DELETE FROM metadata")
		self.connection.commit()
		self.pending_changes = 0

	def set_metadata(self, key: str, value: str) -> None:
		self.connection.execute(
			"INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
			(key, value)
		)
		self.connection.commit()
		self.pending_changes = 0

	def register_items(self, item_ids: Iterable[str]) -> None:
		self.connection.executemany(
			"INSERT OR IGNORE INTO task_item (item_id) VALUES (?)",
			((item_id,) for item_id in item_ids)
		)
		self.connection.commit()
		self.pending_changes = 0

	def mark_attempt(self, item_id: str) -> None:
		self.connection.execute(
			"""
			UPDATE task_item
			SET status = 'in_progress',
				attempts = attempts + 1,
				updated_at = CURRENT_TIMESTAMP
			WHERE item_id = ?
			""",
			(item_id,)
		)
		self.pending_changes += 1

	def mark_done(self, item_id: str) -> None:
		self.connection.execute(
			"""
			UPDATE task_item
			SET status = 'done',
				last_error = '',
				updated_at = CURRENT_TIMESTAMP
			WHERE item_id = ?
			""",
			(item_id,)
		)
		self.pending_changes += 1

	def mark_failed(self, item_id: str, error: str) -> None:
		self.connection.execute(
			"""
			UPDATE task_item
			SET status = 'failed',
				last_error = ?,
				updated_at = CURRENT_TIMESTAMP
			WHERE item_id = ?
			""",
			(error, item_id)
		)
		self.pending_changes += 1

	def flush(self) -> None:
		if self.pending_changes <= 0:
			return
		self.connection.commit()
		self.pending_changes = 0

	def _select_ids(self, sql: str) -> list[str]:
		rows = self.connection.execute(sql).fetchall()
		return [row[0] for row in rows]

	def list_pending_or_failed(self) -> list[str]:
		return self._select_ids("SELECT item_id FROM task_item WHERE status != 'done' ORDER BY item_id")

	def list_failed(self) -> list[str]:
		return self._select_ids("SELECT item_id FROM task_item WHERE status = 'failed' ORDER BY item_id")

	def summarize(self, relevant_ids: Sequence[str]) -> ProcessingSummary:
		counts = {"done": 0, "failed": 0, "pending": 0, "in_progress": 0}
		for batch in chunked(relevant_ids, 500):
			placeholders = ",".join(["?"] * len(batch))
			rows = self.connection.execute(
				f"SELECT status, COUNT(*) FROM task_item WHERE item_id IN ({placeholders}) GROUP BY status",
				tuple(batch)
			).fetchall()
			for status, value in rows:
				if status in counts:
					counts[status] += int(value)
		total = len(relevant_ids)
		processed_now = counts["done"] + counts["failed"]
		return ProcessingSummary(
			total=total,
			processed_now=processed_now,
			done=counts["done"],
			failed=counts["failed"],
			pending=counts["pending"],
			in_progress=counts["in_progress"]
		)


class ResilientProcessor(Generic[ItemType]):
	def __init__(
		self,
		name: str,
		state_db_path: Path,
		log_path: Path,
		retries: int,
		progress_every: int = 250,
		retry_delay_seconds: float = 1.0
	) -> None:
		self.name = name
		self.state_db_path = state_db_path
		self.log_path = log_path
		self.retries = max(1, retries)
		self.progress_every = max(1, progress_every)
		self.retry_delay_seconds = max(0.0, retry_delay_seconds)
		self.flush_every = max(1, min(self.progress_every, 250))

	def run(
		self,
		items: Sequence[ItemType],
		get_item_id: Callable[[ItemType], str],
		process_item: Callable[[ItemType], None],
		failed_only: bool,
		reset_state: bool,
		log_progress: Callable[[str], None],
		describe_item: Callable[[ItemType], str] | None = None,
		log_each_item: bool = True,
		max_workers: int = 1
	) -> ProcessingSummary:
		item_map = {get_item_id(item): item for item in items}
		relevant_ids = list(item_map.keys())
		self.log_path.parent.mkdir(parents=True, exist_ok=True)
		with self.log_path.open("a", encoding="utf-8") as error_log:
			state = ProcessingState(self.state_db_path)
			try:
				if reset_state:
					state.clear()
				state.set_metadata("processor_name", self.name)
				state.register_items(relevant_ids)
				target_ids = state.list_failed() if failed_only else state.list_pending_or_failed()
				queue = [item_map[item_id] for item_id in target_ids if item_id in item_map]
				if max_workers > 1:
					return self._run_parallel(
						state=state,
						error_log=error_log,
						queue=queue,
						get_item_id=get_item_id,
						process_item=process_item,
						log_progress=log_progress,
						describe_item=describe_item,
						log_each_item=log_each_item,
						max_workers=max_workers,
						relevant_ids=relevant_ids
					)
				for index, item in enumerate(queue, start=1):
					item_id = get_item_id(item)
					item_label = describe_item(item) if describe_item else item_id
					if log_each_item:
						log_progress(f"[{index}/{len(queue)}] {item_label}")
					last_error: Exception | None = None
					for attempt in range(1, self.retries + 1):
						state.mark_attempt(item_id)
						try:
							process_item(item)
							state.mark_done(item_id)
							last_error = None
							break
						except Exception as exc:
							last_error = exc
							if attempt < self.retries and self.retry_delay_seconds > 0:
								time.sleep(self.retry_delay_seconds * attempt)
					if last_error:
						error_text = str(last_error)
						state.mark_failed(item_id, error_text)
						state.flush()
						error_log.write(f"{item_id}: {error_text}\n")
						error_log.flush()
					if index % self.flush_every == 0:
						state.flush()
					if not log_each_item and index % self.progress_every == 0:
						log_progress(f"Processed {index}/{len(queue)} items")
				state.flush()
				return state.summarize(relevant_ids)
			finally:
				state.close()

	def _run_parallel(
		self,
		*,
		state: ProcessingState,
		error_log,
		queue: Sequence[ItemType],
		get_item_id: Callable[[ItemType], str],
		process_item: Callable[[ItemType], None],
		log_progress: Callable[[str], None],
		describe_item: Callable[[ItemType], str] | None,
		log_each_item: bool,
		max_workers: int,
		relevant_ids: Sequence[str]
	) -> ProcessingSummary:
		in_flight: dict[Future[None], tuple[int, ItemType, int]] = {}
		total = len(queue)
		next_index = 0
		completed = 0

		def submit(executor: ThreadPoolExecutor, index: int, item: ItemType, attempt: int) -> None:
			item_id = get_item_id(item)
			item_label = describe_item(item) if describe_item else item_id
			if log_each_item and attempt == 1:
				log_progress(f"[{index}/{total}] {item_label}")
			state.mark_attempt(item_id)
			future = executor.submit(process_item, item)
			in_flight[future] = (index, item, attempt)

		with ThreadPoolExecutor(max_workers=max_workers) as executor:
			while next_index < total and len(in_flight) < max_workers:
				item = queue[next_index]
				submit(executor, next_index + 1, item, 1)
				next_index += 1

			while in_flight:
				done, _ = wait(in_flight.keys(), return_when=FIRST_COMPLETED)
				for future in done:
					index, item, attempt = in_flight.pop(future)
					item_id = get_item_id(item)
					exc = future.exception()
					if exc is None:
						state.mark_done(item_id)
						completed += 1
					elif attempt < self.retries:
						if self.retry_delay_seconds > 0:
							time.sleep(self.retry_delay_seconds * attempt)
						submit(executor, index, item, attempt + 1)
						continue
					else:
						error_text = str(exc)
						state.mark_failed(item_id, error_text)
						state.flush()
						error_log.write(f"{item_id}: {error_text}\n")
						error_log.flush()
						completed += 1

					if completed % self.flush_every == 0:
						state.flush()
					if not log_each_item and completed % self.progress_every == 0:
						log_progress(f"Processed {completed}/{total} items")

					while next_index < total and len(in_flight) < max_workers:
						next_item = queue[next_index]
						submit(executor, next_index + 1, next_item, 1)
						next_index += 1

		state.flush()
		return state.summarize(relevant_ids)


def chunked(values: Sequence[str], size: int) -> Iterable[Sequence[str]]:
	if size <= 0:
		size = 1
	for index in range(0, len(values), size):
		yield values[index:index + size]
