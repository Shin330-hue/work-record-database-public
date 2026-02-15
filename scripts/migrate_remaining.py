import json
import os
import shutil
from pathlib import Path

# 移行対象（最終確定版）
migrations = [
    # drawing: machine_type
    ("drawing-0F030800622", "turning"),     # 23 files
    ("drawing-12750800122", "turning"),     # 24 files
    ("drawing-16800301576", "turning"),     # 7 files
    ("drawing-1G-162-TL-05", "turning"),    # 4 files
    ("drawing-24K025_20252725", "turning"), # 9 files
    ("drawing-25417362721", "machining"),   # 3 files ← マシニング！
    ("drawing-DM-05", "turning"),           # 3 files
    ("drawing-sanei_24K022", "turning"),    # 10 files
    ("drawing-91260506-2", "turning"),      # 7 files
    # P103668は削除済みなので除外
]

base_path = Path("public/data/work-instructions")

print("Starting migration...")
print("=" * 60)

total_migrated = 0

for drawing, machine_type in migrations:
    drawing_path = base_path / drawing
    
    if not drawing_path.exists():
        print(f"SKIP {drawing}: Not found")
        continue
    
    print(f"\n{drawing} -> {machine_type}")
    print("-" * 40)
    
    migrated_count = 0
    
    # 各メディアタイプで処理
    for folder_type in ['images', 'videos', 'pdfs', 'programs']:
        folder_path = drawing_path / folder_type
        if not folder_path.exists():
            continue
            
        # 旧形式のstepフォルダを探す
        step_dirs = list(folder_path.glob("step_*"))
        step_dirs = [d for d in step_dirs if not any(x in d.name for x in ['overview', 'machining', 'turning', 'yokonaka', 'radial', 'other'])]
        
        for step_dir in sorted(step_dirs):
            # ファイルがあるか確認
            files = list(step_dir.glob("*"))
            
            if files:
                # 新形式フォルダ名
                step_num = step_dir.name.replace("step_", "")
                new_dir_name = f"step_{step_num}_{machine_type}"
                new_dir_path = folder_path / new_dir_name
                
                # 新フォルダ作成
                new_dir_path.mkdir(exist_ok=True)
                
                # ファイル移動
                for file in files:
                    shutil.move(str(file), str(new_dir_path / file.name))
                    migrated_count += 1
                
                print(f"  Moved {len(files)} files: {folder_type}/{step_dir.name} -> {new_dir_name}")
            
            # 空フォルダを削除
            if step_dir.exists() and not list(step_dir.glob("*")):
                step_dir.rmdir()
    
    # 残った空のstepフォルダを全て削除
    for folder_type in ['images', 'videos', 'pdfs', 'programs']:
        folder_path = drawing_path / folder_type
        if folder_path.exists():
            for step_dir in folder_path.glob("step_[0-9]*"):
                if not list(step_dir.glob("*")):
                    step_dir.rmdir()
                    print(f"  Removed empty: {folder_type}/{step_dir.name}")
    
    if migrated_count > 0:
        print(f"  Total: {migrated_count} files migrated")
        total_migrated += migrated_count
    else:
        print(f"  No files to migrate")

print("\n" + "=" * 60)
print(f"Migration complete!")
print(f"Total files migrated: {total_migrated}")
print(f"Drawings processed: {len(migrations)}")