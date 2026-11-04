"""Download source snapshots for review, never publish or infer earnings dates."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess

SOURCES = {
    k: f"https://yfiua.github.io/index-constituents/constituents-{v}.json"
    for k, v in {"SPX": "sp500", "NDX": "nasdaq100", "DAX": "dax", "HSI": "hsi", "FTSE": "ftse100", "SSE": "sse"}.items()
}
SOURCES.update({
    "N225": "https://indexes.nikkei.co.jp/en/nkave/index/component?idx=nk225",
    "CAC": "https://en.wikipedia.org/wiki/CAC_40",
    "KOSPI": "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&marketType=stockMkt",
})

def fetch(item):
    key, url = item
    try:
        raw = subprocess.check_output(["curl", "-fsSL", "--max-time", "35", "-A", "Mozilla/5.0", url])
        folder = Path("/tmp/qalendar-rosters-20261104")
        folder.mkdir(exist_ok=True)
        (folder / key).write_bytes(raw)
        return {"index": key, "source": url, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "preview": raw[:180].decode("utf-8", errors="replace")}
    except Exception as exc:
        return {"index": key, "source": url, "error": str(exc)}

if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for result in pool.map(fetch, SOURCES.items()):
            print(json.dumps(result, ensure_ascii=False), flush=True)
