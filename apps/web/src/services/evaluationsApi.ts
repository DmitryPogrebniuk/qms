/**
 * Evaluations & Scorecards API
 */

import { httpClient } from '../hooks/useHttpClient';

export interface ScorecardQuestion {
  id: string;
  text: string;
  type: 'YES_NO' | 'SCALE' | 'TEXT' | 'DROPDOWN' | 'CRITICAL';
  weight: number;
  isCritical: boolean;
  options?: string[] | { min: number; max: number };
  order: number;
}

export interface ScorecardSection {
  id: string;
  name: string;
  weight: number;
  order: number;
  questions: ScorecardQuestion[];
}

export interface Scorecard {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sections: ScorecardSection[];
  creator?: { id: string; fullName?: string };
}

export interface EvaluationAnswer {
  id?: string;
  questionId: string;
  value?: string;
  score?: number;
  comment?: string;
}

export interface Evaluation {
  id: string;
  recordingId?: string;
  scorecardId?: string;
  scorecard?: { id: string; name: string };
  scorecardTemplate?: { id: string; name: string };
  status: string;
  finalScore?: number;
  totalScore?: number;
  answers?: Array<EvaluationAnswer & { question: ScorecardQuestion }>;
  evaluator?: { fullName: string };
  agent?: { agentId: string; fullName: string };
  recording?: { id: string; startTime: string; durationSeconds?: number };
  createdAt: string;
  submittedAt?: string;
}

export async function getScorecards(includeInactive = false): Promise<Scorecard[]> {
  const res = await httpClient.get<Scorecard[]>('/scorecards', {
    params: { includeInactive: includeInactive ? 'true' : undefined },
  });
  return res.data;
}

export async function getScorecard(id: string): Promise<Scorecard> {
  const res = await httpClient.get<Scorecard>(`/scorecards/${id}`);
  return res.data;
}

export async function createScorecard(data: Partial<Scorecard>): Promise<Scorecard> {
  const res = await httpClient.post<Scorecard>('/scorecards', data);
  return res.data;
}

export async function updateScorecard(id: string, data: Partial<Scorecard>): Promise<Scorecard> {
  const res = await httpClient.put<Scorecard>(`/scorecards/${id}`, data);
  return res.data;
}

export async function deleteScorecard(id: string): Promise<void> {
  await httpClient.delete(`/scorecards/${id}`);
}

export async function getEvaluations(page = 1, pageSize = 20) {
  const res = await httpClient.get('/evaluations', { params: { page, pageSize } });
  return res.data;
}

export async function getEvaluation(id: string): Promise<Evaluation> {
  const res = await httpClient.get<Evaluation>(`/evaluations/${id}`);
  return res.data;
}

export async function getEvaluationStats(dateFrom?: string, dateTo?: string) {
  const res = await httpClient.get('/evaluations/stats', {
    params: { dateFrom, dateTo },
  });
  return res.data;
}

export async function getRecordingEvaluations(recordingId: string): Promise<Evaluation[]> {
  const res = await httpClient.get<Evaluation[]>(`/recordings/${recordingId}/evaluations`);
  return res.data;
}

export async function createEvaluation(data: {
  recordingId: string;
  scorecardId: string;
  answers?: EvaluationAnswer[];
}): Promise<Evaluation> {
  const res = await httpClient.post<Evaluation>('/evaluations', data);
  return res.data;
}

export async function updateEvaluation(
  id: string,
  data: { answers?: EvaluationAnswer[]; comments?: string },
): Promise<Evaluation> {
  const res = await httpClient.put<Evaluation>(`/evaluations/${id}`, data);
  return res.data;
}

export async function submitEvaluation(id: string): Promise<Evaluation> {
  const res = await httpClient.post<Evaluation>(`/evaluations/${id}/submit`);
  return res.data;
}

export async function acknowledgeEvaluation(id: string): Promise<Evaluation> {
  const res = await httpClient.post<Evaluation>(`/evaluations/${id}/acknowledge`);
  return res.data;
}

export async function disputeEvaluation(id: string, comment: string): Promise<Evaluation> {
  const res = await httpClient.post<Evaluation>(`/evaluations/${id}/dispute`, { comment });
  return res.data;
}
