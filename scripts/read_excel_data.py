#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
図面データ入力用Excelファイル読み込み・整合性チェックスクリプト
"""

import pandas as pd
import json
import os
from pathlib import Path

def read_excel_data(excel_file_path):
    """Excelファイルを読み込んでデータを解析"""
    
    print(f"📖 Excelファイルを読み込み中: {excel_file_path}")
    
    # Excelファイルの存在確認
    if not os.path.exists(excel_file_path):
        print(f"❌ ファイルが見つかりません: {excel_file_path}")
        return None
    
    try:
        # 各シートを読み込み
        sheets_data = {}
        
        # 基本情報
        try:
            basic_info = pd.read_excel(excel_file_path, sheet_name='基本情報')
            sheets_data['基本情報'] = basic_info
            print("✅ 基本情報シートを読み込みました")
        except Exception as e:
            print(f"⚠️ 基本情報シートの読み込みエラー: {e}")
        
        # 検索分類
        try:
            search_info = pd.read_excel(excel_file_path, sheet_name='検索分類')
            sheets_data['検索分類'] = search_info
            print("✅ 検索分類シートを読み込みました")
        except Exception as e:
            print(f"⚠️ 検索分類シートの読み込みエラー: {e}")
        
        # 作業手順概要
        try:
            overview = pd.read_excel(excel_file_path, sheet_name='作業手順概要')
            sheets_data['作業手順概要'] = overview
            print("✅ 作業手順概要シートを読み込みました")
        except Exception as e:
            print(f"⚠️ 作業手順概要シートの読み込みエラー: {e}")
        
        # 作業ステップ
        try:
            work_steps = pd.read_excel(excel_file_path, sheet_name='作業ステップ')
            sheets_data['作業ステップ'] = work_steps
            print("✅ 作業ステップシートを読み込みました")
        except Exception as e:
            print(f"⚠️ 作業ステップシートの読み込みエラー: {e}")
        
        # 切削条件
        try:
            cutting_conditions = pd.read_excel(excel_file_path, sheet_name='切削条件')
            sheets_data['切削条件'] = cutting_conditions
            print("✅ 切削条件シートを読み込みました")
        except Exception as e:
            print(f"⚠️ 切削条件シートの読み込みエラー: {e}")
        
        # 品質チェック
        try:
            quality_check = pd.read_excel(excel_file_path, sheet_name='品質チェック')
            sheets_data['品質チェック'] = quality_check
            print("✅ 品質チェックシートを読み込みました")
        except Exception as e:
            print(f"⚠️ 品質チェックシートの読み込みエラー: {e}")
        
        # ヒヤリハット
        try:
            troubleshooting = pd.read_excel(excel_file_path, sheet_name='ヒヤリハット')
            sheets_data['ヒヤリハット'] = troubleshooting
            print("✅ ヒヤリハットシートを読み込みました")
        except Exception as e:
            print(f"⚠️ ヒヤリハットシートの読み込みエラー: {e}")
        
        # 関連情報
        try:
            related_info = pd.read_excel(excel_file_path, sheet_name='関連情報')
            sheets_data['関連情報'] = related_info
            print("✅ 関連情報シートを読み込みました")
        except Exception as e:
            print(f"⚠️ 関連情報シートの読み込みエラー: {e}")
        
        # 改訂履歴
        try:
            revision_history = pd.read_excel(excel_file_path, sheet_name='改訂履歴')
            sheets_data['改訂履歴'] = revision_history
            print("✅ 改訂履歴シートを読み込みました")
        except Exception as e:
            print(f"⚠️ 改訂履歴シートの読み込みエラー: {e}")
        
        return sheets_data
        
    except Exception as e:
        print(f"❌ Excelファイルの読み込みエラー: {e}")
        return None

def validate_data_integrity(sheets_data):
    """データの整合性をチェック"""
    
    print("\n🔍 データ整合性チェックを開始...")
    
    validation_results = {
        'is_valid': True,
        'errors': [],
        'warnings': [],
        'summary': {}
    }
    
    # 基本情報のチェック
    if '基本情報' in sheets_data:
        basic_info = sheets_data['基本情報']
        print("\n📋 基本情報チェック:")
        
        # 必須項目の確認
        required_fields = ['図面番号', '会社ID', '会社名', '製品ID', '製品名', '図面タイトル']
        for field in required_fields:
            if field in basic_info['項目'].values:
                value = basic_info[basic_info['項目'] == field]['値'].iloc[0]
                if pd.isna(value) or str(value).strip() == '':
                    validation_results['errors'].append(f"必須項目 '{field}' が空です")
                    validation_results['is_valid'] = False
                else:
                    print(f"  ✅ {field}: {value}")
            else:
                validation_results['errors'].append(f"必須項目 '{field}' が見つかりません")
                validation_results['is_valid'] = False
        
        # 図面番号の形式チェック
        if '図面番号' in basic_info['項目'].values:
            drawing_number = basic_info[basic_info['項目'] == '図面番号']['値'].iloc[0]
            if not pd.isna(drawing_number):
                validation_results['summary']['drawing_number'] = str(drawing_number)
                print(f"  📝 図面番号: {drawing_number}")
    
    # 検索分類のチェック
    if '検索分類' in sheets_data:
        search_info = sheets_data['検索分類']
        print("\n🔍 検索分類チェック:")
        
        # キーワードの確認
        if 'キーワード' in search_info['項目'].values:
            keywords = search_info[search_info['項目'] == 'キーワード']['値'].iloc[0]
            if not pd.isna(keywords):
                keyword_list = [k.strip() for k in str(keywords).split(',')]
                validation_results['summary']['keywords'] = keyword_list
                print(f"  ✅ キーワード: {keyword_list}")
        
        # 難易度の確認
        if '難易度' in search_info['項目'].values:
            difficulty = search_info[search_info['項目'] == '難易度']['値'].iloc[0]
            if not pd.isna(difficulty):
                validation_results['summary']['difficulty'] = str(difficulty)
                print(f"  ✅ 難易度: {difficulty}")
        
        # 推定時間の確認
        if '推定時間' in search_info['項目'].values:
            estimated_time = search_info[search_info['項目'] == '推定時間']['値'].iloc[0]
            if not pd.isna(estimated_time):
                validation_results['summary']['estimated_time'] = str(estimated_time)
                print(f"  ✅ 推定時間: {estimated_time}")
    
    # 作業ステップのチェック
    if '作業ステップ' in sheets_data:
        work_steps = sheets_data['作業ステップ']
        print(f"\n📝 作業ステップチェック:")
        print(f"  📊 ステップ数: {len(work_steps)}")
        validation_results['summary']['step_count'] = len(work_steps)
        
        # ステップ番号の連続性チェック
        if 'ステップ番号' in work_steps.columns:
            step_numbers = work_steps['ステップ番号'].tolist()
            expected_numbers = list(range(1, len(step_numbers) + 1))
            if step_numbers != expected_numbers:
                validation_results['warnings'].append(f"ステップ番号が連続していません: {step_numbers}")
                print(f"  ⚠️ ステップ番号: {step_numbers}")
            else:
                print(f"  ✅ ステップ番号: {step_numbers}")
    
    # 切削条件のチェック
    if '切削条件' in sheets_data:
        cutting_conditions = sheets_data['切削条件']
        print(f"\n🔧 切削条件チェック:")
        print(f"  📊 条件数: {len(cutting_conditions)}")
        validation_results['summary']['cutting_conditions_count'] = len(cutting_conditions)
    
    # 品質チェックのチェック
    if '品質チェック' in sheets_data:
        quality_check = sheets_data['品質チェック']
        print(f"\n✅ 品質チェックチェック:")
        print(f"  📊 チェック項目数: {len(quality_check)}")
        validation_results['summary']['quality_check_count'] = len(quality_check)
    
    # ヒヤリハットのチェック
    if 'ヒヤリハット' in sheets_data:
        troubleshooting = sheets_data['ヒヤリハット']
        print(f"\n🚨 ヒヤリハットチェック:")
        print(f"  📊 ヒヤリハット数: {len(troubleshooting)}")
        validation_results['summary']['troubleshooting_count'] = len(troubleshooting)
    
    return validation_results

def display_data_summary(sheets_data, validation_results):
    """データサマリーを表示"""
    
    print("\n" + "="*60)
    print("📊 データサマリー")
    print("="*60)
    
    print(f"📁 読み込みシート数: {len(sheets_data)}")
    
    for sheet_name, data in sheets_data.items():
        print(f"  📋 {sheet_name}: {len(data)}行")
    
    print(f"\n🔍 整合性チェック結果:")
    print(f"  ✅ 有効: {validation_results['is_valid']}")
    print(f"  ❌ エラー数: {len(validation_results['errors'])}")
    print(f"  ⚠️ 警告数: {len(validation_results['warnings'])}")
    
    if validation_results['errors']:
        print(f"\n❌ エラー:")
        for error in validation_results['errors']:
            print(f"  - {error}")
    
    if validation_results['warnings']:
        print(f"\n⚠️ 警告:")
        for warning in validation_results['warnings']:
            print(f"  - {warning}")
    
    if validation_results['summary']:
        print(f"\n📝 サマリー:")
        for key, value in validation_results['summary'].items():
            print(f"  - {key}: {value}")

def main():
    """メイン処理"""
    
    # Excelファイルのパスを図番12750800122用に変更
    excel_file_path = "doc/import_files/12750800122_リテーナ/図面データ入力テンプレート_12750800122.xlsx"
    
    print("🚀 図面データExcelファイル読み込み・整合性チェック開始")
    print("="*60)
    
    # Excelファイルを読み込み
    sheets_data = read_excel_data(excel_file_path)
    
    if sheets_data is None:
        print("❌ Excelファイルの読み込みに失敗しました")
        return
    
    # データの整合性をチェック
    validation_results = validate_data_integrity(sheets_data)
    
    # サマリーを表示
    display_data_summary(sheets_data, validation_results)
    
    # 結果をJSONファイルに保存
    output_file = "excel_data_analysis_12750800122.json"
    analysis_data = {
        'file_path': excel_file_path,
        'sheets_data': {name: df.to_dict('records') for name, df in sheets_data.items()},
        'validation_results': validation_results
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(analysis_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 分析結果を保存しました: {output_file}")
    
    if validation_results['is_valid']:
        print("\n✅ データは有効です。JSONファイル作成に進めます。")
    else:
        print("\n❌ データに問題があります。修正してから再実行してください。")

if __name__ == "__main__":
    main() 