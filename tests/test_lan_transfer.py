"""LAN transfer integration tests: own user, pairing, no arbitrary disk access."""
from http.cookiejar import CookieJar
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlencode, quote
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen
import json
import os
import tempfile
import unittest

from backend.files import lan_transfer


class TransferTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name) / "home"
        self.home.mkdir()
        home = patch.object(lan_transfer, "user_home", return_value=self.home)
        home.start()
        self.addCleanup(home.stop)
        network = patch.object(lan_transfer, "local_ip", return_value="127.0.0.1")
        network.start()
        self.addCleanup(network.stop)
        self.manager = lan_transfer.TransferManager()
        self.addCleanup(self.manager.stop)

    def open(self, path, data=None, headers=None):
        url = self.manager.status()["url"]
        return urlopen(Request(url + path, data=data, headers=headers or {}), timeout=6)

    def paired(self):
        state = self.manager.start()
        cookies = CookieJar()
        browser = build_opener(HTTPCookieProcessor(cookies))
        payload = urlencode({"pin": state["pin"]}).encode()
        origin = state["url"].rstrip("/")
        with browser.open(Request(state["url"] + "pair", data=payload, headers={
            "Origin": origin
        }), timeout=5) as resp:
            self.assertEqual(resp.status, 200)
        return browser, state["url"]

    def test_no_start_as_root(self):
        with patch.object(lan_transfer.os, "geteuid", return_value=0):
            with self.assertRaises(PermissionError):
                self.manager.start()
        self.assertFalse(self.manager.status()["active"])

    def test_start_and_stop_are_explicit(self):
        self.assertFalse(self.manager.status()["active"])
        info = self.manager.start()
        self.assertTrue(info["active"])
        self.assertTrue(info["url"].startswith("http://127.0.0.1:"))
        self.assertEqual(len(info["pin"]), 8)
        self.assertEqual(self.manager.start()["url"], info["url"])
        self.assertTrue((self.home / "Downloads/GameMode Hub Transfer").is_dir())
        self.manager.stop()
        self.assertFalse(self.manager.status()["active"])

    def test_pairing_required_to_list_and_download(self):
        self.manager.start()
        with self.assertRaises(HTTPError) as error:
            self.open("files")
        self.assertEqual(error.exception.code, 403)
        with self.assertRaises(HTTPError) as error:
            self.open("download?item=box%3Aother.txt")
        self.assertEqual(error.exception.code, 403)
        with self.assertRaises(HTTPError) as error:
            self.open("pair", data=b"pin=00000000", headers={"Origin": "http://evil.local"})
        self.assertEqual(error.exception.code, 403)

    def test_safari_pair_without_origin_and_upload_from_mac(self):
        """Safari may omit Origin on same-origin form POSTs.

        Pairing still requires the PIN, and the upload still requires
        a session cookie. The receiving directory must not be overwritten.
        """
        state = self.manager.start()
        browser = build_opener(HTTPCookieProcessor(CookieJar()))
        url = state["url"]
        form = urlencode({"pin": state["pin"]}).encode()
        headers = {"Referer": url, "Sec-Fetch-Site": "same-origin"}
        with browser.open(Request(url + "pair", data=form, headers=headers),
                          timeout=5) as reply:
            self.assertEqual(reply.status, 200)
        payload = b"from Safari on Mac"
        with browser.open(Request(url + "upload", data=payload,
                                  headers={**headers, "X-File-Name": "mac-document.txt"}),
                          timeout=5) as reply:
            self.assertEqual(reply.status, 201)
        target = self.home / "Downloads/GameMode Hub Transfer/mac-document.txt"
        self.assertEqual(target.read_bytes(), payload)
        with self.assertRaises(HTTPError) as error:
            browser.open(Request(url + "upload", data=b"overwritten",
                                 headers={**headers, "X-File-Name": "mac-document.txt"}),
                         timeout=5)
        self.assertEqual(error.exception.code, 409)
        self.assertEqual(target.read_bytes(), payload)

    def test_foreign_referer_and_cross_site_fetch_metadata_rejected(self):
        state = self.manager.start()
        origin = state["url"].rstrip("/")
        data = urlencode({"pin": state["pin"]}).encode()
        for headers in (
            {"Referer": "http://evil.example/pair"},
            {"Sec-Fetch-Site": "cross-site"},
            {"Origin": "null"},
            {"Origin": "http://evil.example", "Sec-Fetch-Site": "same-origin"},
            {"Origin": origin, "Referer": "http://evil.example/"},
        ):
            with self.subTest(headers=headers), self.assertRaises(HTTPError) as error:
                self.open("pair", data=data, headers=headers)
            self.assertEqual(error.exception.code, 403)

    def test_pair_with_same_site_metadata_and_matching_referer(self):
        state = self.manager.start()
        url = state["url"]
        browser = build_opener(HTTPCookieProcessor(CookieJar()))
        data = urlencode({"pin": state["pin"]}).encode()
        with browser.open(Request(url + "pair", data=data, headers={
            "Referer": url, "Sec-Fetch-Site": "same-site"
        }), timeout=5) as response:
            self.assertEqual(response.status, 200)
            self.assertIn("Połączono!".encode(), response.read())

    def test_same_origin_referer_allows_private_origin_null(self):
        """Browser privacy can turn a local form POST Origin into 'null'.

        This is only safe with an independently matching local Referer.
        The response policy permits Referer on this same origin only.
        """
        state = self.manager.start()
        url = state["url"]
        with urlopen(url, timeout=5) as response:
            self.assertEqual(response.headers.get("Referrer-Policy"), "same-origin")
        data = urlencode({"pin": state["pin"]}).encode()
        for fetch_site in ("same-origin", "same-site"):
            with self.subTest(fetch_site=fetch_site):
                browser = build_opener(HTTPCookieProcessor(CookieJar()))
                with browser.open(Request(url + "pair", data=data, headers={
                    "Origin": "null", "Referer": url,
                    "Sec-Fetch-Site": fetch_site,
                }), timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertIn("Połączono!".encode(), response.read())

    def test_paring_rejection_identifies_reason_without_disclosing_headers(self):
        state = self.manager.start()
        data = urlencode({"pin": state["pin"]}).encode()
        cases = [
            ({"Origin": "null"}, b"ORIGIN"),
            ({"Origin": "null", "Referer": state["url"],
              "Sec-Fetch-Site": "cross-site"}, b"METADANE"),
            ({"Origin": "http://evil.example", "Referer": state["url"]}, b"ORIGIN"),
            ({"Referer": "http://evil.example/"}, b"REFERER"),
            ({"Sec-Fetch-Site": "cross-site"}, b"METADANE"),
            ({"Sec-Fetch-Site": "same-site"}, b"METADANE"),
            ({"Host": "other.example"}, b"ADRES"),
        ]
        for headers, expected in cases:
            with self.subTest(headers=headers), self.assertRaises(HTTPError) as caught:
                self.open("pair", data=data, headers=headers)
            self.assertEqual(caught.exception.code, 403)
            self.assertIn(expected, caught.exception.read())

    def test_upload_download_and_exclusive_file_creation(self):
        browser, url = self.paired()
        data = b"hello from Mac"
        headers = {"Origin": url.rstrip("/"), "X-File-Name": quote("ważny plik.txt")}
        with browser.open(Request(url + "upload", data=data, headers=headers), timeout=5) as response:
            self.assertEqual(response.status, 201)
        folder = self.home / "Downloads/GameMode Hub Transfer"
        self.assertEqual((folder / "ważny plik.txt").read_bytes(), data)
        with browser.open(url + "files", timeout=5) as response:
            listed = json.load(response)
        self.assertEqual(listed[0]["name"], "ważny plik.txt")
        from urllib.parse import quote as encode
        with browser.open(url + "download?item=" + encode(listed[0]["id"]), timeout=5) as response:
            self.assertEqual(response.read(), data)
        with self.assertRaises(HTTPError) as error:
            browser.open(Request(url + "upload", data=b"overwrite", headers=headers), timeout=5)
        self.assertEqual(error.exception.code, 409)
        self.assertEqual((folder / "ważny plik.txt").read_bytes(), data)

    def test_share_is_opt_in_and_does_not_copy_or_modify_original(self):
        self.manager.start()
        file = self.home / "important.txt"
        file.write_text("keep")
        shared = self.manager.share(str(file))
        self.assertEqual(shared["name"], file.name)
        self.assertEqual(file.read_text(), "keep")
        self.assertEqual(self.manager.list_files()[0]["name"], file.name)
        with self.assertRaises(PermissionError):
            self.manager.share("/etc/passwd")
        folder = self.home / ".config"
        folder.mkdir()
        (folder / "secret").write_text("s")
        with self.assertRaises(PermissionError):
            self.manager.share(str(folder / "secret"))
        symlink = self.home / "link"
        symlink.symlink_to(file)
        with self.assertRaises(PermissionError):
            self.manager.share(str(symlink))
        self.assertEqual(file.read_text(), "keep")

    def test_attempted_path_traversal_refused(self):
        browser, url = self.paired()
        with self.assertRaises(HTTPError) as error:
            browser.open(Request(url + "upload", data=b"x", headers={
                "Origin": url.rstrip("/"), "X-File-Name": quote("../escape.txt"),
            }), timeout=5)
        self.assertEqual(error.exception.code, 400)
        self.assertFalse((self.home / "Downloads/escape.txt").exists())
        with self.assertRaises(HTTPError) as error:
            browser.open(url + "download?item=box%3A..%2F..%2Fsecret.txt", timeout=5)
        self.assertEqual(error.exception.code, 404)

    def test_unauthorized_host_rejected(self):
        self.manager.start()
        with self.assertRaises(HTTPError) as error:
            self.open("", headers={"Host": "some-remote-dns.example"})
        self.assertEqual(error.exception.code, 403)

    def test_no_auth_data_and_no_credential_files(self):
        self.manager.start()
        path = self.home / "Downloads/GameMode Hub Transfer"
        self.assertEqual([x.name for x in path.iterdir()], [])
        self.assertFalse((self.home / ".ssh").exists())
        self.assertFalse((self.home / ".config").exists())


if __name__ == "__main__":
    unittest.main()
