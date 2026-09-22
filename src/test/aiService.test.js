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
    const supported = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'hi'];
    supported.forEach(code => {
      expect(TRANSLATIONS).toHaveProperty(code);
      expect(TRANSLATIONS[code].tagline).toBeDefined();
      expect(TRANSLATIONS[code].heroTitle).toBeDefined();
      expect(TRANSLATIONS[code].nextStep).toBeDefined();
    });
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

  it('should guide through ironing when paper is rough', async () => {
    const task = {
      title: 'Handmade Paper Project',
      goal: 'Create smooth handmade paper',
      category: 'Origami & Papercraft',
      currentStepNum: 4,
      totalSteps: 5,
      completedSteps: 3,
      history: []
    };
    const result = await analyzeWithGuider({
      prompt: "The paper is rough so we ironed the paper.",
      image: null,
      task,
      apiKey: '',
      safetyEnabled: true
    });

    expect(result.step.toLowerCase()).toContain('iron');
    expect(result.why.toLowerCase()).toContain('fiber');
    expect(result.safety).toBeDefined();
  });

  it('should respond conversationally when user is just chatting or saying hello', async () => {
    const task = {
      title: 'General Project',
      goal: 'Explore making',
      category: 'General',
      currentStepNum: 1,
      totalSteps: 5,
      completedSteps: 0,
      history: []
    };
    const result = await analyzeWithGuider({
      prompt: "Hello! How are you doing today?",
      image: null,
      task,
      apiKey: '',
      safetyEnabled: true
    });

    expect(result.isChat).toBe(true);
    expect(result.text).toBeDefined();
    expect(result.step).toBeUndefined();
  });

  it('should activate step-by-step helping when user asks a specific query or guidance', async () => {
    const task = {
      title: 'Paper Craft Project',
      goal: 'Make handmade recycled paper',
      category: 'Origami & Papercraft',
      currentStepNum: 1,
      totalSteps: 5,
      completedSteps: 0,
      history: []
    };
    const result = await analyzeWithGuider({
      prompt: "How do I start? What is my first step?",
      image: null,
      task,
      apiKey: '',
      safetyEnabled: true
    });

    expect(result.isChat).toBe(false);
    expect(result.step).toBeDefined();
    expect(result.why).toBeDefined();
  });
});
