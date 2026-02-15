import json
import os
from pathlib import Path

# 作業手順が空の図番リスト（drawing-02760810650は削除済み）
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

print("作業手順が空の図番を確認中...\n")

for drawing in empty_drawings:
    drawing_path = base_path / drawing
    
    if not drawing_path.exists():
        print(f"ERROR {drawing}: Folder does not exist")
        continue
    
    # instruction.jsonを確認
    instruction_file = drawing_path / "instruction.json"
    if instruction_file.exists():
        with open(instruction_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # workStepsByMachineの確認
        has_steps = False
        if 'workStepsByMachine' in data:
            for machine_type in ['machining', 'turning', 'yokonaka', 'radial', 'other']:
                if machine_type in data['workStepsByMachine'] and len(data['workStepsByMachine'][machine_type]) > 0:
                    has_steps = True
                    break
        
        # workStepsの確認（後方互換性）
        if 'workSteps' in data and len(data['workSteps']) > 0:
            has_steps = True
            
        if has_steps:
            print(f"WARNING {drawing}: Has work steps (skip deletion)")
        else:
            # stepフォルダの存在確認
            step_folders = []
            for folder_type in ['images', 'videos', 'pdfs', 'programs']:
                folder_path = drawing_path / folder_type
                if folder_path.exists():
                    step_dirs = list(folder_path.glob("step_*"))
                    if step_dirs:
                        step_folders.extend([str(d) for d in step_dirs])
            
            if step_folders:
                print(f"OK {drawing}: Empty work steps, {len(step_folders)} step folders found")
            else:
                print(f"OK {drawing}: Empty work steps, no step folders")
    else:
        print(f"ERROR {drawing}: instruction.json not found")

print(f"\n合計: {len(empty_drawings)}件")