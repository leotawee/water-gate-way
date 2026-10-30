"""Auth tests for the FastAPI hub. No serial/MQTT hardware is touched."""
import asyncio
import os

SECRET = "s" * 40
os.environ["CONTROL_SHARED_SECRET"] = SECRET
os.environ.setdefault("MQTT_HOST", "127.0.0.1")

import pytest
from fastapi.testclient import TestClient

import main

# WHY: no `with` block -> lifespan never runs -> no MQTT/serial threads start.
client = TestClient(main.app)
GOOD = {"X-Control-Token": SECRET}
ENDPOINTS = [
    ("/api/control", {"command": "P1"}),
    ("/api/update-count", {"count": 1}),
]


@pytest.fixture(autouse=True)
def fake_serial(monkeypatch):
    sent = []
    monkeypatch.setattr(main, "send_cmd", lambda cmd: sent.append(cmd) or True)
    return sent


@pytest.mark.parametrize("path,body", ENDPOINTS)
def test_missing_header_401(path, body, fake_serial):
    r = client.post(path, json=body)
    assert r.status_code == 401
    assert r.json() == {"detail": "unauthorized"}
    assert fake_serial == []


@pytest.mark.parametrize("path,body", ENDPOINTS)
def test_wrong_token_401(path, body, fake_serial):
    r = client.post(path, json=body, headers={"X-Control-Token": "x" * 40})
    assert r.status_code == 401
    assert r.json() == {"detail": "unauthorized"}
    assert fake_serial == []


def test_non_ascii_token_401():
    r = client.post("/api/control", json={"command": "P1"}, headers={"X-Control-Token": "é".encode("utf-8")})
    assert r.status_code == 401


def test_control_valid_command_200(fake_serial):
    r = client.post("/api/control", json={"command": "P1"}, headers=GOOD)
    assert r.status_code == 200
    assert fake_serial == ["P1"]


def test_control_invalid_command_rejected(fake_serial):
    r = client.post("/api/control", json={"command": "ZZ"}, headers=GOOD)
    assert r.json()["status"] == "rejected"
    assert fake_serial == []


def test_update_count_valid_200(fake_serial):
    r = client.post("/api/update-count", json={"count": 2}, headers=GOOD)
    assert r.status_code == 200
    assert fake_serial == ["M1"]


def test_update_count_invalid_body_rejected(fake_serial):
    r = client.post("/api/update-count", json={"count": "abc"}, headers=GOOD)
    assert r.status_code == 422
    assert fake_serial == []


def test_no_cors_middleware():
    assert all("CORS" not in m.cls.__name__ for m in main.app.user_middleware)


@pytest.mark.parametrize("secret", [None, "", "short" * 6])
def test_short_or_missing_secret_refuses_start(monkeypatch, secret):
    if secret is None:
        monkeypatch.delenv("CONTROL_SHARED_SECRET")
    else:
        monkeypatch.setenv("CONTROL_SHARED_SECRET", secret)
    # WHY: enter lifespan directly; TestClient wraps SystemExit in an exception group.
    with pytest.raises(SystemExit):
        asyncio.run(main.lifespan(main.app).__aenter__())
