import React from 'react';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";

interface ImageLightboxProps {
  images: string[];           // 画像URLの配列
  isOpen: boolean;           // 表示状態
  currentIndex: number;      // 現在表示中の画像インデックス
  onClose: () => void;       // 閉じる時のコールバック
  altText?: string;          // 代替テキスト（アクセシビリティ）
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  isOpen,
  currentIndex,
  onClose,
  altText = "拡大画像"
}) => {
  const slides = images.map((src) => ({ src, alt: altText }));
  
  // モバイル判定
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <Lightbox
      open={isOpen}
      close={onClose}
      slides={slides}
      index={currentIndex}
      plugins={isMobile ? [Zoom] : [Zoom, Thumbnails]}
      zoom={{
        maxZoomPixelRatio: 5,
        zoomInMultiplier: 2,
        doubleTapDelay: 300,
        scrollToZoom: false,
      }}
      thumbnails={{
        position: "bottom",
        width: 80,
        height: 60,
        border: 0,
        borderRadius: 4,
        padding: 4,
        gap: 8,
        showToggle: true,
      }}
      carousel={{
        finite: false,
        preload: 2,
      }}
      render={{
        buttonPrev: images.length <= 1 ? () => null : undefined,
        buttonNext: images.length <= 1 ? () => null : undefined,
      }}
      styles={{
        container: { backgroundColor: "rgba(0, 0, 0, 0.95)" },
        // モバイルでの画像サイズ調整
        slide: isMobile ? { padding: "0 10px" } : undefined,
      }}
    />
  );
};