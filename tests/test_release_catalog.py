"""No hardware access required: update channels and downgrade validation."""
import unittest
from backend.core import release_catalog


def entry(tag, prerelease=True):
    return {"tag_name":tag, "draft":False, "prerelease":prerelease,
            "assets":[{"name":"GameMode-Hub.zip",
                       "browser_download_url":release_catalog.DOWNLOAD_PREFIX + tag + "/GameMode-Hub.zip",
                       "digest":"sha256:" + "a"*64}]}


class ReleaseCatalogTests(unittest.TestCase):
    def test_empty_stable_but_test_rollback_exists(self):
        samples=[entry("v0.5.2",False), entry("v0.5.4")]
        self.assertEqual(release_catalog.catalog(samples,"stable","0.5.4"),[])
        entries=release_catalog.catalog(samples,"test","0.5.4")
        self.assertEqual(entries[1]["action"],"downgrade")
        self.assertEqual(entries[1]["version"],"0.5.2")

    def test_test_number_order(self):
        items=[entry("v0.5.5"),entry("v0.5.3-test.1"),entry("v0.5.4")]
        self.assertEqual(release_catalog.catalog(items,"test","0.5.4")[0]["version"],"0.5.5")

    def test_stable_eligibility(self):
        options=[entry("v0.6.0",False),entry("v0.6.0-test.3"),entry("v0.5.3",False)]
        self.assertEqual([x["version"] for x in release_catalog.catalog(options,"stable","0.5.4")],["0.6.0"])

    def test_untrusted_zip_or_digest_rejected(self):
        wrong=entry("v0.5.5")
        wrong["assets"][0]["browser_download_url"]="https://example.com/fake.zip"
        bad=entry("v0.5.7")
        bad["assets"][0]["digest"]="sha256:123"
        self.assertEqual(release_catalog.catalog([wrong,bad],"test","0.5.4"),[])

    def test_numeric_tag_can_be_test_channel_based_on_prerelease(self):
        entries=release_catalog.catalog([entry("v0.5.4", True)],"test","0.5.4")
        self.assertEqual(entries[0]["version"],"0.5.4")
        self.assertEqual(release_catalog.catalog([entry("v0.5.4", True)],"stable","0.5.4"),[])

    def test_test_channel_sees_newer_versions_despite_stable_latest_052(self):
        releases=[entry("v0.5.5",True),entry("v0.5.4",True),entry("v0.5.2",False)]
        options=release_catalog.catalog(releases,"test","0.5.4")
        self.assertEqual([item["version"] for item in options],["0.5.5","0.5.4","0.5.2"])
        self.assertEqual(options[0]["action"],"upgrade")
        self.assertEqual(release_catalog.catalog(releases,"stable","0.5.4"),[])

    def test_unknown_channels_rejected(self):
        for choice in ("nightly","stable-ish","",None):
            with self.subTest(choice=choice), self.assertRaises(ValueError):
                release_catalog.catalog([] ,choice,"0.5.4")


if __name__ == "__main__":
    unittest.main()
