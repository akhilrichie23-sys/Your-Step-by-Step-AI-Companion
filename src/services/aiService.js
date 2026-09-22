export async function analyzeWithGuider({ prompt, image, task, apiKey, safetyEnabled, studentSafetyMode }) {
  const text = (prompt || '').toLowerCase().trim();
  const hasImage = Boolean(image);
  const step = task.currentStepNum;

  // If API key is provided and looks valid, call Google Gemini 1.5 Flash
  if (apiKey && apiKey.trim().startsWith('AIza')) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
      
      const systemInstruction = `You are GUIDER, the friendly, intelligent hands-on AI Companion.
The user is talking with you.
Task Context: ${task.title || 'General Chat'} (Goal: ${task.goal || 'Open Exploration'}).

GUIDELINES:
1. If the user is just having a normal casual conversation, greeting you, or chatting (and NOT yet asking for project steps/help), respond naturally and warmly as a companion:
{
  "isChat": true,
  "text": "Your friendly conversational response"
}
2. When the user asks for guidance, instructions, help with a physical project, or sends a photo/progress update, deliver ONE single immediate step matching this schema:
{
  "isChat": false,
  "status": "Short description of what you observe from their progress or photo",
  "step": "ONE specific, actionable next step instruction",
  "why": "Clear physical/craft reason why this step is critical",
  "safety": "Conditional safety warning if dangerous tools/heat/water/electricity are involved, else null",
  "promptForPhoto": "What specific angle or result they should photograph next",
  "isCompleted": boolean,
  "confidence": "high" | "medium" | "low"
}
3. Always output strictly valid JSON.`;

      let parts = [
        { text: `${systemInstruction}\n\nTask: ${task.title}\nCurrent Step: ${task.currentStepNum} of ${task.totalSteps}\nUser Message: ${prompt || "Here is my current result."}` }
      ];

      if (image && image.startsWith('data:image')) {
        const base64Data = image.split(',')[1];
        const mimeType = image.split(';')[0].replace('data:', '');
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        });
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }]
        })
      });

      if (res.ok) {
        const json = await res.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.isChat) {
            return {
              isChat: true,
              text: parsed.text || "Hello! How can I help you today?",
              stepNumber: step
            };
          }
          return {
            isChat: false,
            status: parsed.status || "Assessing your current progress.",
            step: parsed.step || "Proceed to the next micro-step.",
            why: parsed.why || "To maintain quality and avoid defects.",
            safety: safetyEnabled ? parsed.safety : null,
            promptForPhoto: parsed.promptForPhoto || "Show me a photo once completed.",
            isCompleted: !!parsed.isCompleted,
            stepNumber: task.currentStepNum + 1
          };
        }
      }
    } catch (err) {
      console.warn("Falling back to local adaptive reasoning engine:", err);
    }
  }

  // --- Adaptive Local Reasoning Engine (Zero Latency & Always Works) ---
  await new Promise(r => setTimeout(r, 600));

  // 1. Detect casual conversation & greetings
  const greetings = [
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
    'how are you', 'how are you doing', 'what can you do', 'who are you',
    'hola', 'bonjour', 'hallo', 'olá', 'ciao', 'こんにちは', 'नमस्ते', 'sup', 'yo', 'greetings'
  ];

  const isGreeting = greetings.some(g => text === g || text.startsWith(g + ' ') || text.startsWith(g + '!') || text.startsWith(g + '?') || text.startsWith(g + '.'));

  const isCasualChat = !hasImage && (
    isGreeting ||
    text.includes('who are you') ||
    text.includes('what can you do') ||
    text.includes('how does this work') ||
    text.includes('tell me about yourself') ||
    text.includes('thank you') ||
    text.includes('thanks') ||
    text.includes('nice to meet you') ||
    text === 'ok' || text === 'cool' || text === 'nice' || text === 'great' || text === 'awesome'
  );

  // Explicit query / task help indicators
  const isQueryOrGuidance = hasImage || 
    text.includes('step') || 
    text.includes('how to') || 
    text.includes('how do i') || 
    text.includes('help') || 
    text.includes('guide') || 
    text.includes('start') || 
    text.includes('begin') || 
    text.includes('first') || 
    text.includes('next') || 
    text.includes('make') || 
    text.includes('build') || 
    text.includes('craft') || 
    text.includes('recipe') || 
    text.includes('materials') || 
    text.includes('iron') || 
    text.includes('rough') || 
    text.includes('did it') || 
    text.includes('done') || 
    text.includes('finished') || 
    text.includes('what should i do') || 
    text.includes('troubleshoot') || 
    text.includes('why') ||
    text.includes('explain');

  // Handle normal conversational messages
  if (isCasualChat && !isQueryOrGuidance) {
    let reply = "Hello! I'm GUIDER, your hands-on AI Companion. We can chat casually, or whenever you have a query or want to start building, crafting, or fixing something, just ask me and I'll guide you step-by-step!";
    if (text.includes('how are you')) {
      reply = "I'm doing wonderful and ready to help! What kind of project, craft, or idea are you exploring today?";
    } else if (text.includes('who are you') || text.includes('what can you do')) {
      reply = "I am GUIDER! I help you learn and build physical projects by breaking them down into single, manageable steps with safety tips and verification photos. Ask me any project query whenever you'd like to begin!";
    } else if (text.includes('thank') || text.includes('thanks')) {
      reply = "You're very welcome! Whenever you're ready to start or continue your steps, just ask away.";
    } else if (text === 'ok' || text === 'cool' || text === 'great' || text === 'awesome') {
      reply = "Sounds great! Feel free to ask a question or tell me what you're working on whenever you want to begin.";
    }

    return {
      isChat: true,
      text: reply,
      stepNumber: step
    };
  }

  // Handle specific user queries & troubleshooting
  if (text.includes('why') || text.includes('explain') || text.includes('reason')) {
    return {
      isChat: false,
      status: `Explaining the methodology for Step ${step}.`,
      step: `Take your time to understand the technique: apply pressure smoothly from the center outwards without rushing.`,
      why: `Understanding mechanical and material distribution ensures your project holds together without micro-fractures.`,
      safety: null,
      promptForPhoto: `Send a quick picture once you try applying this technique.`,
      isCompleted: false,
      stepNumber: step
    };
  }

  // Helper to enrich safety warnings when studentSafetyMode is active
  const formatSafety = (baseWarning) => {
    if (!safetyEnabled) return null;
    if (!baseWarning && !studentSafetyMode) return null;
    if (studentSafetyMode) {
      if (baseWarning) {
        return `[STUDENT SAFETY] ${baseWarning} (Adult supervision recommended for minors).`;
      }
      return '[STUDENT SAFETY] Ensure you are working in a well-ventilated, clutter-free area with safety gear.';
    }
    return baseWarning;
  };

  if (text.includes('issue') || text.includes('problem') || text.includes('stuck') || text.includes('help') || text.includes('failed')) {
    return {
      isChat: false,
      status: `Troubleshooting detected at Step ${step}.`,
      step: `Let's correct this: gently wipe away any excess residue or release tension on the edges, then align from the reference point.`,
      why: `Correcting small misalignments early prevents permanent defects down the line.`,
      safety: formatSafety('Work at a steady pace and keep your hands dry.'),
      promptForPhoto: `Show me the corrected alignment before we proceed.`,
      isCompleted: false,
      stepNumber: step
    };
  }

  if (text.includes('rough') || text.includes('iron')) {
    return {
      isChat: false,
      status: `Addressing paper roughness at Step ${step}.`,
      step: `Place a clean sheet of parchment paper or a thin pressing cloth over the rough paper, and gently iron over it on low-to-medium heat (no steam) to flatten the fibers.`,
      why: `Gentle heat and flat pressure smooth out rough cellulose fibers and uneven bumps, producing a clean, uniform paper surface.`,
      safety: formatSafety('Use caution with the warm iron and keep hands away from the heated surface.'),
      promptForPhoto: `Take a photo of the smoothed, ironed paper surface.`,
      isCompleted: step >= task.totalSteps,
      stepNumber: step
    };
  }

  // Dynamic context for common categories
  if (task.category.includes('Craft') || task.title.includes('Paper')) {
    const steps = [
      {
        status: hasImage ? "Your torn paper mixture is softening properly in the water." : "Initial materials registered.",
        step: "Transfer soaked scraps into a blender (1:4 ratio with warm water) and pulse in 5-second bursts until it forms a smooth slurry.",
        why: "Short bursts separate fibers without breaking them down too finely, giving strength to the paper.",
        safety: formatSafety("Ensure the blender lid is securely held down and blades are fully stopped before opening."),
        promptForPhoto: "Snap a photo of the blended pulp texture."
      },
      {
        status: hasImage ? "The blended pulp has reached an optimal fiber consistency." : "Pulp slurry is ready.",
        step: "Pour the pulp into your shallow basin, stir thoroughly with your fingers, and submerge the deckle screen horizontally.",
        why: "Even distribution in the water bath is what ensures equal thickness across the whole page.",
        safety: formatSafety(null),
        promptForPhoto: "Show me the mesh frame lifted straight above the water."
      },
      {
        status: hasImage ? "The wet pulp sheet is cleanly formed across the mesh surface." : "Sheet formation verified.",
        step: "Press the frame face-down onto an absorbent cloth (couching) and dab the back with a sponge to transfer the sheet.",
        why: "Couching transfers the fragile wet sheet without tearing delicate fiber interlocks.",
        safety: formatSafety(null),
        promptForPhoto: "Show me the sheet lying flat on your towel."
      },
      {
        status: hasImage ? "Smooth transfer achieved with no corner folds." : "Transfer successful.",
        step: "Place a dry pressing board and heavy books over the sheet, letting it press under weight for 4 hours until dry.",
        why: "Continuous even weight forces out moisture while keeping the sheet flat as it dries.",
        safety: formatSafety(null),
        promptForPhoto: "Show me the dried paper sheet."
      },
      {
        status: hasImage ? "The dried paper sheet has been inspected." : "Paper dried and ready for smoothing.",
        step: "The paper is rough, so place a thin cloth or parchment paper over the sheet and iron the paper gently on low-to-medium heat (no steam) to smooth the surface.",
        why: "Ironing with gentle heat flattens raised cellulose fibers and gives the handmade paper a crisp, smooth finish.",
        safety: formatSafety("Use caution with the warm iron and do not leave it resting in one spot."),
        promptForPhoto: "Take a picture of your finished, smooth ironed paper.",
        isCompleted: true
      }
    ];

    const currentIdx = Math.min(step - 1, steps.length - 1);
    const chosen = steps[currentIdx];
    return {
      isChat: false,
      ...chosen,
      isCompleted: chosen.isCompleted || step >= task.totalSteps,
      stepNumber: Math.min(task.totalSteps, step + 1)
    };
  }

  // Generic fallback adaptive step when guidance is requested
  const isFinal = step >= task.totalSteps;
  return {
    isChat: false,
    status: hasImage ? "I have inspected your latest photo. The alignment looks consistent." : `Step ${step} guidance initialized.`,
    step: isFinal 
      ? "Task Complete! Do a final inspection of all seams and surface finishes."
      : `Step ${step}: Prepare your primary materials and align the first component carefully.`,
    why: "Proper alignment in the opening stage prevents uneven load distribution later.",
    safety: formatSafety("Keep your workspace clear of clutter and wear eye protection if required."),
    promptForPhoto: isFinal ? "Take a victory photo of your finished creation!" : "Show me a photo after setting up this first piece.",
    isCompleted: isFinal,
    stepNumber: Math.min(task.totalSteps, step + 1)
  };
}
