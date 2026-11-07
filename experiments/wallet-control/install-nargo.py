"""Install the exact research compiler; Linux x86_64 only, no remote shell script."""
import hashlib
import io
from pathlib import Path
import platform
import tarfile
import urllib.request

VERSION = "1.0.0-beta.18"
ARCHIVE_SHA256 = "b7c39a6bfdf6f587685c70ce359305a9b19d644e79bbd19692f4d56044d64f2c"
if platform.system() != "Linux" or platform.machine() != "x86_64":
    raise SystemExit("This bootstrap supports Linux x86_64 only. See README for other platforms.")
url = f"https://github.com/noir-lang/noir/releases/download/v{VERSION}/nargo-x86_64-unknown-linux-gnu.tar.gz"
with urllib.request.urlopen(url, timeout=60) as response:
    archive = response.read()
if hashlib.sha256(archive).hexdigest() != ARCHIVE_SHA256:
    raise SystemExit("Compiler archive checksum mismatch")
target = Path(__file__).resolve().parents[2] / ".work-cache" / "noir" / "nargo"
target.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
    candidates = [m for m in bundle.getmembers() if m.isfile() and Path(m.name).name == "nargo"]
    if len(candidates) != 1:
        raise SystemExit("Unexpected compiler archive")
    target.write_bytes(bundle.extractfile(candidates[0]).read())
target.chmod(0o755)
print(target)
