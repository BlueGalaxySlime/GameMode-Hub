"""Independent Linux PTY service. Transport adapters live outside this module.

Sessions are user-triggered, limited, and never run as root. The service
does not store command history or execute shell commands of its own.
"""
import base64
import binascii
import errno
import fcntl
import os
from pathlib import Path
import pty
import pwd
import secrets
import signal
import struct
import subprocess
import sys
import termios
import threading

MAX_SESSIONS = 3
MAX_BUFFER = 256 * 1024
MAX_INPUT = 4096


def validate_dimensions(cols, rows):
    if type(cols) is not int or type(rows) is not int:
        raise ValueError("Invalid terminal dimensions")
    if not (20 <= cols <= 500 and 5 <= rows <= 200):
        raise ValueError("Terminal dimensions out of range")
    return cols, rows


def decode_input(payload):
    if not isinstance(payload, str) or len(payload) > 8192:
        raise ValueError("Invalid terminal input")
    try:
        result = base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("Malformed terminal input") from error
    if len(result) > MAX_INPUT:
        raise ValueError("Terminal input is too long")
    return result


class _Session:
    def __init__(self, process, fd):
        self.process = process
        self.fd = fd
        self._lock = threading.Lock()
        self._pending = bytearray()
        self._truncated = False
        self._closed = False
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()

    def _read_loop(self):
        while True:
            try:
                chunk = os.read(self.fd, 8192)
            except OSError as error:
                if error.errno not in (errno.EIO, errno.EBADF):
                    pass  # Broken PTY: stop; do not leak terminal output to logs.
                break
            if not chunk:
                break
            with self._lock:
                if self._closed:
                    break
                self._pending.extend(chunk)
                if len(self._pending) > MAX_BUFFER:
                    del self._pending[: len(self._pending) - MAX_BUFFER]
                    self._truncated = True

    def read(self):
        with self._lock:
            data = bytes(self._pending)
            self._pending.clear()
            truncated = self._truncated
            self._truncated = False
        return {
            "data": base64.b64encode(data).decode("ascii"),
            "running": self.process.poll() is None,
            "truncated": truncated,
        }

    def write(self, payload):
        data = decode_input(payload)
        with self._lock:
            if self._closed or self.process.poll() is not None:
                raise RuntimeError("Terminal session has ended")
            if not data:
                return
            # Limit each write so a stalled program cannot lock a Decky call.
            import select
            if not select.select([], [self.fd], [], 0.5)[1]:
                raise TimeoutError("Terminal is not accepting input")
            written = os.write(self.fd, data)
            if written != len(data):
                raise OSError("Partial terminal write; retry the remaining input")

    def resize(self, cols, rows):
        cols, rows = validate_dimensions(cols, rows)
        with self._lock:
            if self._closed:
                raise RuntimeError("Terminal session has ended")
            fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        if self.process.poll() is None:
            try:
                os.killpg(self.process.pid, signal.SIGWINCH)
            except ProcessLookupError:
                pass

    def close(self):
        with self._lock:
            if self._closed:
                return
            self._closed = True
        if self.process.poll() is None:
            try:
                os.killpg(self.process.pid, signal.SIGHUP)
            except ProcessLookupError:
                pass
        try:
            os.close(self.fd)
        except OSError:
            pass
        # Reap asynchronously; never block the UI when a shell refuses to exit.
        def reap():
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                if self.process.poll() is None:
                    try:
                        os.killpg(self.process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                self.process.wait()
        threading.Thread(target=reap, daemon=True).start()


class TerminalService:
    def __init__(self):
        self._sessions = {}
        self._lock = threading.RLock()

    def start(self, cols=80, rows=24):
        validate_dimensions(cols, rows)
        # Decky plugin.json has flags: [] so this should always be non-root.
        # Also protect a future standalone adapter from accidentally running
        # an interactive root shell.
        if os.geteuid() == 0:
            raise PermissionError("Terminal requires an unprivileged Linux user")
        with self._lock:
            if len(self._sessions) >= MAX_SESSIONS:
                raise RuntimeError("Close a terminal before opening another (max 3)")
            user = pwd.getpwuid(os.geteuid())
            shell = user.pw_shell if user.pw_shell and os.path.isfile(user.pw_shell) else "/bin/sh"
            master, slave = pty.openpty()
            try:
                env = {
                    "HOME": user.pw_dir,
                    "USER": user.pw_name,
                    "LOGNAME": user.pw_name,
                    "SHELL": shell,
                    "PATH": "/usr/local/bin:/usr/bin:/bin",
                    "TERM": "xterm-256color",
                    "COLORTERM": "truecolor",
                    "LANG": os.environ.get("LANG", "C.UTF-8"),
                }
                for key in ("XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS", "DISPLAY", "WAYLAND_DISPLAY"):
                    if key in os.environ:
                        env[key] = os.environ[key]
                process = subprocess.Popen(
                    [sys.executable, "-I", str(Path(__file__).with_name("worker.py")), shell],
                    stdin=slave, stdout=slave, stderr=slave,
                    start_new_session=True, cwd=user.pw_dir, env=env, close_fds=True,
                )
                fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
            except BaseException:
                os.close(master)
                raise
            finally:
                os.close(slave)
            session_id = secrets.token_urlsafe(24)
            self._sessions[session_id] = _Session(process, master)
            return {"id": session_id}

    def _get(self, session_id):
        if not isinstance(session_id, str):
            raise ValueError("Invalid terminal session")
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise ValueError("Terminal session not found")
        return session

    def read(self, session_id):
        return self._get(session_id).read()

    def write(self, session_id, payload):
        self._get(session_id).write(payload)
        return {"ok": True}

    def resize(self, session_id, cols, rows):
        self._get(session_id).resize(cols, rows)
        return {"ok": True}

    def close(self, session_id):
        with self._lock:
            session = self._sessions.pop(session_id, None)
        if session is not None:
            session.close()
        return {"ok": True}

    def close_all(self):
        with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        for session in sessions:
            session.close()
