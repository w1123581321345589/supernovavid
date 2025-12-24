// Statistical confidence calculator for A/B testing
// Uses two-proportion z-test for comparing CTR variants

interface VariantStats {
  impressions: number;
  clicks: number;
  ctr: number;
}

interface ConfidenceResult {
  isSignificant: boolean;
  confidence: number;
  pValue: number;
  zScore: number;
  winnerId: string | null;
  minimumSampleMet: boolean;
  sampleSizeNeeded: number;
}

class StatisticsService {
  private readonly MIN_IMPRESSIONS_PER_VARIANT = 500;
  private readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.95;

  // Calculate z-score for two-proportion test
  private calculateZScore(
    p1: number, n1: number,  // Control/variant A
    p2: number, n2: number   // Treatment/variant B
  ): number {
    if (n1 === 0 || n2 === 0) return 0;
    
    // Pooled proportion
    const p = (p1 * n1 + p2 * n2) / (n1 + n2);
    
    // Standard error
    const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
    
    if (se === 0) return 0;
    
    // Z-score
    return (p1 - p2) / se;
  }

  // Convert z-score to p-value (two-tailed)
  private zScoreToPValue(z: number): number {
    const absZ = Math.abs(z);
    
    // Approximation of the cumulative normal distribution
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = z < 0 ? -1 : 1;
    const x = absZ / Math.sqrt(2);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    const cdf = 0.5 * (1.0 + sign * y);
    
    // Two-tailed p-value
    return 2 * (1 - cdf);
  }

  // Calculate minimum sample size needed for 95% confidence
  calculateMinimumSampleSize(
    baselineCtr: number,
    minimumDetectableEffect: number = 0.1 // 10% relative improvement
  ): number {
    const alpha = 0.05; // 95% confidence
    const beta = 0.2;   // 80% power
    
    const p1 = baselineCtr;
    const p2 = baselineCtr * (1 + minimumDetectableEffect);
    
    // Z-scores for alpha and beta
    const zAlpha = 1.96;
    const zBeta = 0.84;
    
    const p = (p1 + p2) / 2;
    const effect = Math.abs(p2 - p1);
    
    if (effect === 0) return Infinity;
    
    const numerator = 2 * p * (1 - p) * Math.pow(zAlpha + zBeta, 2);
    const denominator = Math.pow(effect, 2);
    
    return Math.ceil(numerator / denominator);
  }

  // Compare two variants and determine statistical significance
  compareVariants(
    variantA: VariantStats & { id?: string },
    variantB: VariantStats & { id?: string },
    confidenceThreshold: number = this.DEFAULT_CONFIDENCE_THRESHOLD
  ): ConfidenceResult & { winnerPosition: 'A' | 'B' | null } {
    const minSampleMet = 
      variantA.impressions >= this.MIN_IMPRESSIONS_PER_VARIANT &&
      variantB.impressions >= this.MIN_IMPRESSIONS_PER_VARIANT;

    // Convert CTR from percentage to proportion
    const p1 = variantA.ctr / 100;
    const p2 = variantB.ctr / 100;
    
    const zScore = this.calculateZScore(
      p1, variantA.impressions,
      p2, variantB.impressions
    );
    
    const pValue = this.zScoreToPValue(zScore);
    const confidence = 1 - pValue;
    const isSignificant = confidence >= confidenceThreshold && minSampleMet;
    
    let winnerId: string | null = null;
    let winnerPosition: 'A' | 'B' | null = null;
    
    if (isSignificant) {
      // The variant with higher CTR wins - return actual ID
      if (p1 > p2) {
        winnerId = variantA.id || null;
        winnerPosition = 'A';
      } else {
        winnerId = variantB.id || null;
        winnerPosition = 'B';
      }
    }

    // Calculate sample size needed for baseline CTR
    const baselineCtr = Math.max(p1, p2) || 0.05;
    const sampleSizeNeeded = this.calculateMinimumSampleSize(baselineCtr);

    return {
      isSignificant,
      confidence,
      pValue,
      zScore,
      winnerId,
      winnerPosition,
      minimumSampleMet: minSampleMet,
      sampleSizeNeeded,
    };
  }

  // Multi-variant comparison - find the best among multiple variants
  findWinner(
    variants: Array<VariantStats & { id: string }>,
    confidenceThreshold: number = this.DEFAULT_CONFIDENCE_THRESHOLD
  ): {
    winnerId: string | null;
    confidence: number;
    isSignificant: boolean;
    pValue: number;
    zScore: number;
    comparisons: Array<{ variantA: string; variantB: string; result: ConfidenceResult }>;
  } {
    if (variants.length < 2) {
      return {
        winnerId: variants[0]?.id || null,
        confidence: 0,
        isSignificant: false,
        pValue: 1,
        zScore: 0,
        comparisons: [],
      };
    }

    // Sort by CTR descending
    const sorted = [...variants].sort((a, b) => b.ctr - a.ctr);
    const topVariant = sorted[0];
    const comparisons: Array<{ variantA: string; variantB: string; result: ConfidenceResult }> = [];
    
    let isWinnerSignificant = true;
    let lowestConfidence = 1;
    let highestPValue = 0;
    let overallZScore = 0;

    // Compare top variant against all others
    for (let i = 1; i < sorted.length; i++) {
      const result = this.compareVariants(topVariant, sorted[i], confidenceThreshold);
      comparisons.push({
        variantA: topVariant.id,
        variantB: sorted[i].id,
        result,
      });

      // Winner must be significantly better than ALL other variants
      // Use winnerPosition to check if variant A (top variant) won
      if (!result.isSignificant || result.winnerPosition !== 'A') {
        isWinnerSignificant = false;
      }
      lowestConfidence = Math.min(lowestConfidence, result.confidence);
      highestPValue = Math.max(highestPValue, result.pValue);
      overallZScore = Math.min(overallZScore, Math.abs(result.zScore));
    }

    return {
      winnerId: isWinnerSignificant ? topVariant.id : null,
      confidence: lowestConfidence,
      isSignificant: isWinnerSignificant,
      pValue: highestPValue,
      zScore: overallZScore,
      comparisons,
    };
  }

  // Calculate CTR improvement percentage
  calculateImprovement(originalCtr: number, newCtr: number): number {
    if (originalCtr === 0) return newCtr > 0 ? 100 : 0;
    return ((newCtr - originalCtr) / originalCtr) * 100;
  }

  // Estimate time to reach significance based on current impression rate
  estimateTimeToSignificance(
    currentImpressions: number,
    hoursElapsed: number,
    sampleSizeNeeded: number
  ): number {
    if (hoursElapsed === 0 || currentImpressions === 0) return Infinity;
    
    const impressionsPerHour = currentImpressions / hoursElapsed;
    const impressionsNeeded = Math.max(0, sampleSizeNeeded - currentImpressions);
    
    return impressionsNeeded / impressionsPerHour;
  }
}

export const statisticsService = new StatisticsService();
