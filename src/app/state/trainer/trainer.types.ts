// src/app/state/trainer/trainer.types.ts

export interface Trainer {
  id: string;
  name: string;
  badgeCount: number;
  region: string;
  avatarUrl: string;
  rank: string;
}

export interface Team {
  id: string;
  name: string;
  trainerId: string;
  pokemonIds: number[];
  createdAt: string;
  competitiveMode: boolean;
  tier: 'OU' | 'UU' | 'RU' | 'NU' | null;
}

export interface Battle {
  id: string;
  trainerId: string;
  opponentName: string;
  teamId: string;
  result: 'win' | 'loss';
  date: string;
  scoreTrainer: number;
  scoreOpponent: number;
}

export interface BattleLogEntry {
  id: string;
  battleId: string;
  timestamp: string;
  message: string;
  severity: 'info' | 'success' | 'danger' | 'warning';
}

export interface TrainerState {
  currentTrainerId: string;
  trainer: Trainer | null;
  teams: Team[];
  battles: Battle[];
  battleLogs: BattleLogEntry[];
  loading: boolean;
  error: string | null;
  pendingOperations: Map<string, PendingOperation>;
}

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
}