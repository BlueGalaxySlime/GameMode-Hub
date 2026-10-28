"""No hardware access required: update channels and downgrade validation."""
import unittest
import release_catalog


def entry(tag, prerelease=True):
    return {"tag_name":tag, "draft":False, "prerelease":prerelease,
            "assets":[{"name":"GameMode-Hub.zip",
                       "browser_download_url":release_catalog.DOWNLOAD_PREFIX + tag + "/GameMode-Hub.zip",
                       "digest":"sha256:" + "a"*64}]}


class ReleaseCatalogTests(unittest.TestCase):
    def test_empty_stable_but_test_rollback_exists(self):
        samples=[entry("v0.5.2",False), entry("v0.5.3-test.1")]
        self.assertEqual(release_catalog.catalog(samples,"stable","0.5.3-test.1"),[])
        entries=release_catalog.catalog(samples,"test","0.5.3-test.1")
        self.assertEqual(entries[1]["action"],"downgrade")
        self.assertEqual(entries[1]["version"],"0.5.2")

    def test_test_number_order(self):
        items=[entry("v0.5.3-test.2"),entry("v0.5.3-test.10")]
        self.assertEqual(release_catalog.catalog(items,"test","0.5.3-test.1")[0]["version"],"0.5.3-test.10")

    def test_stable_eligibility(self):
        options=[entry("v0.6.0",False),entry("v0.6.0-test.3"),entry("v0.5.3",False)]
        self.assertEqual([x["version"] for x in release_catalog.catalog(options,"stable","0.5.3-test.1")],["0.6.0"])

    def test_untrusted_zip_or_digest_rejected(self):
        wrong=entry("v0.5.3-test.2")
        wrong["assets"][0]["browser_download_url"]="https://example.com/fake.zip"
        bad=entry("v0.5.3-test.4")
        bad["assets"][0]["digest"]="sha256:123"
        self.assertEqual(release_catalog.catalog([wrong,bad],"test","0.5.3-test.1"),[])

    def test_unknown_channels_rejected(self):
        for choice in ("nightly","stable-ish","",None):
            with self.subTest(choice=choice), self.assertRaises(ValueError):
                release_catalog.catalog([] ,choice,"0.5.3-test.1")


if __name__ == "__main__":
    unittest.main()
