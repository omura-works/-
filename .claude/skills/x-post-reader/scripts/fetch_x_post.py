#!/usr/bin/env python3
"""X(旧Twitter)の投稿URLから本文・作者・メディア等を取得してJSONで出力する。

x.com 本体はログイン必須でHTML取得が難しいため、公開ミラーAPIを順に試す。
  1. api.fxtwitter.com   (スレッド/長文/記事にも比較的強い)
  2. api.vxtwitter.com
  3. cdn.syndication.twimg.com (埋め込み用API)
  4. publish.twitter.com/oembed (本文のみ・最終手段)

使い方:
  python3 fetch_x_post.py <投稿URL または 投稿ID>

終了コード: 0=成功, 1=全経路失敗, 2=引数エラー
"""
import json
import math
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (compatible; x-post-reader/1.0)"
TIMEOUT = 20


def parse_target(arg):
    m = re.search(r"(?:x|twitter|fxtwitter|vxtwitter|fixupx)\.com/([^/?#]+)/status(?:es)?/(\d+)", arg)
    if m:
        return m.group(1), m.group(2)
    if re.fullmatch(r"\d{5,25}", arg):
        return "i", arg
    return None, None


def ssl_context():
    for cand in (os.environ.get("SSL_CERT_FILE"), os.environ.get("REQUESTS_CA_BUNDLE"),
                 "/root/.ccr/ca-bundle.crt"):
        if cand and os.path.isfile(cand):
            return ssl.create_default_context(cafile=cand)
    return ssl.create_default_context()


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ssl_context()) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def to_base36(x):
    """JavaScriptの Number.prototype.toString(36) 相当(小数部含む)。"""
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    ip, fp = int(x), x - int(x)
    s = ""
    while ip:
        ip, r = divmod(ip, 36)
        s = digits[r] + s
    s = s or "0"
    if fp:
        s += "."
        for _ in range(12):
            fp *= 36
            d = int(fp)
            s += digits[d]
            fp -= d
            if not fp:
                break
    return s


def syndication_token(tid):
    return re.sub(r"(0+|\.)", "", to_base36(int(tid) / 1e15 * math.pi))


def media_list(items):
    out = []
    for m in items or []:
        out.append({
            "type": m.get("type"),
            "url": m.get("url") or m.get("media_url_https") or m.get("thumbnail_url"),
            "alt": m.get("altText") or m.get("alt_text"),
        })
    return out


def from_fx(user, tid):
    d = get_json(f"https://api.fxtwitter.com/{user}/status/{tid}")
    t = d.get("tweet") or {}
    if not t:
        raise ValueError(d.get("message", "no tweet"))
    q = t.get("quote") or {}
    article = t.get("article") or {}
    return {
        "source": "fxtwitter",
        "url": t.get("url"),
        "author": (t.get("author") or {}).get("name"),
        "screen_name": (t.get("author") or {}).get("screen_name"),
        "created_at": t.get("created_at"),
        "lang": t.get("lang"),
        "text": (t.get("raw_text") or {}).get("text") or t.get("text"),
        "article": {"title": article.get("title"), "preview": article.get("preview_text")} if article else None,
        "media": media_list((t.get("media") or {}).get("all")),
        "quote": {"author": (q.get("author") or {}).get("screen_name"), "text": q.get("text")} if q else None,
        "replying_to": t.get("replying_to"),
        "stats": {k: t.get(k) for k in ("likes", "retweets", "replies", "views")},
    }


def from_vx(user, tid):
    t = get_json(f"https://api.vxtwitter.com/{user}/status/{tid}")
    if not t.get("text") and not t.get("tweetID"):
        raise ValueError("no tweet")
    qrt = t.get("qrt") or {}
    return {
        "source": "vxtwitter",
        "url": t.get("tweetURL"),
        "author": t.get("user_name"),
        "screen_name": t.get("user_screen_name"),
        "created_at": t.get("date"),
        "lang": t.get("lang"),
        "text": t.get("text"),
        "article": None,
        "media": media_list(t.get("media_extended")),
        "quote": {"author": qrt.get("user_screen_name"), "text": qrt.get("text")} if qrt else None,
        "replying_to": t.get("replyingTo"),
        "stats": {"likes": t.get("likes"), "retweets": t.get("retweets"), "replies": t.get("replies")},
    }


def from_syndication(user, tid):
    t = get_json(f"https://cdn.syndication.twimg.com/tweet-result?id={tid}&token={syndication_token(tid)}&lang=ja")
    if not t.get("text"):
        raise ValueError("no tweet")
    q = t.get("quoted_tweet") or {}
    u = t.get("user") or {}
    return {
        "source": "syndication",
        "url": f"https://x.com/{u.get('screen_name', user)}/status/{tid}",
        "author": u.get("name"),
        "screen_name": u.get("screen_name"),
        "created_at": t.get("created_at"),
        "lang": t.get("lang"),
        "text": t.get("text"),
        "article": None,
        "media": media_list(t.get("mediaDetails")),
        "quote": {"author": (q.get("user") or {}).get("screen_name"), "text": q.get("text")} if q else None,
        "replying_to": t.get("in_reply_to_screen_name"),
        "stats": {"likes": t.get("favorite_count"), "replies": t.get("conversation_count")},
    }


def from_oembed(user, tid):
    target = urllib.parse.quote(f"https://twitter.com/{user}/status/{tid}", safe="")
    d = get_json(f"https://publish.twitter.com/oembed?omit_script=1&url={target}")
    html = d.get("html", "")
    m = re.search(r"<p[^>]*>(.*?)</p>", html, re.S)
    text = re.sub(r"<br\s*/?>", "\n", m.group(1)) if m else ""
    text = re.sub(r"<[^>]+>", "", text)
    if not text:
        raise ValueError("no text in oembed")
    return {
        "source": "oembed",
        "url": d.get("url"),
        "author": d.get("author_name"),
        "screen_name": (d.get("author_url") or "").rsplit("/", 1)[-1] or None,
        "created_at": None,
        "lang": None,
        "text": text,
        "article": None,
        "media": [],
        "quote": None,
        "replying_to": None,
        "stats": {},
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    user, tid = parse_target(args[0])
    if not tid:
        print(json.dumps({"ok": False, "error": "URLから投稿IDを読み取れません", "input": args[0]},
                         ensure_ascii=False, indent=2))
        sys.exit(2)

    errors = []
    for fn in (from_fx, from_vx, from_syndication, from_oembed):
        try:
            res = fn(user, tid)
            res["ok"] = True
            res["id"] = tid
            print(json.dumps(res, ensure_ascii=False, indent=2))
            return
        except urllib.error.HTTPError as e:
            errors.append(f"{fn.__name__}: HTTP {e.code}")
        except Exception as e:  # プロキシ遮断(403 tunnel)・タイムアウト・JSON不正など
            errors.append(f"{fn.__name__}: {type(e).__name__}: {e}")

    blocked = any("403" in e or "Tunnel" in e or "tunnel" in e for e in errors)
    print(json.dumps({
        "ok": False,
        "id": tid,
        "screen_name": user,
        "network_blocked": blocked,
        "errors": errors,
        "hosts_to_allow": ["api.fxtwitter.com", "api.vxtwitter.com",
                           "cdn.syndication.twimg.com", "publish.twitter.com"],
    }, ensure_ascii=False, indent=2))
    sys.exit(1)


if __name__ == "__main__":
    main()
