"""Pinata IPFS pinning client.

This module pins files and JSON to IPFS using Pinata.

Security:
- Auth uses a JWT provided via environment variable.
- Never hardcode secrets.
"""

from __future__ import annotations

import os
import json
from dataclasses import dataclass
from typing import Any

import httpx


class PinataError(RuntimeError):
    pass


@dataclass(frozen=True)
class PinataPinResult:
    cid: str
    size: int | None


def _pinata_jwt() -> str:
    jwt = os.getenv("PINATA_JWT")
    if not jwt:
        raise PinataError("PINATA_JWT is not configured")
    return jwt


def ipfs_uri(cid: str) -> str:
    return f"ipfs://{cid}"


async def pin_json_to_ipfs(*, payload: dict[str, Any], name: str | None = None) -> PinataPinResult:
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {"Authorization": f"Bearer {_pinata_jwt()}"}

    body: dict[str, Any] = payload
    if name:
        body = {
            "pinataContent": payload,
            "pinataMetadata": {"name": name},
        }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, json=body)
        if resp.status_code >= 400:
            raise PinataError(f"Pinata pinJSONToIPFS failed ({resp.status_code}): {resp.text}")
        data = resp.json()

    cid = data.get("IpfsHash")
    if not isinstance(cid, str) or not cid:
        raise PinataError("Pinata response missing IpfsHash")
    size = data.get("PinSize")
    return PinataPinResult(cid=cid, size=int(size) if isinstance(size, (int, float, str)) and str(size).isdigit() else None)


async def pin_file_to_ipfs(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str | None,
    name: str | None = None,
) -> PinataPinResult:
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {"Authorization": f"Bearer {_pinata_jwt()}"}

    files = {"file": (filename, file_bytes, content_type or "application/octet-stream")}
    data: dict[str, str] = {}
    if name:
        data["pinataMetadata"] = json.dumps({"name": name})

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, headers=headers, files=files, data=data)
        if resp.status_code >= 400:
            raise PinataError(f"Pinata pinFileToIPFS failed ({resp.status_code}): {resp.text}")
        result = resp.json()

    cid = result.get("IpfsHash")
    if not isinstance(cid, str) or not cid:
        raise PinataError("Pinata response missing IpfsHash")
    size = result.get("PinSize")
    return PinataPinResult(cid=cid, size=int(size) if isinstance(size, (int, float, str)) and str(size).isdigit() else None)
