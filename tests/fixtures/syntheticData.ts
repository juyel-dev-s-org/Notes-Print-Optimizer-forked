// tests/fixtures/syntheticData.ts
// Synthetic ImageData fixtures for golden-output testing

export function createDarkSlideFixture(width: number = 100, height: number = 100): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    // Dark background
    data[idx] = 30; data[idx + 1] = 30; data[idx + 2] = 30; data[idx + 3] = 255;
    // White text spots
    if (i % 40 === 0) {
      data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255;
    }
  }
  return new ImageData(data, width, height);
}

export function createLightHandwrittenFixture(width: number = 100, height: number = 100): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    // Light background
    data[idx] = 245; data[idx + 1] = 245; data[idx + 2] = 245; data[idx + 3] = 255;
    // Dark text spots
    if (i % 30 === 0) {
      data[idx] = 20; data[idx + 1] = 20; data[idx + 2] = 20;
    }
  }
  return new ImageData(data, width, height);
}

export function createDiagramFixture(width: number = 100, height: number = 100): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    // White background
    data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255;
    // Black lines (diagram)
    if (i % 25 === 0 || (i > 4900 && i < 5100)) {
      data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0;
    }
  }
  return new ImageData(data, width, height);
}
