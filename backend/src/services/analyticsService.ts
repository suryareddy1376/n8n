import { supabaseAdmin } from '../utils/supabase.js';
import { handleDatabaseError } from '../utils/errors.js';
import { DashboardStats, DepartmentStats, AIPerformanceStats } from '../types/index.js';

// Get dashboard statistics
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const { data, error } = await supabaseAdmin
    .from('v_dashboard_stats')
    .select('*')
    .single();

  if (error) {
    throw handleDatabaseError(error);
  }

  return data as DashboardStats;
};

// Get complaints by department
export const getComplaintsByDepartment = async (): Promise<DepartmentStats[]> => {
  const { data, error } = await supabaseAdmin
    .from('v_complaints_by_department')
    .select('*')
    .order('total_complaints', { ascending: false });

  if (error) {
    throw handleDatabaseError(error);
  }

  return data as DepartmentStats[];
};

// Get AI performance metrics
export const getAIPerformanceMetrics = async (
  days: number = 30
): Promise<AIPerformanceStats[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from('v_ai_performance')
    .select('*')
    .gte('date', startDate.toISOString())
    .order('date', { ascending: false });

  if (error) {
    throw handleDatabaseError(error);
  }

  return data as AIPerformanceStats[];
};

// Get complaints trend over time
export const getComplaintsTrend = async (
  days: number = 30,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<{ date: string; count: number; resolved: number }[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabaseAdmin.rpc('get_complaints_trend', {
    start_date: startDate.toISOString(),
    group_by: groupBy,
  });

  if (error) {
    // Fallback to manual calculation if RPC doesn't exist
    const { data: complaints, error: queryError } = await supabaseAdmin
      .from('complaints')
      .select('created_at, resolved_at')
      .gte('created_at', startDate.toISOString());

    if (queryError) {
      throw handleDatabaseError(queryError);
    }

    // Group by date
    const grouped: Record<string, { count: number; resolved: number }> = {};
    
    for (const complaint of complaints || []) {
      const date = new Date(complaint.created_at).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { count: 0, resolved: 0 };
      }
      grouped[date].count++;
      if (complaint.resolved_at) {
        grouped[date].resolved++;
      }
    }

    return Object.entries(grouped)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return data;
};

// Get urgency distribution
export const getUrgencyDistribution = async (): Promise<
  { urgency: string; count: number; percentage: number }[]
> => {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select('urgency')
    .not('status', 'in', '("rejected")');

  if (error) {
    throw handleDatabaseError(error);
  }

  const total = data?.length || 0;
  const counts: Record<string, number> = { normal: 0, high: 0, critical: 0 };

  for (const complaint of data || []) {
    counts[complaint.urgency] = (counts[complaint.urgency] || 0) + 1;
  }

  return Object.entries(counts).map(([urgency, count]) => ({
    urgency,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
  }));
};

// Get average resolution time by department
export const getResolutionTimeByDepartment = async (): Promise<
  { department_name: string; avg_hours: number; complaint_count: number }[]
> => {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select(`
      resolved_at,
      created_at,
      department:departments(name)
    `)
    .not('resolved_at', 'is', null);

  if (error) {
    throw handleDatabaseError(error);
  }

  const byDepartment: Record<string, { totalHours: number; count: number }> = {};

  for (const complaint of data || []) {
    const deptName = (complaint.department as { name: string })?.name || 'Unknown';
    const hours =
      (new Date(complaint.resolved_at!).getTime() -
        new Date(complaint.created_at).getTime()) /
      (1000 * 60 * 60);

    if (!byDepartment[deptName]) {
      byDepartment[deptName] = { totalHours: 0, count: 0 };
    }
    byDepartment[deptName].totalHours += hours;
    byDepartment[deptName].count++;
  }

  return Object.entries(byDepartment)
    .map(([department_name, stats]) => ({
      department_name,
      avg_hours: Math.round((stats.totalHours / stats.count) * 10) / 10,
      complaint_count: stats.count,
    }))
    .sort((a, b) => a.avg_hours - b.avg_hours);
};

// Get geographic distribution
export const getGeographicDistribution = async (): Promise<
  { location: string; count: number; lat: number; lng: number }[]
> => {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select('location_lat, location_lng, location_address')
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null);

  if (error) {
    throw handleDatabaseError(error);
  }

  // Group by approximate location (rounded to 2 decimal places)
  const grouped: Record<string, { count: number; lat: number; lng: number; address: string }> = {};

  for (const complaint of data || []) {
    const key = `${Math.round(complaint.location_lat! * 100) / 100},${Math.round(complaint.location_lng! * 100) / 100}`;
    
    if (!grouped[key]) {
      grouped[key] = {
        count: 0,
        lat: complaint.location_lat!,
        lng: complaint.location_lng!,
        address: complaint.location_address || 'Unknown',
      };
    }
    grouped[key].count++;
  }

  return Object.values(grouped)
    .map((g) => ({
      location: g.address,
      count: g.count,
      lat: g.lat,
      lng: g.lng,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50); // Top 50 locations
};

// Get citizen satisfaction metrics
export const getCitizenSatisfaction = async (): Promise<{
  average_rating: number;
  total_ratings: number;
  rating_distribution: { rating: number; count: number }[];
}> => {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select('citizen_feedback_rating')
    .not('citizen_feedback_rating', 'is', null);

  if (error) {
    throw handleDatabaseError(error);
  }

  const ratings = data?.map((c) => c.citizen_feedback_rating!) || [];
  const total = ratings.length;
  const sum = ratings.reduce((acc, r) => acc + r, 0);

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const rating of ratings) {
    distribution[rating] = (distribution[rating] || 0) + 1;
  }

  return {
    average_rating: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
    total_ratings: total,
    rating_distribution: Object.entries(distribution).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
    })),
  };
};

export default {
  getDashboardStats,
  getComplaintsByDepartment,
  getAIPerformanceMetrics,
  getComplaintsTrend,
  getUrgencyDistribution,
  getResolutionTimeByDepartment,
  getGeographicDistribution,
  getCitizenSatisfaction,
};
