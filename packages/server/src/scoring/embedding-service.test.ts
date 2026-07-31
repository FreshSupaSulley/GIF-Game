import { describe, it, expect } from 'vitest';
import { cosineSimilarity, MockEmbeddingService } from './embedding-service';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('should return -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([-1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('should handle non-unit vectors', () => {
    const a = new Float32Array([2, 0, 0]);
    const b = new Float32Array([4, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('should return 0 for zero vectors', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should throw for different length vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have the same length');
  });

  it('should compute similarity for complex vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    // Expected: (1*4 + 2*5 + 3*6) / (sqrt(14) * sqrt(77))
    // = 32 / (3.742 * 8.775) = 32 / 32.83 ≈ 0.9746
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.9746, 3);
  });
});

describe('MockEmbeddingService', () => {
  it('should be ready by default', () => {
    const service = new MockEmbeddingService();
    expect(service.isReady()).toBe(true);
  });

  it('should compute similarity based on word overlap', async () => {
    const service = new MockEmbeddingService();
    
    // Identical text should have high similarity
    const identical = await service.computeSimilarity('happy cat', 'happy cat');
    expect(identical).toBeCloseTo(1, 2);
    
    // Partial overlap
    const partial = await service.computeSimilarity('happy cat', 'happy dog');
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
    
    // No overlap
    const none = await service.computeSimilarity('happy cat', 'sad dog');
    expect(none).toBeLessThan(partial);
  });

  it('should compute embedding as 384-dimensional vector', async () => {
    const service = new MockEmbeddingService();
    const embedding = await service.computeEmbedding('happy cat');
    
    expect(embedding).toBeInstanceOf(Float32Array);
    expect(embedding.length).toBe(384);
  });

  it('should compute normalized embeddings', async () => {
    const service = new MockEmbeddingService();
    const embedding = await service.computeEmbedding('test text');
    
    // Compute L2 norm
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    
    expect(norm).toBeCloseTo(1, 5);
  });

  it('should produce consistent embeddings for same text', async () => {
    const service = new MockEmbeddingService();
    const embedding1 = await service.computeEmbedding('consistent text');
    const embedding2 = await service.computeEmbedding('consistent text');
    
    for (let i = 0; i < embedding1.length; i++) {
      expect(embedding1[i]).toBeCloseTo(embedding2[i], 10);
    }
  });

  it('should not be ready after dispose', async () => {
    const service = new MockEmbeddingService();
    expect(service.isReady()).toBe(true);
    
    await service.dispose();
    expect(service.isReady()).toBe(false);
  });
});

describe('OnnxEmbeddingService', () => {
  // Note: These tests would require onnxruntime-node and the model file
  // to be installed. In CI, we test with MockEmbeddingService.
  // 
  // The OnnxEmbeddingService is designed to gracefully fall back to
  // returning 0 similarity if ONNX isn't available.
  
  it('should gracefully handle missing onnx runtime via createEmbeddingService', async () => {
    const { createEmbeddingService } = await import('./embedding-service.js');
    
    // This should fall back to MockEmbeddingService if ONNX isn't installed
    const service = await createEmbeddingService({ enabled: true });
    expect(service).toBeDefined();
    expect(service.isReady()).toBe(true);
  });

  it('should use mock when explicitly disabled', async () => {
    const { createEmbeddingService, MockEmbeddingService } = await import('./embedding-service.js');
    
    const service = await createEmbeddingService({ enabled: false });
    expect(service).toBeInstanceOf(MockEmbeddingService);
  });
});
