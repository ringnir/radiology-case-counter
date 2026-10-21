import sys, json, warnings, datetime
warnings.simplefilter('ignore')
import openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
out = {}
def v(c):
    x = c.value
    return x.strftime('%Y-%m-%d') if isinstance(x, (datetime.datetime, datetime.date)) else x
for ws in wb.worksheets:
    rows = []
    for r in ws.iter_rows(min_row=5):
        vals = [v(c) for c in r]
        # A-sheet: 施設名(D)=index3 / B-sheets: 施設名(B)=index1
        key = vals[5] if 'A.疾患' in ws.title else vals[3]      # 検査日（経験年月日）が入っている行
        if key not in (None, ''):
            rows.append(vals)
    out[ws.title] = rows
# 例の行が残っていること、結合セル・入力規則が壊れていないこと
meta = {ws.title: {'merged': len(ws.merged_cells.ranges), 'dv': len(ws.data_validations.dataValidation) if ws.data_validations else 0} for ws in wb.worksheets}
print(json.dumps({'sheets': out, 'meta': meta, 'names': wb.sheetnames}, ensure_ascii=False))
