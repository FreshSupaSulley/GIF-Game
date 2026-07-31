/**
 * EmbeddingService for computing text embeddings using ONNX runtime.
 * 
 * Uses all-MiniLM-L6-v2 model for 384-dimensional embeddings.
 * Falls back gracefully if ONNX runtime or model is unavailable.
 * 
 * Note: The ONNX model file must be downloaded separately and placed at
 * the configured path. The model is not included in the repository.
 * 
 * Download from: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
 * Convert to ONNX or use pre-converted: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/tree/main/onnx
 */

// Type declarations for dynamic import of onnxruntime-node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrtModule = any;

export interface EmbeddingServiceOptions {
  /** Path to the ONNX model file */
  modelPath?: string;
  /** Enable/disable the service (for testing without ONNX) */
  enabled?: boolean;
}

/**
 * Abstract interface for embedding computation.
 * Allows for mock implementations in tests.
 */
export interface EmbeddingService {
  /** Returns true if the service is ready to compute embeddings */
  isReady(): boolean;
  
  /** Computes cosine similarity between two text strings */
  computeSimilarity(text1: string, text2: string): Promise<number>;
  
  /** Computes embedding vector for a single text */
  computeEmbedding(text: string): Promise<Float32Array>;
  
  /** Releases resources */
  dispose(): Promise<void>;
}

/**
 * Computes cosine similarity between two vectors.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }
  
  return dotProduct / magnitude;
}

/**
 * Mock embedding service for development/testing.
 * Uses simple word overlap heuristics instead of real embeddings.
 */
export class MockEmbeddingService implements EmbeddingService {
  private ready = true;

  isReady(): boolean {
    return this.ready;
  }

  async computeSimilarity(text1: string, text2: string): Promise<number> {
    // Simple word overlap similarity for testing
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        overlap++;
      }
    }
    
    const unionSize = new Set([...words1, ...words2]).size;
    return unionSize > 0 ? overlap / unionSize : 0;
  }

  async computeEmbedding(text: string): Promise<Float32Array> {
    // Return a simple hash-based pseudo-embedding for testing
    const embedding = new Float32Array(384);
    const hash = this.simpleHash(text.toLowerCase());
    
    for (let i = 0; i < 384; i++) {
      embedding[i] = Math.sin(hash * (i + 1)) * 0.5;
    }
    
    // Normalize
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }

  async dispose(): Promise<void> {
    this.ready = false;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

/**
 * Real ONNX-based embedding service.
 * Requires onnxruntime-node to be installed and the model file to be present.
 */
export class OnnxEmbeddingService implements EmbeddingService {
  private session: any = null;
  private tokenizer: SimpleTokenizer;
  private ready = false;
  private modelPath: string;
  private ort: OrtModule = null;

  constructor(options: EmbeddingServiceOptions = {}) {
    this.modelPath = options.modelPath ?? './models/all-MiniLM-L6-v2.onnx';
    this.tokenizer = new SimpleTokenizer();
  }

  async initialize(): Promise<boolean> {
    try {
      // Dynamic import to avoid errors if onnxruntime-node isn't installed
      // Using Function constructor to avoid static analysis of the import
      const moduleName = 'onnxruntime-node';
      this.ort = await import(/* webpackIgnore: true */ moduleName).catch(() => null);
      if (!this.ort) {
        throw new Error('onnxruntime-node not installed');
      }
      this.session = await this.ort.InferenceSession.create(this.modelPath);
      this.ready = true;
      console.log('[EmbeddingService] ONNX model loaded successfully');
      return true;
    } catch (err) {
      console.warn('[EmbeddingService] Failed to load ONNX model, semantic scoring disabled:', 
        err instanceof Error ? err.message : err);
      this.ready = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async computeSimilarity(text1: string, text2: string): Promise<number> {
    if (!this.ready) {
      return 0;
    }

    const [emb1, emb2] = await Promise.all([
      this.computeEmbedding(text1),
      this.computeEmbedding(text2),
    ]);

    return cosineSimilarity(emb1, emb2);
  }

  async computeEmbedding(text: string): Promise<Float32Array> {
    if (!this.ready || !this.session || !this.ort) {
      throw new Error('Embedding service not initialized');
    }

    const ort = this.ort;
    
    // Tokenize the input
    const tokens = this.tokenizer.encode(text);
    const maxLength = 128;
    const paddedTokens = tokens.slice(0, maxLength);
    while (paddedTokens.length < maxLength) {
      paddedTokens.push(0); // Padding token
    }

    // Create input tensors
    const inputIds = new ort.Tensor('int64', BigInt64Array.from(paddedTokens.map(BigInt)), [1, maxLength]);
    const attentionMask = new ort.Tensor('int64', BigInt64Array.from(paddedTokens.map(t => BigInt(t > 0 ? 1 : 0))), [1, maxLength]);
    const tokenTypeIds = new ort.Tensor('int64', new BigInt64Array(maxLength).fill(0n), [1, maxLength]);

    // Run inference
    const results = await this.session.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds,
    });

    // Get the sentence embedding (mean pooling over token embeddings)
    const lastHiddenState = results['last_hidden_state'] ?? results['output_0'];
    if (!lastHiddenState) {
      throw new Error('Model output not found');
    }

    const data = lastHiddenState.data as Float32Array;
    const hiddenSize = 384;
    const embedding = new Float32Array(hiddenSize);

    // Mean pooling
    let validTokens = 0;
    for (let i = 0; i < maxLength; i++) {
      if (paddedTokens[i] > 0) {
        validTokens++;
        for (let j = 0; j < hiddenSize; j++) {
          embedding[j] += data[i * hiddenSize + j];
        }
      }
    }
    if (validTokens > 0) {
      for (let j = 0; j < hiddenSize; j++) {
        embedding[j] /= validTokens;
      }
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.ready = false;
  }
}

/**
 * Simple whitespace tokenizer.
 * In production, you'd use the actual model's tokenizer (e.g., from tokenizers library).
 * This is a simplified version for basic functionality.
 */
class SimpleTokenizer {
  private vocab: Map<string, number> = new Map();
  private unkTokenId = 100;
  private clsTokenId = 101;
  private sepTokenId = 102;

  constructor() {
    // Build a basic vocab from common words
    // In production, load the actual vocab.txt from the model
    this.vocab.set('[PAD]', 0);
    this.vocab.set('[UNK]', 100);
    this.vocab.set('[CLS]', 101);
    this.vocab.set('[SEP]', 102);
    
    // Add basic ASCII characters and common words
    let id = 1000;
    for (let i = 97; i <= 122; i++) {
      this.vocab.set(String.fromCharCode(i), id++);
    }
  }

  encode(text: string): number[] {
    const tokens: number[] = [this.clsTokenId];
    
    // Simple word-level tokenization
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    for (const word of words) {
      // Character-level fallback for unknown words
      for (const char of word) {
        const tokenId = this.vocab.get(char) ?? this.unkTokenId;
        tokens.push(tokenId);
      }
      tokens.push(this.vocab.get(' ') ?? this.unkTokenId);
    }
    
    tokens.push(this.sepTokenId);
    return tokens;
  }
}

/**
 * Factory function to create the appropriate embedding service.
 * Uses ONNX if available, falls back to mock for development.
 */
export async function createEmbeddingService(
  options: EmbeddingServiceOptions = {}
): Promise<EmbeddingService> {
  if (options.enabled === false) {
    console.log('[EmbeddingService] Disabled, using mock service');
    return new MockEmbeddingService();
  }

  const onnxService = new OnnxEmbeddingService(options);
  const initialized = await onnxService.initialize();
  
  if (initialized) {
    return onnxService;
  }
  
  console.log('[EmbeddingService] Falling back to mock service');
  return new MockEmbeddingService();
}
