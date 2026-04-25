from __future__ import annotations

import json
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

_DB_NAME_CACHE: dict[str, str] = {}


@dataclass(frozen=True)
class D1Config:
	account_id: str
	database_id: str
	api_token: str | None = None
	use_local: bool = False


def get_database_name(database_id: str) -> str:
	if database_id in _DB_NAME_CACHE:
		return _DB_NAME_CACHE[database_id]

	try:
		output = subprocess.check_output(["npx", "wrangler", "d1", "list", "--json"], text=True)
		databases = json.loads(output)
		for db in databases:
			if db.get("uuid") == database_id:
				name = db["name"]
				_DB_NAME_CACHE[database_id] = name
				return name
	except Exception:
		pass

	return database_id


def execute_sql(config: D1Config, sql: str) -> dict[str, Any]:
	if config.api_token and not config.use_local:
		return execute_sql_api(config, sql)
	return execute_sql_wrangler(config, sql)


def execute_sql_file(config: D1Config, file_path: Path) -> dict[str, Any]:
	db_name = get_database_name(config.database_id)
	cmd = ["npx", "wrangler", "d1", "execute", db_name, f"--file={file_path}", "--json"]
	if config.use_local:
		cmd.append("--local")
	else:
		cmd.append("--remote")

	try:
		process = subprocess.run(
			cmd,
			capture_output=True,
			text=True,
			check=True
		)
		results = json.loads(process.stdout)
		return {"success": True, "result": results, "errors": [], "messages": []}
	except subprocess.CalledProcessError as exc:
		try:
			error_json = json.loads(exc.stdout or exc.stderr)
			raise RuntimeError(json.dumps(error_json, ensure_ascii=False)) from exc
		except json.JSONDecodeError:
			raise RuntimeError(exc.stderr or exc.stdout or str(exc)) from exc


def execute_sql_api(config: D1Config, sql: str) -> dict[str, Any]:
	if not config.api_token:
		raise ValueError("API token is required for API-based SQL execution")

	url = f"https://api.cloudflare.com/client/v4/accounts/{config.account_id}/d1/database/{config.database_id}/query"
	payload = json.dumps({"sql": sql}).encode("utf-8")
	request = urllib.request.Request(
		url,
		data=payload,
		headers={
			"Authorization": f"Bearer {config.api_token}",
			"Content-Type": "application/json"
		},
		method="POST"
	)
	try:
		with urllib.request.urlopen(request, timeout=60) as response:
			body = json.loads(response.read().decode("utf-8"))
	except urllib.error.HTTPError as exc:
		raise RuntimeError(exc.read().decode("utf-8")) from exc

	if not body.get("success", False) or body.get("errors"):
		raise RuntimeError(json.dumps(body, ensure_ascii=False))
	return body


def execute_sql_wrangler(config: D1Config, sql: str) -> dict[str, Any]:
	db_name = get_database_name(config.database_id)
	cmd = ["npx", "wrangler", "d1", "execute", db_name, "--command", sql, "--json"]
	if config.use_local:
		cmd.append("--local")
	else:
		cmd.append("--remote")

	try:
		process = subprocess.run(
			cmd,
			capture_output=True,
			text=True,
			check=True
		)
		# Wrangler output can contain multiple JSON objects if multiple queries are executed,
		# but usually it's one array of results.
		results = json.loads(process.stdout)
		return {"success": True, "result": results, "errors": [], "messages": []}
	except subprocess.CalledProcessError as exc:
		try:
			error_json = json.loads(exc.stdout or exc.stderr)
			raise RuntimeError(json.dumps(error_json, ensure_ascii=False)) from exc
		except json.JSONDecodeError:
			raise RuntimeError(exc.stderr or exc.stdout or str(exc)) from exc
