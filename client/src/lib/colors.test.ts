import { describe, it, expect } from 'vitest';
import { getScoreChipColors, tokens } from './colors';

describe('getScoreChipColors', () => {
  it('returns success colors for score 5', () => {
    expect(getScoreChipColors(5)).toEqual({ bg: tokens.successSoft, text: tokens.success });
  });

  it('returns info colors for score 4', () => {
    expect(getScoreChipColors(4)).toEqual({ bg: tokens.infoSoft, text: tokens.info });
  });

  it('returns warning colors for score 3', () => {
    expect(getScoreChipColors(3)).toEqual({ bg: tokens.warningSoft, text: tokens.warning });
  });

  it('returns warning colors for score 2', () => {
    expect(getScoreChipColors(2)).toEqual({ bg: tokens.warningSoft, text: tokens.warning });
  });

  it('returns danger colors for score 1', () => {
    expect(getScoreChipColors(1)).toEqual({ bg: tokens.dangerSoft, text: tokens.danger });
  });

  it('returns danger colors for score 0', () => {
    expect(getScoreChipColors(0)).toEqual({ bg: tokens.dangerSoft, text: tokens.danger });
  });

  it('returns danger colors for negative score', () => {
    expect(getScoreChipColors(-1)).toEqual({ bg: tokens.dangerSoft, text: tokens.danger });
  });
});
