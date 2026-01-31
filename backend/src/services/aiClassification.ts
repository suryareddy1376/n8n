import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { AIClassificationResult, UrgencyLevel } from '../types/index.js';
import { AIServiceError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../utils/supabase.js';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);

// Department mappings for AI output normalization
const DEPARTMENT_MAPPINGS: Record<string, string> = {
  water: 'WATER',
  'water supply': 'WATER',
  'water leak': 'WATER',
  'water contamination': 'WATER',
  electricity: 'ELECTRICITY',
  power: 'ELECTRICITY',
  'power outage': 'ELECTRICITY',
  'street light': 'ELECTRICITY',
  electrical: 'ELECTRICITY',
  sanitation: 'SANITATION',
  garbage: 'SANITATION',
  waste: 'SANITATION',
  sewage: 'SANITATION',
  cleaning: 'SANITATION',
  safety: 'SAFETY',
  'public safety': 'SAFETY',
  accident: 'SAFETY',
  hazard: 'SAFETY',
  emergency: 'SAFETY',
  road: 'ROADS',
  roads: 'ROADS',
  pothole: 'ROADS',
  infrastructure: 'ROADS',
  traffic: 'ROADS',
  other: 'OTHER',
  general: 'OTHER',
};

// The AI Classification Prompt - Strict JSON output
const CLASSIFICATION_PROMPT = `You are an AI assistant for a government Digital Complaint Management System. Your task is to analyze citizen complaints and classify them accurately.

IMPORTANT RULES:
1. Output ONLY valid JSON - no markdown, no explanations outside JSON
2. Use ONLY the exact department codes provided
3. Confidence score must be between 0.0 and 1.0
4. Be conservative with confidence - if uncertain, use lower confidence

DEPARTMENT CODES (use exactly as shown):
- WATER: Water supply issues, leaks, contamination, water quality, pipe bursts
- ELECTRICITY: Power outages, electrical hazards, street lights, transformers
- SANITATION: Garbage collection, sewage, public cleanliness, waste management
- SAFETY: Road hazards, public safety concerns, accidents, dangerous conditions
- ROADS: Potholes, road damage, traffic signals, infrastructure problems
- OTHER: General complaints not fitting other categories

URGENCY LEVELS:
- critical: Immediate danger to life, health emergency, major infrastructure failure
- high: Significant inconvenience, affects many people, time-sensitive
- normal: Standard complaint, no immediate urgency

ANALYZE THE FOLLOWING COMPLAINT:
---
{{COMPLAINT_TEXT}}
---
{{LOCATION_CONTEXT}}
{{IMAGE_CONTEXT}}

OUTPUT FORMAT (strict JSON only):
{
  "department": "Department name (e.g., Water Supply)",
  "department_code": "DEPARTMENT_CODE",
  "urgency": "normal|high|critical",
  "confidence": 0.XX,
  "reasoning": "Brief explanation (max 200 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "suggested_priority": X
}

RESPOND WITH JSON ONLY:`;

// Build the classification prompt with context
const buildPrompt = (
  description: string,
  locationAddress?: string,
  imageAnalysis?: string
): string => {
  let prompt = CLASSIFICATION_PROMPT.replace('{{COMPLAINT_TEXT}}', description);

  if (locationAddress) {
    prompt = prompt.replace(
      '{{LOCATION_CONTEXT}}',
      `LOCATION: ${locationAddress}`
    );
  } else {
    prompt = prompt.replace('{{LOCATION_CONTEXT}}', '');
  }

  if (imageAnalysis) {
    prompt = prompt.replace(
      '{{IMAGE_CONTEXT}}',
      `IMAGE ANALYSIS: ${imageAnalysis}`
    );
  } else {
    prompt = prompt.replace('{{IMAGE_CONTEXT}}', '');
  }

  return prompt;
};

// Parse and validate AI response
const parseAIResponse = (response: string): AIClassificationResult => {
  try {
    // Clean the response - remove any markdown formatting
    let cleanResponse = response.trim();
    
    // Remove markdown code blocks if present
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.slice(7);
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.slice(3);
    }
    
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3);
    }

    cleanResponse = cleanResponse.trim();

    // Parse JSON
    const parsed = JSON.parse(cleanResponse);

    // Validate required fields
    if (!parsed.department_code || !parsed.urgency || parsed.confidence === undefined) {
      throw new Error('Missing required fields in AI response');
    }

    // Normalize department code
    let departmentCode = parsed.department_code.toUpperCase();
    if (!['WATER', 'ELECTRICITY', 'SANITATION', 'SAFETY', 'ROADS', 'OTHER'].includes(departmentCode)) {
      // Try to map from department name
      const normalizedDept = DEPARTMENT_MAPPINGS[parsed.department?.toLowerCase()] || 'OTHER';
      departmentCode = normalizedDept;
    }

    // Validate and normalize urgency
    let urgency: UrgencyLevel = 'normal';
    if (['critical', 'high', 'normal'].includes(parsed.urgency?.toLowerCase())) {
      urgency = parsed.urgency.toLowerCase() as UrgencyLevel;
    }

    // Validate confidence score
    let confidence = parseFloat(parsed.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.5; // Default to medium confidence if invalid
    }

    return {
      department: parsed.department || departmentCode,
      department_code: departmentCode,
      urgency,
      confidence: Math.round(confidence * 100) / 100,
      reasoning: (parsed.reasoning || 'Classification completed').substring(0, 500),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
      suggested_priority: parsed.suggested_priority || 50,
    };
  } catch (error) {
    logger.error('Failed to parse AI response:', { response, error });
    throw new AIServiceError('Failed to parse AI classification response');
  }
};

// Main classification function
export const classifyComplaint = async (
  description: string,
  locationAddress?: string,
  imageAnalysis?: string
): Promise<AIClassificationResult> => {
  const startTime = Date.now();

  try {
    logger.info('Starting AI classification', {
      descriptionLength: description.length,
      hasLocation: !!locationAddress,
      hasImage: !!imageAnalysis,
    });

    // Build prompt
    const prompt = buildPrompt(description, locationAddress, imageAnalysis);

    // Call Gemini API
    const model = genAI.getGenerativeModel({ 
      model: config.ai.geminiModel,
      generationConfig: {
        temperature: 0.1, // Low temperature for more deterministic output
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 500,
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new AIServiceError('Empty response from AI model');
    }

    // Parse response
    const classification = parseAIResponse(text);

    const duration = Date.now() - startTime;
    logger.info('AI classification completed', {
      department: classification.department_code,
      urgency: classification.urgency,
      confidence: classification.confidence,
      duration: `${duration}ms`,
    });

    return classification;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('AI classification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    });

    if (error instanceof AIServiceError) {
      throw error;
    }

    throw new AIServiceError(
      error instanceof Error ? error.message : 'Classification failed'
    );
  }
};

// Get department ID from code
export const getDepartmentByCode = async (
  code: string
): Promise<{ id: string; sla_hours: number } | null> => {
  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('id, sla_hours')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    logger.warn('Department not found for code:', { code });
    return null;
  }

  return data;
};

// Check if location is in critical area
export const checkCriticalArea = async (
  lat: number,
  lng: number
): Promise<boolean> => {
  const { data, error } = await supabaseAdmin
    .from('critical_areas')
    .select('id')
    .eq('is_active', true)
    .gte('lat_max', lat)
    .lte('lat_min', lat)
    .gte('lng_max', lng)
    .lte('lng_min', lng)
    .limit(1);

  if (error) {
    logger.error('Error checking critical area:', error);
    return false;
  }

  return data && data.length > 0;
};

// Full classification pipeline
export const classifyAndProcessComplaint = async (
  complaintId: string,
  description: string,
  locationLat?: number,
  locationLng?: number,
  locationAddress?: string
): Promise<{
  classification: AIClassificationResult;
  departmentId: string | null;
  isCriticalArea: boolean;
  isAutoApproved: boolean;
  slaDeadline: Date | null;
}> => {
  // Classify complaint
  const classification = await classifyComplaint(description, locationAddress);

  // Get department
  const department = await getDepartmentByCode(classification.department_code);

  // Check critical area
  let isCriticalArea = false;
  if (locationLat && locationLng) {
    isCriticalArea = await checkCriticalArea(locationLat, locationLng);
  }

  // Determine auto-approval
  const isAutoApproved = classification.confidence >= config.ai.confidenceThreshold;

  // Calculate SLA deadline
  let slaDeadline: Date | null = null;
  if (department) {
    const urgencyMultipliers: Record<UrgencyLevel, number> = {
      critical: 0.25,
      high: 0.5,
      normal: 1.0,
    };
    const multiplier = urgencyMultipliers[classification.urgency];
    const slaHours = department.sla_hours * multiplier;
    slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + slaHours);
  }

  logger.info('Complaint processed', {
    complaintId,
    departmentCode: classification.department_code,
    departmentId: department?.id,
    confidence: classification.confidence,
    isAutoApproved,
    isCriticalArea,
  });

  return {
    classification,
    departmentId: department?.id || null,
    isCriticalArea,
    isAutoApproved,
    slaDeadline,
  };
};

export default {
  classifyComplaint,
  classifyAndProcessComplaint,
  getDepartmentByCode,
  checkCriticalArea,
};
