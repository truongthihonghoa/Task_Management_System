import re

file_path = r"d:\Cosolaptrinh\Task_Managerment_System\frontend\src\pages\Dashboard.jsx"
output_path = r"d:\Cosolaptrinh\Task_Managerment_System\tmp\search_results.txt"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

results = []
for i, line in enumerate(lines):
    line_num = i + 1
    if any(q in line for q in ["ipAddress", "object", "ip_address"]):
        results.append(f"{line_num}: {line.strip()}")

with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(results))

print("Done writing results.")
