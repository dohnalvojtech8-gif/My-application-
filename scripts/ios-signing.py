"""Install ephemeral signing material on a GitHub macOS runner. Never print secrets."""
import base64
import datetime
import fnmatch
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
import sys


def required(name):
    value = os.environ.get(name, "")
    if not value:
        raise ValueError("Missing release setting: " + name)
    return value


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.DEVNULL)


def private_file(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    path.chmod(0o600)


def decode_setting(name):
    return base64.b64decode("".join(required(name).split()), validate=True)


def prepare(root):
    team = required("IOS_TEAM_ID")
    if not re.fullmatch(r"[A-Z0-9]{10}", team):
        raise ValueError("IOS_TEAM_ID must be a 10-character Apple team ID")
    if not re.fullmatch(r"\d+\.\d+\.\d+", required("RELEASE_VERSION")):
        raise ValueError("RELEASE_VERSION must be x.y.z")
    if not re.fullmatch(r"[1-9]\d{0,8}", required("RELEASE_BUILD")):
        raise ValueError("RELEASE_BUILD must be a new positive integer")
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    metadata = {"team": team, "profiles": {}, "installed": []}
    meta_file = root / "metadata.json"

    def save():
        private_file(meta_file, json.dumps(metadata).encode())

    save()
    prefixes = set()
    for setting, bundle in [
        ("IOS_APP_PROFILE", "cz.systematic.money"),
        ("IOS_WIDGET_PROFILE", "cz.systematic.money.widget"),
    ]:
        source = root / (setting + ".mobileprovision")
        private_file(source, decode_setting(setting))
        profile = plistlib.loads(run("security", "cms", "-D", "-i", str(source)))
        ent = profile["Entitlements"]
        prefix = profile["ApplicationIdentifierPrefix"][0]
        prefixes.add(prefix)
        shared = prefix + ".cz.systematic.money.shared"
        if (
            team not in profile["TeamIdentifier"]
            or ent.get("application-identifier") != prefix + "." + bundle
            or ent.get("get-task-allow", False)
            or profile.get("ProvisionedDevices")
            or profile.get("ProvisionsAllDevices", False)
            or "group.cz.systematic.money" not in ent.get("com.apple.security.application-groups", [])
            or not any(fnmatch.fnmatchcase(shared, group) for group in ent.get("keychain-access-groups", []))
            or profile["ExpirationDate"] <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        ):
            raise ValueError(setting + " must be a current App Store profile for this team, bundle, App Group and shared Keychain")
        uuid = profile["UUID"]
        if not re.fullmatch(r"[a-fA-F0-9-]{36}", uuid):
            raise ValueError("Invalid profile UUID")
        metadata["profiles"][bundle] = uuid
        for folder in ["Library/MobileDevice/Provisioning Profiles", "Library/Developer/Xcode/UserData/Provisioning Profiles"]:
            target = Path.home() / folder / (uuid + ".mobileprovision")
            if target.exists():
                raise ValueError("Refusing to overwrite an existing signing profile")
            metadata["installed"].append(str(target))
            save()
            private_file(target, source.read_bytes())
    if len(prefixes) != 1:
        raise ValueError("App and widget must share the same AppIdentifierPrefix")
    p12 = root / "distribution.p12"
    private_file(p12, decode_setting("IOS_DISTRIBUTION_P12"))
    password = required("IOS_DISTRIBUTION_PASSWORD")
    keychain = str(root / "release.keychain-db")
    keychain_password = secrets.token_urlsafe(32)
    metadata["original_keychains"] = shlex.split(run("security", "list-keychains", "-d", "user").decode())
    metadata["keychain"] = keychain
    save()
    run("security", "create-keychain", "-p", keychain_password, keychain)
    run("security", "set-keychain-settings", "-lut", "3600", keychain)
    run("security", "unlock-keychain", "-p", keychain_password, keychain)
    run("security", "import", str(p12), "-k", keychain, "-P", password, "-T", "/usr/bin/codesign", "-T", "/usr/bin/security")
    run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-k", keychain_password, keychain)
    run("security", "list-keychains", "-d", "user", "-s", keychain, *metadata["original_keychains"])
    export = {
        "method": "app-store-connect", "destination": "export",
        "teamID": team, "signingStyle": "manual", "signingCertificate": "Apple Distribution",
        "provisioningProfiles": metadata["profiles"],
        "manageAppVersionAndBuildNumber": False, "stripSwiftSymbols": True,
    }
    private_file(root / "ExportOptions.plist", plistlib.dumps(export))
    if os.environ.get("UPLOAD_TESTFLIGHT") == "true":
        key_id, issuer = required("ASC_KEY_ID"), required("ASC_ISSUER_ID")
        if not re.fullmatch(r"[A-Z0-9]{10}", key_id) or not re.fullmatch(r"[a-fA-F0-9-]{36}", issuer):
            raise ValueError("Invalid App Store Connect key or issuer ID")
        key = Path.home() / ".appstoreconnect/private_keys" / ("AuthKey_" + key_id + ".p8")
        if key.exists():
            raise ValueError("Refusing to overwrite an existing API key")
        metadata["installed"].append(str(key))
        save()
        private_file(key, required("ASC_PRIVATE_KEY").encode())
    print("Distribution identity and app/widget profiles prepared. No upload performed.")


def cleanup(root):
    meta_file = root / "metadata.json"
    if meta_file.exists():
        meta = json.loads(meta_file.read_text())
        if "original_keychains" in meta:
            run("security", "list-keychains", "-d", "user", "-s", *meta["original_keychains"])
        if "keychain" in meta and Path(meta["keychain"]).exists():
            run("security", "delete-keychain", meta["keychain"])
        for path in meta.get("installed", []):
            Path(path).unlink(missing_ok=True)
    if root.exists():
        shutil.rmtree(root)


if __name__ == "__main__":
    try:
        if sys.platform != "darwin":
            raise ValueError("Signing requires the macOS runner")
        root = Path(required("RUNNER_TEMP")) / "money-signing"
        if sys.argv[1:] == ["prepare"]:
            prepare(root)
        elif sys.argv[1:] == ["cleanup"]:
            cleanup(root)
        else:
            raise ValueError("Use prepare or cleanup")
    except subprocess.CalledProcessError:
        sys.exit("Apple signing utility failed. Verify the certificate password, profiles and keychain; secret arguments are hidden.")
    except (ValueError, KeyError) as error:
        sys.exit(str(error))
