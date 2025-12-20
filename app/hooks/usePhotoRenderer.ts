// app/hooks/usePhotoRenderer.ts
import { useState, useCallback } from 'react';
import { fabric } from 'fabric';

interface RenderConfig {
  width: number;
  height: number;
  margins?: {
    type: string;
    size: number;
    color: string;
  };
  rotation: number;
  fit: 'fill' | 'fit';
}

export const usePhotoRenderer = () => {
  const [isRendering, setIsRendering] = useState(false);

  const getSizeConfig = (sizeId: string) => {
    const configs: Record<string, { width: number; height: number }> = {
      'kiosco': { width: 1181, height: 1772 },      // 10x15 cm a 300 DPI
      'medium': { width: 1535, height: 2126 },      // 13x18 cm a 300 DPI  
      'large': { width: 1772, height: 2362 },       // 15x20 cm a 300 DPI
      'square-small': { width: 1181, height: 1181 }, // 10x10 cm a 300 DPI
      'square-large': { width: 1772, height: 1772 }  // 15x15 cm a 300 DPI
    };
    return configs[sizeId] || configs['kiosco'];
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const renderPhoto = useCallback(async (
    imageSrc: string,
    sizeId: string,
    config: RenderConfig,
    quality: number = 0.95
  ): Promise<Blob> => {
    setIsRendering(true);

    try {
      const sizeConfig = getSizeConfig(sizeId);

      // Crear canvas temporal
      const canvasElement = document.createElement('canvas');
      const canvas = new fabric.Canvas(canvasElement, {
        width: sizeConfig.width,
        height: sizeConfig.height,
        backgroundColor: '#ffffff'
      });

      // Cargar imagen
      const imgElement = await loadImage(imageSrc);
      const fabricImg = new fabric.Image(imgElement, {
        selectable: false,
        evented: false
      });

      // Aplicar configuraciones
      applyImageSettings(canvas, fabricImg, config, sizeConfig);

      canvas.add(fabricImg);
      canvas.renderAll();

      // Exportar como blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.getElement().toBlob((blob) => {
          resolve(blob!);
        }, 'image/jpeg', quality);
      });

      // Limpiar canvas
      canvas.dispose();

      return blob;

    } catch (error) {
      console.error('Error rendering photo:', error);
      throw error;
    } finally {
      setIsRendering(false);
    }
  }, []);

  const applyImageSettings = (
    canvas: fabric.Canvas,
    fabricImg: fabric.Image,
    config: RenderConfig,
    sizeConfig: { width: number; height: number }
  ) => {
    const { width: canvasWidth, height: canvasHeight } = sizeConfig;

    // Calcular márgenes
    let marginSize = 0;
    if (config.margins && config.margins.type !== 'none') {
      marginSize = (config.margins.size / 25.4) * 300; // mm a píxeles a 300 DPI
    }

    const effectiveWidth = canvasWidth - (marginSize * 2);
    const effectiveHeight = canvasHeight - (marginSize * 2);

    // Aplicar rotación
    fabricImg.set({
      angle: config.rotation,
      originX: 'center',
      originY: 'center'
    });

    // Calcular escala
    const imgWidth = fabricImg.width!;
    const imgHeight = fabricImg.height!;
    let scale: number;

    if (config.fit === 'fill') {
      const scaleX = effectiveWidth / imgWidth;
      const scaleY = effectiveHeight / imgHeight;
      scale = Math.max(scaleX, scaleY);
    } else {
      const scaleX = effectiveWidth / imgWidth;
      const scaleY = effectiveHeight / imgHeight;
      scale = Math.min(scaleX, scaleY);
    }

    fabricImg.set({
      scaleX: scale,
      scaleY: scale,
      left: canvasWidth / 2,
      top: canvasHeight / 2,
    });

    // Aplicar márgenes
    if (config.margins && config.margins.type !== 'none') {
      const marginRect = new fabric.Rect({
        left: 0,
        top: 0,
        width: canvasWidth,
        height: canvasHeight,
        fill: config.margins.color,
        selectable: false,
        evented: false
      });

      canvas.add(marginRect);
      canvas.sendToBack(marginRect);
    }
  };

  const renderMultiplePhotos = useCallback(async (
    photoConfigs: Array<{
      imageSrc: string;
      sizeId: string;
      config: RenderConfig;
      id: string;
    }>,
    quality: number = 0.95,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, Blob>> => {
    const results = new Map<string, Blob>();

    for (let i = 0; i < photoConfigs.length; i++) {
      const photoConfig = photoConfigs[i];

      try {
        const blob = await renderPhoto(
          photoConfig.imageSrc,
          photoConfig.sizeId,
          photoConfig.config,
          quality
        );

        results.set(photoConfig.id, blob);

        if (onProgress) {
          onProgress(i + 1, photoConfigs.length);
        }
      } catch (error) {
        console.error(`Error rendering photo ${photoConfig.id}:`, error);
      }
    }

    return results;
  }, [renderPhoto]);

  return {
    renderPhoto,
    renderMultiplePhotos,
    isRendering
  };
};

export default usePhotoRenderer;