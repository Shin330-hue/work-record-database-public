// src/lib/adviceData.ts
export type AdviceNode = {
  id: string
  label: string
  icon?: string
  description?: string
  children?: AdviceNode[]
  advice?: {
    title: string
    text: string
    items?: Array<{
      title: string
      description: string
    }>
    icon?: string
    image?: string  // 画像ファイル名
    video?: string  // 動画ファイル名
  }
}

export const adviceTree: AdviceNode[] = [
  {
    id: "surface",
    label: "surface-dirty",
    icon: "😟",
    description: "surface-dirty-desc",
    children: [
      {
        id: "rough",
        label: "surface-rough",
        icon: "🏜️",
        description: "surface-rough-desc",
        children: [
          {
            id: "feedmark",
            label: "surface-feedmark",
            icon: "〰️",
            advice: {
              title: "surface-feedmark-title",
              text: "surface-feedmark-text",
              icon: "💡",
              image: "surface_bad.jpg",
              video: "surface_bad.mp4",
              items: [
                {
                  title: "surface-feedmark-item1-title",
                  description: "surface-feedmark-item1-desc"
                },
                {
                  title: "surface-feedmark-item2-title",
                  description: "surface-feedmark-item2-desc"
                },
                {
                  title: "surface-feedmark-item3-title",
                  description: "surface-feedmark-item3-desc"
                }
              ]
            }
          },
          {
            id: "chatter",
            label: "surface-chatter",
            icon: "〽️",
            advice: {
              title: "surface-chatter-title",
              text: "surface-chatter-text",
              icon: "💡",
              items: [
                {
                  title: "surface-chatter-item1-title",
                  description: "surface-chatter-item1-desc"
                },
                {
                  title: "surface-chatter-item2-title",
                  description: "surface-chatter-item2-desc"
                },
                {
                  title: "surface-chatter-item3-title",
                  description: "surface-chatter-item3-desc"
                }
              ]
            }
          },
          {
            id: "tearout",
            label: "surface-tearout",
            icon: "🦷",
            advice: {
              title: "surface-tearout-title",
              text: "surface-tearout-text",
              icon: "💡",
              items: [
                {
                  title: "surface-tearout-item1-title",
                  description: "surface-tearout-item1-desc"
                },
                {
                  title: "surface-tearout-item2-title",
                  description: "surface-tearout-item2-desc"
                },
                {
                  title: "surface-tearout-item3-title",
                  description: "surface-tearout-item3-desc"
                }
              ]
            }
          }
        ]
      },
      {
        id: "shiny",
        label: "surface-shiny",
        icon: "✨",
        description: "surface-shiny-desc",
        children: [
          {
            id: "buildup",
            label: "surface-buildup",
            icon: "🔺",
            advice: {
              title: "surface-buildup-title",
              text: "surface-buildup-text",
              icon: "💡",
              items: [
                {
                  title: "surface-buildup-item1-title",
                  description: "surface-buildup-item1-desc"
                },
                {
                  title: "surface-buildup-item2-title",
                  description: "surface-buildup-item2-desc"
                },
                {
                  title: "surface-buildup-item3-title",
                  description: "surface-buildup-item3-desc"
                }
              ]
            }
          },
          {
            id: "burnish",
            label: "surface-burnish",
            icon: "🔥",
            advice: {
              title: "surface-burnish-title",
              text: "surface-burnish-text",
              icon: "💡",
              items: [
                {
                  title: "surface-burnish-item1-title",
                  description: "surface-burnish-item1-desc"
                },
                {
                  title: "surface-burnish-item2-title",
                  description: "surface-burnish-item2-desc"
                },
                {
                  title: "surface-burnish-item3-title",
                  description: "surface-burnish-item3-desc"
                }
              ]
            }
          }
        ]
      },
      {
        id: "burr",
        label: "surface-burr",
        icon: "🌵",
        description: "surface-burr-desc",
        children: [
          {
            id: "exit",
            label: "surface-burr-exit",
            icon: "➡️",
            advice: {
              title: "surface-burr-exit-title",
              text: "surface-burr-exit-text",
              icon: "💡",
              items: [
                {
                  title: "surface-burr-exit-item1-title",
                  description: "surface-burr-exit-item1-desc"
                },
                {
                  title: "surface-burr-exit-item2-title",
                  description: "surface-burr-exit-item2-desc"
                },
                {
                  title: "surface-burr-exit-item3-title",
                  description: "surface-burr-exit-item3-desc"
                }
              ]
            }
          },
          {
            id: "entrance",
            label: "surface-burr-entrance",
            icon: "⬅️",
            advice: {
              title: "surface-burr-entrance-title",
              text: "surface-burr-entrance-text",
              icon: "💡",
              items: [
                {
                  title: "surface-burr-entrance-item1-title",
                  description: "surface-burr-entrance-item1-desc"
                },
                {
                  title: "surface-burr-entrance-item2-title",
                  description: "surface-burr-entrance-item2-desc"
                },
                {
                  title: "surface-burr-entrance-item3-title",
                  description: "surface-burr-entrance-item3-desc"
                }
              ]
            }
          }
        ]
      }
    ]
  },
  {
    id: "sound",
    label: "sound-abnormal",
    icon: "🔊",
    description: "sound-abnormal-desc",
    children: [
      {
        id: "highpitch",
        label: "sound-highpitch",
        icon: "📢",
        description: "sound-highpitch-desc",
        children: [
          {
            id: "resonance",
            label: "sound-resonance",
            icon: "📊",
            advice: {
              title: "sound-resonance-title",
              text: "sound-resonance-text",
              icon: "💡",
              items: [
                {
                  title: "sound-resonance-item1-title",
                  description: "sound-resonance-item1-desc"
                },
                {
                  title: "sound-resonance-item2-title",
                  description: "sound-resonance-item2-desc"
                },
                {
                  title: "sound-resonance-item3-title",
                  description: "sound-resonance-item3-desc"
                }
              ]
            }
          }
        ]
      },
      {
        id: "grinding",
        label: "sound-grinding",
        icon: "⚙️",
        description: "sound-grinding-desc",
        children: [
          {
            id: "chipjam",
            label: "sound-chipjam",
            icon: "🌀",
            advice: {
              title: "sound-chipjam-title",
              text: "sound-chipjam-text",
              icon: "💡",
              items: [
                {
                  title: "sound-chipjam-item1-title",
                  description: "sound-chipjam-item1-desc"
                },
                {
                  title: "sound-chipjam-item2-title",
                  description: "sound-chipjam-item2-desc"
                },
                {
                  title: "sound-chipjam-item3-title",
                  description: "sound-chipjam-item3-desc"
                }
              ]
            }
          }
        ]
      }
    ]
  },
  {
    id: "tool",
    label: "tool-life",
    icon: "🔨",
    description: "tool-life-desc",
    children: [
      {
        id: "wear",
        label: "tool-wear-fast",
        icon: "⏳",
        description: "tool-wear-fast-desc",
        children: [
          {
            id: "abrasive",
            label: "tool-abrasive",
            icon: "🪨",
            advice: {
              title: "tool-abrasive-title",
              text: "tool-abrasive-text",
              icon: "💡",
              image: "tool_broken.jpg",
              video: "tool_broken.mp4",
              items: [
                {
                  title: "tool-abrasive-item1-title",
                  description: "tool-abrasive-item1-desc"
                },
                {
                  title: "tool-abrasive-item2-title",
                  description: "tool-abrasive-item2-desc"
                },
                {
                  title: "tool-abrasive-item3-title",
                  description: "tool-abrasive-item3-desc"
                }
              ]
            }
          }
        ]
      },
      {
        id: "chipping",
        label: "tool-chipping",
        icon: "💔",
        description: "tool-chipping-desc",
        children: [
          {
            id: "impact",
            label: "tool-impact",
            icon: "💥",
            advice: {
              title: "tool-impact-title",
              text: "tool-impact-text",
              icon: "💡",
              items: [
                {
                  title: "tool-impact-item1-title",
                  description: "tool-impact-item1-desc"
                },
                {
                  title: "tool-impact-item2-title",
                  description: "tool-impact-item2-desc"
                },
                {
                  title: "tool-impact-item3-title",
                  description: "tool-impact-item3-desc"
                }
              ]
            }
          }
        ]
      }
    ]
  },
  // 残りの項目は前回と同じ構造で、必要に応じて画像・動画を追加
  // ... (dimension, chip, time, heat, quality)
]