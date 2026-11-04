"""Build a reviewed snapshot; never run an unreviewed feed straight into production.

Usage: /path/to/python-with-xlrd scripts/build-universe.py SNAPSHOT_FOLDER
HTML inputs are public source snapshots downloaded by the maintainer. JSON files
ending in official/current are extracted factual rosters reviewed against sources.
"""
import json
import re
import sys
from pathlib import Path
from roster_tables import Tables
import xlrd

root = Path(__file__).resolve().parents[1]
snap = Path(sys.argv[1])
rosters = {}


def add(key, rows, source, quality, as_of=None, note=''):
    symbols = [r['Symbol'] for r in rows]
    assert len(symbols) == len(set(symbols)), (key, 'duplicate symbols')
    assert all(re.fullmatch(r'[A-Z0-9.\-]+', t) for t in symbols), key
    rosters[key] = dict(source=source, quality=quality, asOf=as_of,
                        retrievedOn='2026-11-04', note=note, constituents=rows)


def table(name, heading):
    tables = Tables((snap / name).read_text()).tables
    return next(t for t in tables if t and t[0][:len(heading)] == heading)[1:]


sp = [dict(Symbol=r[0].replace('.', '-'), Name=r[1])
      for r in table('SPXwiki', ['Symbol', 'Security'])]
add('SPX', sp, 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies',
    'secondary roster', '2026-10-27', 'Public roster; not a licensed S&P constituent feed.')
add('NDX', json.loads((snap / 'NDXcurrent.json').read_text()),
    'https://en.wikipedia.org/wiki/List_of_NASDAQ-100_companies',
    'secondary roster', '2026-10-22')
dax = json.loads((snap / 'DAX').read_text())
dax = [r for r in dax if r['Symbol'] != 'PAH3.DE']
dax.append(dict(Symbol='HOT.DE', Name='HOCHTIEF AG'))
add('DAX', dax, 'https://www.cashmarket.deutsche-boerse.com/cash-en/trading/Equities/dax-listed-blue-chips-xetra',
    'official roster checked', '2026-11-04', 'All 40 company names reconciled to Deutsche Boerse; HOCHTIEF replaces Porsche Holding.')
add('HSI', json.loads((snap / 'HSIofficial.json').read_text()),
    'https://www.hsi.com.hk/static/uploads/contents/en/news/pressRelease/20260821T174500.pdf',
    'official review roster', '2026-09-07')
ftse = [dict(Symbol=r[1].replace('BT.A', 'BT-A') + '.L', Name=r[0])
        for r in table('FTSEwiki', ['Company', 'Ticker'])]
add('FTSE', ftse, 'https://en.wikipedia.org/wiki/FTSE_100_Index',
    'secondary roster', '2026-10-27', 'Includes September additions EasyJet and Ithaca; all-company provider reconciliation still pending.')
cac = [dict(Symbol=r[3], Name=r[0]) for r in table('CAC', ['Company', 'Sector'])]
add('CAC', cac, 'https://en.wikipedia.org/wiki/CAC_40', 'secondary roster',
    '2025-12', 'Public roster; September 2026 review reports no changes. Full provider reconciliation pending.')
add('N225', json.loads((snap / 'N225official.json').read_text()),
    'https://indexes.nikkei.co.jp/en/nkave/index/component?idx=nk225',
    'official roster', '2026-11-04')
sheet = xlrd.open_workbook(str(snap / 'SSEofficial.xls')).sheet_by_index(0)
assert {sheet.cell_value(i, 0) for i in range(1, sheet.nrows)} == {'20261104'}
sse = [dict(Symbol=sheet.cell_value(i, 4) + '.SS', Name=sheet.cell_value(i, 6),
            aliases=[sheet.cell_value(i, 5)]) for i in range(1, sheet.nrows)]
add('SSE', sse, 'https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/cons/000001cons.xls',
    'official roster', '2026-11-04')
# KIND is a market issuer directory, NOT an index constituent file. Keep it
# searchable, but never infer KOSPI membership from the listing market alone.
kr = Tables((snap / 'KOSPI').read_bytes().decode('euc-kr')).tables[0][1:]
korean = [dict(Symbol=r[2]+'.KS', Name=r[0], ir=r[8]) for r in kr if len(r)>8]
expected = {'SPX':503, 'NDX':101, 'DAX':40, 'HSI':95, 'FTSE':100, 'CAC':40, 'N225':225, 'SSE':2233}
assert {k:len(v['constituents']) for k,v in rosters.items()} == expected
out = dict(snapshotDate='2026-11-04', indices=rosters,
           marketDirectories={'KR':dict(source='https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&marketType=stockMkt',
               note='KOSPI-market issuers only; index membership not inferred. Official index endpoint returned HTTP 400.', companies=korean)})
(root / 'data').mkdir(exist_ok=True)
(root / 'data/index-universe.json').write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
print('Reviewed roster counts:', expected, 'Korean market issuers:', len(korean))
