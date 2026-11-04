"""Reconcile preserved official schedules; never infer absence of other events."""
import json, zipfile, datetime, hashlib
import xml.etree.ElementTree as E
from pathlib import Path
root=Path(__file__).resolve().parents[1]
u=json.loads((root/'data/index-universe.json').read_text())
audit=json.loads((root/'data/sse-schedule-audit.json').read_text())
by={r['ticker']:r for r in audit['companies']}
norm=lambda s: ''.join(c for c in s.lower() if c.isalnum())
resolved=[]
for c in u['indices']['SSE']['constituents']:
    if by[c['Symbol']].get('date'): continue
    matches=[x for x in u['indices']['SSE']['constituents'] if not x['Symbol'].startswith('900') and norm(x['Name'])==norm(c['Name'])]
    if len(matches)==1 and by[matches[0]['Symbol']].get('date'):
        source=by[matches[0]['Symbol']]
        by[c['Symbol']].update(date=source['date'],matchedIssuerTicker=matches[0]['Symbol'],matchEvidence='Exact normalized issuer name in official CSI constituent file; same issuer A/B listings',status='Issuer Q3 filing outside window; separate B-share publication and other releases not independently excluded',appointment=source['appointment'])
        resolved.append(c['Symbol'])
audit['scope']='All 2233 constituent securities screened; 37 B-share listings additionally linked by exact issuer name to A-share filing records. This is a periodic-filing audit, not proof of first earnings release timing.'
(root/'data/sse-schedule-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print('SSE issuer matches',len(resolved),'unmatched',sum(not x.get('date') for x in audit['companies']))
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
j=json.loads((root/'data/nikkei-schedule-audit.json').read_text()); byj={x['ticker']:x for x in j['companies']}
for filename,url in [('jpx-august.xlsx','https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan08_1002.xlsx'),('jpx-nextday.xlsx','https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan.xlsx')]:
    file=root.parent/'qalendar-handoff'/filename;z=zipfile.ZipFile(file)
    ss=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
    count=0
    for row in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//m:row',ns)[5:]:
        c={''.join(filter(str.isalpha,n.attrib['r'])):(ss[int(n.findtext('m:v',namespaces=ns))] if n.attrib.get('t')=='s' else n.findtext('m:v',default='',namespaces=ns)) for n in row}
        ticker=c.get('B','')+'.T'
        if ticker not in byj or not c.get('A','').isdigit():continue
        date=(datetime.date(1899,12,30)+datetime.timedelta(days=int(c['A']))).isoformat()
        rec=byj[ticker];count+=1
        rec.setdefault('additionalChecks',[])
        check={'source':url,'date':date,'checkedOn':'2026-11-04','sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
        if check not in rec['additionalChecks']:rec['additionalChecks'].append(check)
        if not rec.get('date'):rec.update(date=date,source=url,status='Additional official schedule matched; outside window' if date<'2026-11-02' else 'Additional schedule in window; review before import')
        elif rec['date']!=date:print('DATE CONFLICT',ticker,rec['date'],date)
    print(filename,'matched',count)
(root/'data/nikkei-schedule-audit.json').write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
print('Nikkei unmatched',[(x['ticker']) for x in j['companies'] if not x.get('date')])
