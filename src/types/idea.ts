export interface Idea {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  content: string;
  keyPoints: string[];
  images: string[];
  videos: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  applicableMaterials: string[];
}

export interface IdeaLibrary {
  ideas: Idea[];
}

export interface WorkInstruction {
  // ... 既存のフィールド
  relatedIdeas?: string[]; // パス形式: "category/idea-id"
} 