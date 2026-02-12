import pandas as pd
import json

def analyze_excel(file_path):
    xl = pd.ExcelFile(file_path)
    report = {}
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name, header=None) # Read without headers to see where they are
        # Convert to list of lists for easier inspection
        rows = df.head(30).values.tolist()
        report[sheet_name] = rows
    
    with open('excel_analysis.json', 'w') as f:
        json.dump(report, f, indent=2, default=str)

if __name__ == "__main__":
    analyze_excel('Condominio.xlsx')
