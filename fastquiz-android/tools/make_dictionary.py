import csv, sqlite3, sys, pathlib
src,dst = map(pathlib.Path,sys.argv[1:3])
dst.parent.mkdir(parents=True,exist_ok=True)
if dst.exists(): dst.unlink()
con=sqlite3.connect(dst)
con.execute("CREATE TABLE dictionary(word TEXT PRIMARY KEY, translation TEXT NOT NULL) WITHOUT ROWID")
batch=[]
with src.open(encoding="utf-8-sig",newline="") as f:
    rows=csv.DictReader(f)
    for row in rows:
        word=(row.get("word") or "").lower().strip()
        zh=(row.get("translation") or "").strip()
        if word and zh and len(word)<128:
            batch.append((word,zh))
        if len(batch)>=5000:
            con.executemany("INSERT OR REPLACE INTO dictionary VALUES (?,?)",batch)
            batch=[]
if batch: con.executemany("INSERT OR REPLACE INTO dictionary VALUES (?,?)",batch)
con.commit()
n=con.execute("SELECT count(*) FROM dictionary").fetchone()[0]
ok=con.execute("PRAGMA integrity_check").fetchone()[0]
con.close()
assert n>100000 and ok=="ok",(n,ok)
print(f"Built {n:,} offline translated dictionary entries")
