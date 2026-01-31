import { UrgencyLevel } from '../types/index.js';

// Priority Score Calculation
// Priority Score = (weight_urgency * urgency_value) + (weight_time * hours_open) + (weight_location * critical_area_flag)

export interface PriorityWeights {
  urgency: number;
  time: number;
  location: number;
}

export const DEFAULT_WEIGHTS: PriorityWeights = {
  urgency: 40,
  time: 35,
  location: 25,
};

export const URGENCY_VALUES: Record<UrgencyLevel, number> = {
  critical: 1.0,
  high: 0.7,
  normal: 0.3,
};

export const calculatePriorityScore = (
  urgency: UrgencyLevel,
  createdAt: Date,
  isCriticalArea: boolean,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): number => {
  const urgencyValue = URGENCY_VALUES[urgency];
  
  // Calculate hours open (max normalized at 168 hours = 1 week)
  const hoursOpen = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const timeValue = Math.min(hoursOpen / 168, 1.0);
  
  // Location value
  const locationValue = isCriticalArea ? 1.0 : 0.0;
  
  // Calculate weighted score
  const score =
    weights.urgency * urgencyValue +
    weights.time * timeValue +
    weights.location * locationValue;
  
  return Math.round(score * 100) / 100;
};

// SLA Deadline Calculation
export const calculateSLADeadline = (
  baseSLAHours: number,
  urgency: UrgencyLevel,
  createdAt: Date
): Date => {
  const urgencyMultipliers: Record<UrgencyLevel, number> = {
    critical: 0.25, // 25% of normal time
    high: 0.5,      // 50% of normal time
    normal: 1.0,
  };
  
  const multiplier = urgencyMultipliers[urgency];
  const slaHours = baseSLAHours * multiplier;
  
  const deadline = new Date(createdAt);
  deadline.setHours(deadline.getHours() + slaHours);
  
  return deadline;
};

// Check if SLA is breached
export const isSLABreached = (slaDeadline: Date): boolean => {
  return new Date() > slaDeadline;
};

// Calculate time remaining until SLA deadline
export const getSLATimeRemaining = (slaDeadline: Date): {
  isBreached: boolean;
  hoursRemaining: number;
  formattedTime: string;
} => {
  const now = new Date();
  const diff = slaDeadline.getTime() - now.getTime();
  const hoursRemaining = diff / (1000 * 60 * 60);
  const isBreached = diff < 0;
  
  const absHours = Math.abs(hoursRemaining);
  const days = Math.floor(absHours / 24);
  const hours = Math.floor(absHours % 24);
  const minutes = Math.floor((absHours * 60) % 60);
  
  let formattedTime = '';
  if (days > 0) {
    formattedTime = `${days}d ${hours}h`;
  } else if (hours > 0) {
    formattedTime = `${hours}h ${minutes}m`;
  } else {
    formattedTime = `${minutes}m`;
  }
  
  if (isBreached) {
    formattedTime = `-${formattedTime} (overdue)`;
  }
  
  return {
    isBreached,
    hoursRemaining: Math.round(hoursRemaining * 100) / 100,
    formattedTime,
  };
};

// Determine escalation level based on overdue time
export const determineEscalationLevel = (
  currentLevel: string | null,
  hoursOverdue: number
): 'level_1' | 'level_2' | 'level_3' | 'executive' => {
  if (hoursOverdue > 72 || currentLevel === 'level_3') {
    return 'executive';
  } else if (hoursOverdue > 48 || currentLevel === 'level_2') {
    return 'level_3';
  } else if (hoursOverdue > 24 || currentLevel === 'level_1') {
    return 'level_2';
  }
  return 'level_1';
};

// Generate complaint reference number
export const generateComplaintReference = (
  departmentCode: string,
  date: Date = new Date()
): string => {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  return `${departmentCode}-${year}${month}${day}-${random}`;
};

// Sanitize user input
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '');    // Remove remaining angle brackets
};

// Validate coordinates
export const isValidCoordinates = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

// Format duration in human readable format
export const formatDuration = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  } else if (hours < 24) {
    return `${Math.round(hours)} hours`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours === 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    return `${days} day${days > 1 ? 's' : ''} ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
  }
};
