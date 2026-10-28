"""Small child-only PTY bootstrap: make the slave the controlling terminal.

Runs in a separate Python interpreter, avoiding unsafe preexec_fn/fork logic
inside Decky's multithreaded backend. No Decky imports or root privileges.
"""
import fcntl
import os
import sys
import termios


def main():
    if os.geteuid() == 0:
        raise PermissionError("SteamHub terminal refuses to run as root")
    if len(sys.argv) != 2:
        raise ValueError("Expected one shell argument")
    # subprocess starts us in a fresh session, with the PTY slave on stdin.
    fcntl.ioctl(0, termios.TIOCSCTTY, 0)
    shell = sys.argv[1]
    os.execv(shell, [os.path.basename(shell), "-i"])


if __name__ == "__main__":
    main()
