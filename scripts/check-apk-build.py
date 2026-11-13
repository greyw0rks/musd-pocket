"""Verify the signed update and every bundled asset. Does not access signing keys."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile

root = Path.cwd()
rtk = "/home/greyw0rks/ubuntu-to-debian-migration/bin/rtk"
build_root = Path.home() / ".local/share/mpocket-build"
build_tools = build_root / "android-sdk/build-tools/36.0.0"
apk = root / "public/downloads/mpocket-0.2.5.apk"
environment = dict(os.environ, PATH=str(build_root / "jdk/bin") + ":" + os.environ["PATH"])

def run(*args):
    return subprocess.check_output([rtk, "proxy", *map(str, args)], env=environment, text=True)

certificate = "34608cce75a2e10318587090b7cab6acd5aaac3b4507dd09c0fcd6e76056b57c"
signature = run(build_tools / "apksigner", "verify", "--verbose", "--print-certs", apk)
assert "Verified using v2 scheme (APK Signature Scheme v2): true" in signature
assert "Verified using v3 scheme (APK Signature Scheme v3): true" in signature
assert re.search(r"certificate SHA-256 digest: ([0-9a-f]+)", signature).group(1) == certificate
run(build_tools / "zipalign", "-c", "-P", "16", "4", apk)
metadata = run(build_tools / "aapt2", "dump", "badging", apk)
assert "name='tech.mpocket.testing'" in metadata
assert "versionCode='7'" in metadata and "versionName='0.2.5'" in metadata
assert "minSdkVersion:'24'" in metadata

asset_root = root / "apps/android/app/src/main/assets/web"
assets = {"assets/web/" + str(path.relative_to(asset_root)): path.read_bytes() for path in asset_root.rglob("*") if path.is_file()}
with zipfile.ZipFile(apk) as archive:
    packaged = {name for name in archive.namelist() if name.startswith("assets/web/") and not name.endswith("/")}
    assert packaged == assets.keys(), "APK asset inventory differs from the final mobile build"
    for name, content in assets.items():
        assert archive.read(name) == content, "Stale packaged asset: " + name

lint = ET.parse(root / "apps/android/app/build/reports/lint-results-release.xml")
issues = lint.findall("issue")
errors = [issue.attrib["id"] for issue in issues if issue.attrib.get("severity") in ("Error", "Fatal")]
assert errors == []
result = {
    "versionName": "0.2.5", "versionCode": 7, "apkBytes": apk.stat().st_size,
    "sha256": hashlib.sha256(apk.read_bytes()).hexdigest(), "webAssetCount": len(assets),
    "allPackagedAssetsMatchViteBuild": True, "lintErrors": errors,
    "lintWarnings": sum(issue.attrib.get("severity") == "Warning" for issue in issues),
    "signingCertificateSha256": certificate, "signatureV2V3Verified": True,
    "zipAlignment16KiBVerified": True, "minimumAndroidApi": 24,
}
evidence = root / "docs/evidence/android/apk-0.2.5-build.json"
evidence.write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
