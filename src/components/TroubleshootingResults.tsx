// src/components/TroubleshootingResults.tsx - パス修正版
'use client'
import Image from 'next/image'
import { DiagnosisContext, Advice } from '@/lib/contextBuilder'

interface TroubleshootingResultsProps {
  advice: Advice
  context: DiagnosisContext
  onRestart: () => void
}

// アドバイスタイトルの翻訳関数
const getAdviceTitle = (problemId: string): string => {
  switch (problemId) {
    case 'surface-feedmark': return '送りマーク改善策'
    case 'surface-chatter': return 'ビビリ振動対策'
    case 'surface-tearout': return 'むしれ対策'
    case 'surface-buildup': return '構成刃先の防止策'
    case 'surface-burnish': return '焼け対策'
    case 'surface-burr-exit': return '出口バリ対策'
    case 'surface-burr-entrance': return '入口バリ対策'
    case 'sound-resonance': return '共振対策'
    case 'sound-chipjam': return '切粉詰まり解消'
    case 'tool-abrasive': return '摩耗対策'
    case 'tool-impact': return 'チッピング防止'
    case 'surface-rough': return '送りマーク改善策'
    case 'surface-shiny': return '光沢異常の対策'
    case 'surface-burr': return 'バリ除去対策'
    case 'tool-wear-fast': return '工具摩耗対策'
    case 'dimension-unstable': return '寸法安定化対策'
    case 'material-difficult': return '難削材加工対策'
    case 'vibration-machine': return '振動対策'
    case 'noise-cutting': return '異音対策'
    default: return 'トラブルシューティング'
  }
}

// アドバイステキストの翻訳関数
const getAdviceText = (problemId: string): string => {
  switch (problemId) {
    case 'surface-feedmark': return '送り速度の調整と工具選定により送りマークを改善できます。'
    case 'surface-chatter': return '回転数調整と工具保持の改善でビビリ振動を抑制します。'
    case 'surface-tearout': return '工具の状態確認と切削条件の見直しでむしれを防止します。'
    case 'surface-buildup': return '切削速度の向上とコーティング工具で構成刃先を防止します。'
    case 'surface-burnish': return '切削熱の低減と工具の改善で焼けを防止します。'
    case 'surface-burr-exit': return '工具経路の工夫と切削条件の最適化で出口バリを抑制します。'
    case 'surface-burr-entrance': return '工具進入方法の改善で入口バリを防止します。'
    case 'sound-resonance': return '回転数調整と防振対策で共振を抑制します。'
    case 'sound-chipjam': return '切粉排出の改善で異常音を解消します。'
    case 'tool-abrasive': return '工具材種の見直しと切削条件の最適化で摩耗を抑制します。'
    case 'tool-impact': return '靭性の高い工具選定と切込み方法の改善でチッピングを防止します。'
    case 'surface-rough': return '送り速度の調整と工具選定により送りマークを改善できます。'
    case 'surface-shiny': return '工具摩耗による圧延効果が原因です。工具交換で解決します。'
    case 'surface-burr': return '適切な工具角度と送り条件でバリの発生を抑制できます。'
    case 'tool-wear-fast': return '切削条件の最適化により工具寿命を延ばせます。'
    case 'dimension-unstable': return '機械剛性と工具保持の改善により寸法精度を向上できます。'
    case 'material-difficult': return '適切な工具選定と切削条件により難削材も効率的に加工できます。'
    case 'vibration-machine': return '適切な切削条件と工具選定により振動を抑制できます。'
    case 'noise-cutting': return '切削条件の見直しにより異音を改善できます。'
    default: return '問題の詳細を確認して適切な対策を実施してください。'
  }
}

// 問題タイトルの翻訳関数
const getProblemTitle = (problemId: string): string => {
  switch (problemId) {
    case 'surface-feedmark-item1': return '送り速度の調整'
    case 'surface-feedmark-item2': return '工具の選定'
    case 'surface-feedmark-item3': return '切削条件の最適化'
    case 'surface-chatter-item1': return '回転数の変更'
    case 'surface-chatter-item2': return '工具保持の改善'
    case 'surface-chatter-item3': return 'ワーク固定の強化'
    default: return '対策項目'
  }
}

// 問題説明の翻訳関数
const getProblemDescription = (problemId: string): string => {
  switch (problemId) {
    case 'surface-feedmark-item1': return '送り速度を下げて、0.1～0.2mm/rev程度に調整。仕上げ加工では0.05mm/rev以下を推奨。'
    case 'surface-feedmark-item2': return 'ノーズR（刃先R）の大きい工具に変更。一般的にR0.8以上を使用すると改善。'
    case 'surface-feedmark-item3': return '切削速度を上げて（推奨：100-150m/min）、送りを下げるバランスを見つける。'
    case 'surface-chatter-item1': return '主軸回転数を10-20%増減させて共振を避ける。安定限界線図を参考に。'
    case 'surface-chatter-item2': return '工具突き出し長を最小限に。目安は直径の3-4倍以内。'
    case 'surface-chatter-item3': return 'クランプ力を増強し、支持点を増やす。薄物は特に注意。'
    default: return '詳細な対策内容を確認してください。'
  }
}

export default function TroubleshootingResults({ advice, context, onRestart }: TroubleshootingResultsProps) {
  const getLocalizedAdvice = (): Advice => {
    const problemId = context.selectionPath[context.selectionPath.length - 1]
    
    return {
      ...advice,
      title: getAdviceTitle(problemId) || advice.title,
      text: getAdviceText(problemId) || advice.text,
      items: advice.items?.map(item => ({
        ...item,
        title: getProblemTitle(item.title) || item.title,
        description: getProblemDescription(item.title) || item.description
      }))
    }
  }

  const localizedAdvice = getLocalizedAdvice()

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>💡</div>
        <h1 style={{ 
          fontSize: '28px', 
          marginBottom: '10px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          {localizedAdvice.title}
        </h1>

        <div style={{ 
          background: `rgba(102, 204, 102, 0.2)`,
          border: `1px solid rgba(102, 204, 102, 0.4)`,
          borderRadius: '20px',
          padding: '8px 16px',
          display: 'inline-block',
          fontSize: '14px',
          marginBottom: '20px'
        }}>
          🎯 診断精度: {(context.confidence * 100).toFixed(0)}% | 
          経路: {context.selectionPath.join(' → ')}
        </div>

        <p style={{ fontSize: '16px', color: '#e0e0e0', lineHeight: '1.6' }}>
          {localizedAdvice.text}
        </p>
      </div>

      {/* 🔥 画像表示セクション - パス修正 */}
      {localizedAdvice.image && (
        <div style={{ 
          background: 'rgba(30, 30, 50, 0.6)', 
          borderRadius: '15px', 
          padding: '25px',
          marginBottom: '25px',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            📸 参考画像
          </h3>
          <div style={{ 
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'inline-block',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <Image 
              src={`/media/${localizedAdvice.image}`}
              alt={localizedAdvice.title}
              width={400}
              height={300}
              style={{
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
                maxHeight: '400px'
              }}
            />
          </div>
        </div>
      )}

      {/* 🔥 動画表示セクション - パス修正 */}
      {localizedAdvice.video && (
        <div style={{ 
          background: 'rgba(30, 30, 50, 0.6)', 
          borderRadius: '15px', 
          padding: '25px',
          marginBottom: '25px',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            🎥 解説動画
          </h3>
          <div style={{ 
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'inline-block',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            maxWidth: '100%'
          }}>
            <video 
              controls
              style={{
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
                maxHeight: '400px'
              }}
              onError={(e) => {
                const target = e.target as HTMLVideoElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = `
                    <div style="
                      padding: 40px; 
                      background: rgba(255,255,255,0.05); 
                      border: 2px dashed rgba(255,255,255,0.2);
                      color: #888;
                      border-radius: 10px;
                    ">
                      🎥 動画: ${localizedAdvice.video}<br>
                      <small>パス: /media/${localizedAdvice.video}</small><br>
                      <small>動画ファイルが見つかりません</small>
                    </div>
                  `
                }
              }}
            >
              <source src={`/media/${localizedAdvice.video}`} type="video/mp4" /> {/* 🔥 /media/に修正 */}
              お使いのブラウザは動画をサポートしていません。
            </video>
          </div>
        </div>
      )}

      <div style={{ 
        background: 'rgba(30, 30, 50, 0.6)', 
        borderRadius: '15px', 
        padding: '25px',
        marginBottom: '25px'
      }}>
        <h3 style={{ 
          fontSize: '20px', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          📋 基本対策
        </h3>

        {localizedAdvice.items && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {localizedAdvice.items.map((item, index) => (
              <div key={index} style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '15px',
                borderLeft: '4px solid #667eea'
              }}>
                <div style={{ 
                  background: 'rgba(102, 126, 234, 0.2)',
                  color: '#667eea',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  ✓
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    margin: '0 0 5px 0',
                    color: '#667eea'
                  }}>
                    {getProblemTitle(item.title)}
                  </h4>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#b0b0b0', 
                    margin: 0,
                    lineHeight: '1.4'
                  }}>
                    {getProblemDescription(item.title)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button
          onClick={onRestart}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600'
          }}
        >
          🔄 新しい診断を開始
        </button>
      </div>
    </div>
  )
}