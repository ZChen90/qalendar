"""Read public HTML tables without third-party dependencies."""
from html.parser import HTMLParser


class Tables(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tables, self.table, self.row, self.cell = [], None, None, None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.table = []
        elif tag == 'tr' and self.table is not None:
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = ''

    def handle_data(self, value):
        if self.cell is not None:
            self.cell += value

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(self.cell.split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == 'table' and self.table is not None:
            self.tables.append(self.table)
            self.table = None


if __name__ == '__main__':
    import sys
    from pathlib import Path
    for name in sys.argv[1:]:
        raw = Path('/tmp/qalendar-rosters-20261104', name).read_bytes()
        text = raw.decode('euc-kr' if name == 'KOSPI' else 'utf-8', errors='replace')
        print(name, [(i, len(t), t[:2]) for i, t in enumerate(Tables(text).tables) if len(t) > 30])
