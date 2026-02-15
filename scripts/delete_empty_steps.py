import os
import shutil
from pathlib import Path

# 削除対象の図番リスト（確認済み）
empty_drawings = [
    "drawing-04297711725",
    "drawing-05389730954", 
    "drawing-06190300668",
    "drawing-06200301496",
    "drawing-0974122270",
    "drawing-0A149002911",
    "drawing-0A224000531",
    "drawing-0A229001290",
    "drawing-0E260800172",
    "drawing-0E260800190",
    "drawing-25417362731",
    "drawing-5427365400",
    "drawing-A3159-500-00-A1",
    "drawing-GSETJIG-3101",
    "drawing-INNSJ-XXXX",
    "drawing-M-2009211-060",
    "drawing-M-5329619-160",
    "drawing-TM2404599-1601-0",
    "drawing-TM2404599-1603-0",
    "drawing-TM2404599-1604-0",
    "drawing-TM2404599-1651-0",
    "drawing-TMT1750-P0003"
]

base_path = Path("public/data/work-instructions")

print("Starting deletion of empty step folders...\n")

total_deleted = 0

for drawing in empty_drawings:
    drawing_path = base_path / drawing
    deleted_count = 0
    
    if not drawing_path.exists():
        print(f"SKIP {drawing}: Folder does not exist")
        continue
    
    # 各メディアタイプのstepフォルダを削除
    for folder_type in ['images', 'videos', 'pdfs', 'programs']:
        folder_path = drawing_path / folder_type
        if folder_path.exists():
            step_dirs = list(folder_path.glob("step_*"))
            for step_dir in step_dirs:
                # overviewフォルダは削除しない
                if "overview" not in str(step_dir):
                    try:
                        shutil.rmtree(step_dir)
                        deleted_count += 1
                    except Exception as e:
                        print(f"ERROR deleting {step_dir}: {e}")
    
    if deleted_count > 0:
        print(f"DONE {drawing}: Deleted {deleted_count} step folders")
        total_deleted += deleted_count
    else:
        print(f"SKIP {drawing}: No step folders found")

print(f"\nTotal: Deleted {total_deleted} step folders from {len(empty_drawings)} drawings")