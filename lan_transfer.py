"""Opt-in LAN transfer for GameMode Hub.

No sudo, password or external executables. This module refuses to start as
root, binds to a single private IPv4 LAN address on an unprivileged port, and
uses a session PIN to protect a minimal HTTP browser interface. HTTP is not
encrypted: use only trusted private Wi-Fi, never public hotspots.
"""
from __future__ import annotations

from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlsplit
import hmac
import ipaddress
import json
import os
import secrets
import socket
import stat
import threading
import time

MAX_BYTES = 2 * 1024 ** 3
SESSION_SECONDS = 30 * 60
MAX_FILES = 100
READ_SIZE = 256 * 1024
COOKIE = "GMH_TRANSFER"


def user_home():
    return Path(os.environ.get("DECKY_USER_HOME") or Path.home()).resolve()


def require_user():
    if os.geteuid() == 0:
        raise PermissionError("Transfer jest niedostępny dla procesu root.")
    home = user_home()
    if not home.is_dir() or home.stat().st_uid != os.geteuid():
        raise PermissionError("Katalog domowy nie należy do użytkownika.")
    return home


def safe_name(name):
    if not isinstance(name, str) or not 1 <= len(name) <= 200:
        raise ValueError("Nieprawidłowa nazwa pliku.")
    if name in (".", "..") or name.startswith(".") or any(
        x in name for x in ("/", "\\", "\x00", "\r", "\n")
    ) or any(ord(x) < 32 or ord(x) == 127 for x in name):
        raise ValueError("Niedozwolona nazwa pliku.")
    return name


def transfer_folder(create=False):
    home = require_user()
    parent = home / "Downloads"
    folder = parent / "GameMode Hub Transfer"
    for directory in (parent, folder):
        if directory.is_symlink():
            raise PermissionError("Niedozwolone dowiązanie w ścieżce transferu.")
        if create:
            directory.mkdir(mode=0o700, exist_ok=True)
        if directory.exists() and (
            not directory.is_dir() or directory.stat().st_uid != os.geteuid()
        ):
            raise PermissionError("Folder transferu ma nieprawidłowego właściciela.")
    return folder


def local_ip():
    # UDP connect chooses the active interface but sends no packet.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("1.1.1.1", 80))
            address = sock.getsockname()[0]
        if ipaddress.ip_address(address).is_private and not ipaddress.ip_address(address).is_loopback:
            return address
    except OSError:
        pass
    for entry in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
        address = entry[4][0]
        if ipaddress.ip_address(address).is_private and not ipaddress.ip_address(address).is_loopback:
            return address
    raise OSError("Nie znaleziono prywatnego adresu IPv4 w sieci Wi-Fi.")


def validate_share(path):
    home = require_user()
    if not isinstance(path, str) or not path.startswith("/") or "\x00" in path:
        raise ValueError("Nieprawidłowa ścieżka.")
    original = Path(path)
    if original.is_symlink():
        raise PermissionError("Nie udostępniamy dowiązań symbolicznych.")
    resolved = original.resolve(strict=True)
    if home != resolved and home not in resolved.parents:
        raise PermissionError("Można udostępniać wyłącznie pliki użytkownika.")
    if any(p.startswith(".") for p in resolved.relative_to(home).parts):
        raise PermissionError("Ukryte pliki konfiguracyjne nie mogą być udostępnione.")
    if not resolved.is_file() or resolved.stat().st_size > MAX_BYTES:
        raise ValueError("Wybierz zwykły plik o rozmiarze do 2 GiB.")
    safe_name(resolved.name)
    return resolved


def page_html(paired):
    style = """<style>body{font-family:system-ui,Arial,sans-serif;background:#171d28;
color:#fff;max-width:680px;margin:30px auto;padding:15px}button,input{font:inherit;
padding:10px;border-radius:7px}button{background:#426b99;color:white;border:0;
cursor:pointer}input{max-width:100%;background:#f5f5f5;color:black}li{padding:8px;
border-bottom:1px solid #566}a{color:#b6ddff}small{color:#bdc7d7}</style>"""
    base = '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GameMode Hub Transfer</title>' + style + '</head><body><h2>GameMode Hub — Transfer Wi-Fi</h2>'
    if not paired:
        return base + '<p>Wpisz 8-cyfrowy kod widoczny w Hubie na Steam Decku.</p><form method="post" action="/pair"><input type="text" name="pin" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" autocomplete="off" required autofocus><button type="submit">Połącz</button></form><small>Tylko zaufana sieć lokalna. Połączenie HTTP nie jest szyfrowane.</small></body></html>'
    return base + """<p>Połączono! <b>Mac → urządzenie z GameMode Hub:</b>
wybierz plik na Macu, potem naciśnij „Wyślij na urządzenie”.</p>
<p>Pliki trafiają do folderu <b>Downloads / GameMode Hub Transfer</b>.
Nie zastępujemy istniejących plików.</p>
<p><label>Plik z Maca: <input type="file" id="file"></label>
<button id="send">Wyślij na urządzenie</button></p>
<p><b>Urządzenie → Mac:</b> aby pobrać inny plik, na urządzeniu
wybierz w Hubie Pliki → Y na pliku → Udostępnij przez Wi-Fi, a następnie
kliknij poniżej „Odśwież listę”.</p><p id="info" role="status"></p><p><button id="reload">Odśwież listę</button></p>
<ul id="files"></ul><small>Transfer działa tylko do zamknięcia sesji w Hubie; bez hasła roota.</small>
<script>
const info=document.getElementById('info');
async function refresh(){const r=await fetch('/files',{cache:'no-store'});if(!r.ok){info.textContent='Sesja wygasła. Odśwież stronę.';return}
const data=await r.json();const list=document.getElementById('files');list.replaceChildren();
for(const f of data){const li=document.createElement('li');const a=document.createElement('a');
a.href='/download?item='+encodeURIComponent(f.id);a.textContent=f.name;
li.append(a,document.createTextNode(' ('+Math.ceil(f.size/1024)+' KiB)'));list.append(li)}}
document.getElementById('reload').onclick=()=>void refresh();
document.getElementById('send').onclick=()=>{const f=document.getElementById('file').files[0];
if(!f){info.textContent='Wybierz plik z Maca.';return}
const req=new XMLHttpRequest();req.open('POST','/upload');req.setRequestHeader('X-File-Name',encodeURIComponent(f.name));
req.upload.onprogress=e=>{if(e.lengthComputable)info.textContent='Wysyłanie '+Math.round(e.loaded/e.total*100)+'%';};
req.onload=()=>{info.textContent=req.status===201?'Przesłano: '+f.name:'Błąd: '+req.responseText;
if(req.status===201)void refresh()};req.onerror=()=>{info.textContent='Błąd połączenia.'};req.send(f)};
void refresh();
</script></body></html>"""


class TransferManager:
    def __init__(self):
        self.lock = threading.RLock()
        self.server = None
        self.thread = None
        self.expiry_timer = None
        self.address = None
        self.pin = None
        self.cookie = None
        self.paired = set()
        self.failures = {}
        self.shared = {}

    def status(self):
        with self.lock:
            running = self.server is not None
            return {
                "active": running,
                "url": "http://" + self.address[0] + ":" + str(self.address[1]) + "/" if running else None,
                "pin": self.pin if running else None,
                "folder": str(transfer_folder()) if running else None,
                "expiresIn": max(0, int(self.expires_at - time.monotonic())) if running else 0,
            }

    def start(self):
        require_user()
        with self.lock:
            if self.server is not None:
                return self.status()
            transfer_folder(create=True)
            address = local_ip()
            manager = self

            class Handler(BaseHTTPRequestHandler):
                server_version = "GameModeHubTransfer"
                sys_version = ""
                def log_message(self, *_args):
                    # PIN, cookie, filenames and other data must not enter logs.
                    pass

                def _reply(self, code, body, ctype="text/plain; charset=utf-8", extra=None):
                    if isinstance(body, str):
                        body = body.encode("utf-8")
                    self.send_response(code)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("X-Content-Type-Options", "nosniff")
                    self.send_header("Referrer-Policy", "no-referrer")
                    self.send_header("X-Frame-Options", "DENY")
                    self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
                    if extra:
                        for key, value in extra.items():
                            self.send_header(key, value)
                    self.end_headers()
                    self.wfile.write(body)

                def _trusted_denial(self):
                    # Never log or echo IPs, PINs, cookies or request headers.
                    peer = ipaddress.ip_address(self.client_address[0])
                    if not peer.is_private:
                        return "SIEC"
                    expected_host = manager.address[0] + ":" + str(manager.address[1])
                    if self.headers.get("Host", "") != expected_host:
                        return "ADRES"
                    return None

                def _trusted(self):
                    return self._trusted_denial() is None

                def _post_denial(self):
                    """Distinguish browser header failures without loosening LAN/PIN checks.

                    Some browsers classify a same-host form submission as
                    'same-site' rather than 'same-origin'. Accept that only
                    with a matching Origin or Referer; never accept foreign
                    origins or unauthenticated cross-site fetches.
                    """
                    expected_host = manager.address[0] + ":" + str(manager.address[1])
                    expected_origin = "http://" + expected_host
                    origin = self.headers.get("Origin")
                    if origin is not None and origin != expected_origin:
                        return "ORIGIN"
                    referer = self.headers.get("Referer")
                    referer_matches = False
                    if referer is not None:
                        parsed = urlsplit(referer)
                        referer_matches = parsed.scheme == "http" and parsed.netloc == expected_host
                        if not referer_matches:
                            return "REFERER"
                    fetch_site = self.headers.get("Sec-Fetch-Site")
                    if fetch_site is not None:
                        site = fetch_site.lower()
                        if site in ("same-origin", "none"):
                            pass
                        elif site == "same-site" and (origin == expected_origin or referer_matches):
                            pass
                        else:
                            return "METADANE"
                    return None

                def _paired(self):
                    value = SimpleCookie()
                    try:
                        value.load(self.headers.get("Cookie", ""))
                        token = value[COOKIE].value if COOKIE in value else ""
                    except Exception:
                        return False
                    with manager.lock:
                        return any(hmac.compare_digest(token, candidate) for candidate in manager.paired)

                def do_GET(self):
                    if not self._trusted():
                        self._reply(403, "Odmowa dostępu.")
                        return
                    route = urlsplit(self.path)
                    if route.path == "/":
                        self._reply(200, page_html(self._paired()), "text/html; charset=utf-8")
                    elif not self._paired():
                        self._reply(403, "Najpierw wpisz kod parowania.")
                    elif route.path == "/files":
                        data = manager.list_files()
                        self._reply(200, json.dumps(data, ensure_ascii=False), "application/json; charset=utf-8")
                    elif route.path == "/download":
                        entry_id = parse_qs(route.query).get("item", [""])[0]
                        try:
                            self._download(entry_id)
                        except (PermissionError, FileNotFoundError, ValueError, OSError):
                            self._reply(404, "Plik niedostępny.")
                    else:
                        self._reply(404, "Nie znaleziono.")

                def _download(self, entry_id):
                    path = manager.get_file(entry_id)
                    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
                    try:
                        filestat = os.fstat(fd)
                        if not stat.S_ISREG(filestat.st_mode):
                            raise ValueError("Nieprawidłowy plik.")
                        self.send_response(200)
                        self.send_header("Content-Type", "application/octet-stream")
                        self.send_header("Content-Length", str(filestat.st_size))
                        self.send_header("Content-Disposition", "attachment; filename*=UTF-8''" + quote(path.name))
                        self.send_header("Cache-Control", "no-store")
                        self.send_header("X-Content-Type-Options", "nosniff")
                        self.end_headers()
                        with os.fdopen(fd, "rb") as file:
                            fd = -1
                            while chunk := file.read(READ_SIZE):
                                self.wfile.write(chunk)
                    finally:
                        if fd >= 0:
                            os.close(fd)

                def do_POST(self):
                    denial = self._trusted_denial() or self._post_denial()
                    if denial:
                        self._reply(403, "Odmowa dostępu (kod: " + denial + ").")
                        return
                    route = urlsplit(self.path).path
                    if route == "/pair":
                        with manager.lock:
                            count, blocked = manager.failures.get(self.client_address[0], (0, 0))
                            if blocked > time.monotonic() or count >= 15:
                                self._reply(429, "Zbyt wiele prób. Zatrzymaj transfer i uruchom ponownie.")
                                return
                        try:
                            length = int(self.headers.get("Content-Length", "0"))
                            if length < 1 or length > 100:
                                raise ValueError()
                            pin = parse_qs(self.rfile.read(length).decode("ascii")).get("pin", [""])[0]
                        except (ValueError, UnicodeError):
                            self._reply(400, "Nieprawidłowe dane.")
                            return
                        if not hmac.compare_digest(pin, manager.pin):
                            with manager.lock:
                                count, _ = manager.failures.get(self.client_address[0], (0, 0))
                                count += 1
                                manager.failures[self.client_address[0]] = (count, time.monotonic() + 120 if count % 5 == 0 else 0)
                            self._reply(403, "Nieprawidłowy kod.")
                            return
                        token = secrets.token_urlsafe(24)
                        with manager.lock:
                            if len(manager.paired) >= 8:
                                self._reply(429, "Limit sparowanych przeglądarek.")
                                return
                            manager.paired.add(token)
                        self._reply(303, "", extra={
                            "Location": "/",
                            "Set-Cookie": COOKIE + "=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + str(SESSION_SECONDS),
                        })
                    elif route == "/upload":
                        if not self._paired():
                            self._reply(403, "Najpierw wpisz kod parowania.")
                            return
                        self._upload()
                    else:
                        self._reply(404, "Nie znaleziono.")

                def _upload(self):
                    try:
                        name = safe_name(unquote(self.headers.get("X-File-Name", ""), errors="strict"))
                        size = int(self.headers.get("Content-Length", "-1"))
                        if not 0 <= size <= MAX_BYTES:
                            raise ValueError("Maksymalny rozmiar pliku: 2 GiB.")
                        folder = transfer_folder()
                        dest = folder / name
                        tmp = folder / (".incoming-" + secrets.token_hex(12))
                        created = False
                        try:
                            with tmp.open("xb") as stream:
                                created = True
                                remaining = size
                                while remaining:
                                    chunk = self.rfile.read(min(remaining, READ_SIZE))
                                    if not chunk:
                                        raise ConnectionError("Przerwano wysyłanie.")
                                    stream.write(chunk)
                                    remaining -= len(chunk)
                                stream.flush()
                            # Hard link creation fails if the filename exists;
                            # unlike rename(), never overwrites user's files.
                            os.link(tmp, dest, follow_symlinks=False)
                        finally:
                            if created:
                                tmp.unlink(missing_ok=True)
                        self._reply(201, "Przesłano.")
                    except (ValueError, FileExistsError, PermissionError, UnicodeError, OSError) as error:
                        self._reply(409 if isinstance(error, FileExistsError) else 400, str(error))
                    except ConnectionError:
                        self.close_connection = True

            server = ThreadingHTTPServer((address, 0), Handler)
            server.daemon_threads = True
            self.server = server
            self.address = server.server_address
            self.pin = f"{secrets.randbelow(100_000_000):08d}"
            self.paired.clear()
            self.failures.clear()
            self.shared.clear()
            self.expires_at = time.monotonic() + SESSION_SECONDS
            self.thread = threading.Thread(target=server.serve_forever, daemon=True)
            self.thread.start()
            self.expiry_timer = threading.Timer(SESSION_SECONDS, self.stop)
            self.expiry_timer.daemon = True
            self.expiry_timer.start()
            return self.status()

    def stop(self):
        with self.lock:
            server = self.server
            timer = self.expiry_timer
            self.server = None
            self.thread = None
            self.expiry_timer = None
            self.address = None
            self.pin = None
            self.paired.clear()
            self.shared.clear()
            self.failures.clear()
            if timer:
                timer.cancel()
        if server:
            server.shutdown()
            server.server_close()
        return {"active": False}

    def share(self, path):
        source = validate_share(path)
        with self.lock:
            if self.server is None:
                raise RuntimeError("Najpierw uruchom transfer Wi-Fi.")
            if len(self.shared) >= MAX_FILES:
                raise ValueError("Przekroczono limit udostępnionych plików.")
            item_id = "shared:" + secrets.token_hex(12)
            self.shared[item_id] = source
            return {"name": source.name}

    def list_files(self):
        folder = transfer_folder()
        result = []
        if folder.exists():
            for file in sorted(folder.iterdir(), key=lambda f: f.name.casefold()):
                if len(result) >= MAX_FILES:
                    break
                if not file.name.startswith(".") and not file.is_symlink() and file.is_file():
                    result.append({"id": "box:" + file.name, "name": file.name,
                                   "size": file.stat().st_size})
        with self.lock:
            for key, file in self.shared.items():
                if len(result) >= 2 * MAX_FILES:
                    break
                try:
                    valid = validate_share(str(file))
                    result.append({"id": key, "name": valid.name, "size": valid.stat().st_size})
                except (OSError, ValueError, PermissionError):
                    continue
        return result

    def get_file(self, item_id):
        if item_id.startswith("box:"):
            name = safe_name(item_id[4:])
            path = transfer_folder() / name
            if path.is_symlink() or not path.is_file():
                raise FileNotFoundError()
            return path
        with self.lock:
            path = self.shared.get(item_id)
        if path is None:
            raise FileNotFoundError()
        return validate_share(str(path))
