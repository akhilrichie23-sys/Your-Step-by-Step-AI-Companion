import { describe, it, expect } from 'vitest';
import { analyzeWithGuider } from '../services/aiService';
import { TRANSLATIONS } from '../data/translations';
import { CATEGORIES } from '../data/initialTasks';

describe('GUIDER AI Service & System Consistency', () => {
  it('should provide categories for maker projects', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
    expect(CATEGORIES).toContain('Crafts & DIY');
  });

  it('should provide translations for all supported languages', () => {
    expect(TRANSLATIONS).toHaveProperty('en');
    expect(TRANSLATIONS).toHaveProperty('es');
    expect(TRANSLATIONS).toHaveProperty('fr');
    expect(TRANSLATIONS.en.tagline).toBeDefined();
    expect(TRANSLATIONS.es.tagline).toBeDefined();
    expect(TRANSLATIONS.fr.tagline).toBeDefined();
  });

  it('should deliver structured single-step assessment via local reasoning engine', async () => {
    const task = {
      title: 'Handmade Craft',
      goal: 'Build custom project',
      category: 'Crafts & DIY',
      currentStepNum: 1,
      totalSteps: 5,
      completedSteps: 0,
      history: []
    };
    const result = await analyzeWithGuider({
      prompt: "Here is my starting setup.",
      image: null,
      task,
      apiKey: '',
      safetyEnabled: true
    });

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('step');
    expect(result).toHaveProperty('why');
    expect(result).toHaveProperty('promptForPhoto');
    expect(typeof result.step).toBe('string');
  });

  it('should adapt specifically when user asks why', async () => {
    const task = {
      title: 'Circuit Project',
      goal: 'Assemble PCB',
      category: 'Robotics & Electronics',
      currentStepNum: 2,
      totalSteps: 5,
      completedSteps: 1,
      history: []
    };
    const result = await analyzeWithGuider({
      prompt: "Why do I need to heat the soldering pad first?",
      image: null,
      task,
      apiKey: '',
      safetyEnabled: true
    });

    expect(result.why).toBeDefined();
    expect(result.status.toLowerCase()).toContain('explaining');
  });

  it('should trigger troubleshooting logic on reported issues', async () => {
    const task = {
      title: 'Model Building',
      goal: 'Assemble frame',
      category: 'Woodworking',
      currentStepNum: 3,
      totalSteps: 5,
      completedSteps: 2,
      history: []
    };
    const result = await analyzeWithGuider({
      prompt: "I am stuck, the edges do not line up.",
      image: null,
      task,
      apiKey: '',
      safetyEnabled: true
    });

    expect(result.status.toLowerCase()).toContain('troubleshooting');
  });
});
