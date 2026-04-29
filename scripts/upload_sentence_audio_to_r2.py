from __future__ import annotations

import argparse
import mimetypes
import os
import subprocess
import sys
import threading
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from resilient_processing import ResilientProcessor


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Upload extracted sentence audio files to Cloudflare R2.")
	parser.add_argument("--input", type=Path, default=Path("data/audio"))
	parser.add_argument("--bucket", default=os.environ.get("R2_BUCKET_NAME", os.environ.get("R2_BUCKET", "")))
	parser.add_argument("--account-id", default=os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""))
	parser.add_argument("--access-key-id", default=os.environ.get("R2_ACCESS_KEY_ID", ""))
	parser.add_argument("--secret-access-key", default=os.environ.get("R2_SECRET_ACCESS_KEY", ""))
	parser.add_argument("--log", type=Path, default=Path("logs/r2-upload-errors.log"))
	parser.add_argument("--skip-existing", action="store_true")
	parser.add_argument("--retries", type=int, default=3)
	parser.add_argument("--retry-delay-seconds", type=float, default=1.0)
	parser.add_argument("--state-db", type=Path, default=Path("logs/state/r2-upload.sqlite3"))
	parser.add_argument("--workers", type=int, default=max(1, min(8, os.cpu_count() or 4)))
	parser.add_argument("--quiet-progress", action="store_true")
	parser.add_argument("--failed-only", action="store_true")
	parser.add_argument("--reset-state", action="store_true", help="Clear local progress state before starting")
	return parser.parse_args()


def build_s3_client(args: argparse.Namespace):
	return boto3.client(
		"s3",
		endpoint_url=f"https://{args.account_id}.r2.cloudflarestorage.com",
		aws_access_key_id=args.access_key_id,
		aws_secret_access_key=args.secret_access_key,
		region_name="auto"
	)


def validate_args(args: argparse.Namespace) -> None:
	missing = [
		name
		for name, value in (
			("bucket", args.bucket),
			("account-id", args.account_id),
		)
		if not value
	]
	if missing:
		raise SystemExit(f"Missing required R2 settings: {', '.join(missing)}")


def should_use_s3(args: argparse.Namespace) -> bool:
	return bool(args.access_key_id and args.secret_access_key)


def build_wrangler_env() -> dict[str, str]:
	return os.environ.copy()


def run_wrangler(args_list: list[str]) -> subprocess.CompletedProcess[str]:
	return subprocess.run(
		args_list,
		text=True,
		stdout=subprocess.PIPE,
		stderr=subprocess.PIPE,
		env=build_wrangler_env(),
		cwd=str(Path.cwd()),
		check=False
	)


def wrangler_object_exists(bucket: str, key: str) -> bool:
	result = run_wrangler(
		[
			"npx",
			"wrangler",
			"r2",
			"object",
			"get",
			f"{bucket}/{key}",
			"--remote",
			"--pipe"
		]
	)
	if result.returncode == 0:
		return True
	message = f"{result.stdout}\n{result.stderr}".lower()
	if "not found" in message or "404" in message or "no such object" in message:
		return False
	raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"wrangler get failed for {bucket}/{key}")


def wrangler_upload_file(bucket: str, key: str, file_path: Path, content_type: str) -> None:
	result = run_wrangler(
		[
			"npx",
			"wrangler",
			"r2",
			"object",
			"put",
			f"{bucket}/{key}",
			"--remote",
			"--file",
			str(file_path),
			"--content-type",
			content_type
		]
	)
	if result.returncode != 0:
		raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"wrangler put failed for {bucket}/{key}")


def wrangler_bucket_accessible(bucket: str) -> bool:
	result = run_wrangler(["npx", "wrangler", "r2", "bucket", "list"])
	if result.returncode != 0:
		return False
	return bucket in result.stdout


def main() -> int:
	args = parse_args()
	validate_args(args)
	args.log.parent.mkdir(parents=True, exist_ok=True)

	use_s3 = should_use_s3(args)
	client = build_s3_client(args) if use_s3 else None
	mode_label = "s3" if use_s3 else "wrangler"
	print(f"Using R2 upload mode: {mode_label}", file=sys.stderr)

	if use_s3 and client is not None:
		try:
			client.head_bucket(Bucket=args.bucket)
		except Exception as exc:
			print(f"Error: Cannot access R2 bucket '{args.bucket}' via S3: {exc}", file=sys.stderr)
			return 1
	else:
		if not wrangler_bucket_accessible(args.bucket):
			print(f"Error: Cannot access R2 bucket '{args.bucket}' via wrangler. Are you logged in? (npx wrangler login)", file=sys.stderr)
			# Fallback check if it's just not in the list but might be accessible
			try:
				wrangler_object_exists(args.bucket, "non-existent-probe-file")
			except Exception as exc:
				print(f"Connection probe failed: {exc}", file=sys.stderr)
				return 1

	files = [path for path in args.input.rglob("*") if path.is_file()]
	if not files:
		print(f"No files found in {args.input}", file=sys.stderr)
		return 0

	skipped = 0
	skipped_lock = threading.Lock()
	processor = ResilientProcessor[Path](
		name="r2-upload",
		state_db_path=args.state_db,
		log_path=args.log,
		retries=args.retries,
		progress_every=250,
		retry_delay_seconds=args.retry_delay_seconds
	)

	def get_item_id(file_path: Path) -> str:
		return file_path.relative_to(args.input).as_posix()

	def process_item(file_path: Path) -> None:
		nonlocal skipped
		key = get_item_id(file_path)
		content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"

		if use_s3 and client is not None:
			if args.skip_existing:
				try:
					client.head_object(Bucket=args.bucket, Key=key)
					with skipped_lock:
						skipped += 1
					return
				except ClientError as exc:
					code = str(exc.response.get("Error", {}).get("Code", ""))
					if code not in {"404", "NoSuchKey", "NotFound"}:
						raise RuntimeError(f"{key}: {exc}") from exc
			try:
				client.upload_file(
					Filename=str(file_path),
					Bucket=args.bucket,
					Key=key,
					ExtraArgs={"ContentType": content_type}
				)
			except ClientError as exc:
				raise RuntimeError(f"{key}: {exc}") from exc
			return

		if args.skip_existing and wrangler_object_exists(args.bucket, key):
			with skipped_lock:
				skipped += 1
			return
		wrangler_upload_file(args.bucket, key, file_path, content_type)

	summary = processor.run(
		items=files,
		get_item_id=get_item_id,
		process_item=process_item,
		failed_only=args.failed_only,
		reset_state=args.reset_state,
		log_progress=lambda message: print(message, file=sys.stderr),
		describe_item=lambda file_path: file_path.relative_to(args.input).as_posix(),
		log_each_item=not args.quiet_progress,
		max_workers=max(1, args.workers)
	)
	uploaded = max(0, summary.done - skipped)
	print(
		f"Finished R2 upload. total={summary.total} done={summary.done} uploaded={uploaded} skipped={skipped} failed={summary.failed} pending={summary.pending} in_progress={summary.in_progress}",
		file=sys.stderr
	)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
