import re

file_path = r"d:\Cosolaptrinh\Task_Managerment_System\frontend\src\pages\Dashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Pattern for ipAddress: "..." or object: "..."
# We will match lines that start with optional spaces, then ipAddress or object, followed by colon, value, and optional comma.
pattern = re.compile(r'^\s*(ipAddress|object)\s*:\s*.*?,?\n', re.MULTILINE)

new_content, count = re.subn(pattern, '', content)

print(f"Removed {count} lines matching the pattern.")

if count > 0:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Dashboard.jsx updated successfully.")
else:
    print("No matches found to remove.")
