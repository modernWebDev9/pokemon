import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

export interface Trainer {
  id: string;
  name: string;
  badgeCount: number;
  region: string;
  avatarUrl: string;
  rank: string;
}

export interface PokemonDetail {
  pokemonId: number;
  nickname: string;
  heldItem: string;
}

export interface Team {
  id: string;
  name: string;
  trainerId: string;
  pokemonIds: number[];
  pokemonDetails: PokemonDetail[];
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

export interface CreateTeamInput {
  name: string;
  trainerId: string;
  pokemonIds: number[];
  pokemonDetails: PokemonDetail[];
  competitiveMode: boolean;
  tier: 'OU' | 'UU' | 'RU' | 'NU' | null;
}

export interface TrainerState {
  currentTrainerId: string;
  trainer: Trainer | null;
  teams: Team[];
  battles: Battle[];
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: TrainerState = {
  currentTrainerId: '1',
  trainer: null,
  teams: [],
  battles: [],
  loading: false,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class TrainerStore {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:4000';

  private stateSubject = new BehaviorSubject<TrainerState>(INITIAL_STATE);
  public state$ = this.stateSubject.asObservable();

  public readonly trainer$ = this.state$.pipe(map(state => state.trainer));
  public readonly teams$ = this.state$.pipe(map(state => state.teams));
  public readonly battles$ = this.state$.pipe(map(state => state.battles));
  public readonly loading$ = this.state$.pipe(map(state => state.loading));
  public readonly error$ = this.state$.pipe(map(state => state.error));

  constructor() {
    console.log('TrainerStore: Auto-loading trainer 1');
    this.setCurrentTrainer('1');
  }

  loadTrainer(trainerId: string): Observable<Trainer | null> {
    this.setLoading(true);
    return this.http.get<any[]>(`${this.apiUrl}/trainers`).pipe(
      map((trainers) => {
        const rawTrainer = trainers.find(t => t.id === trainerId);
        return rawTrainer ? this.transformTrainer(rawTrainer) : null;
      }),
      tap((trainer: Trainer | null) => {
        this.stateSubject.next({
          ...this.stateSubject.value,
          trainer,
          loading: false,
        });
      }),
      catchError((error) => {
        console.error('Load trainer error:', error);
        this.setError(error.message || 'Failed to load trainer');
        this.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  loadTeams(): Observable<Team[]> {
    const trainerId = this.stateSubject.value.currentTrainerId;
    return this.http.get<any[]>(`${this.apiUrl}/teams`).pipe(
      map((teams) => {
        const filteredTeams = teams.filter(team => team.trainer_id === trainerId);
        return filteredTeams.map((team: any) => this.transformTeam(team));
      }),
      tap((teams: Team[]) => {
        this.stateSubject.next({
          ...this.stateSubject.value,
          teams,
        });
      }),
      catchError((error) => {
        console.error('Load teams error:', error);
        this.setError(error.message || 'Failed to load teams');
        return throwError(() => error);
      })
    );
  }

  loadBattles(): Observable<Battle[]> {
    const trainerId = this.stateSubject.value.currentTrainerId;
    return this.http.get<any[]>(`${this.apiUrl}/battles`).pipe(
      map((battles) => {
        const filteredBattles = battles.filter(battle => battle.trainer_id === trainerId);
        return filteredBattles.map((battle: any) => this.transformBattle(battle));
      }),
      tap((battles: Battle[]) => {
        this.stateSubject.next({
          ...this.stateSubject.value,
          battles,
        });
      }),
      catchError((error) => {
        console.error('Load battles error:', error);
        this.setError(error.message || 'Failed to load battles');
        return of([]);
      })
    );
  }

  createTeam(teamData: CreateTeamInput): Observable<Team> {
    const currentState = this.stateSubject.value;
    const tempId = `temp_${Date.now()}`;

    const optimisticTeam: Team = {
      id: tempId,
      name: teamData.name,
      trainerId: teamData.trainerId,
      pokemonIds: teamData.pokemonIds,
      pokemonDetails: teamData.pokemonDetails,
      createdAt: new Date().toISOString(),
      competitiveMode: teamData.competitiveMode,
      tier: teamData.tier,
    };

    this.stateSubject.next({
      ...currentState,
      teams: [...currentState.teams, optimisticTeam],
    });

    const newTeam = {
      name: teamData.name,
      trainer_id: teamData.trainerId,
      pokemon_ids: teamData.pokemonIds,
      pokemon_details: teamData.pokemonDetails,
      created_at: new Date().toISOString(),
      competitive_mode: teamData.competitiveMode,
      tier: teamData.tier,
    };

    return this.http.post<any>(`${this.apiUrl}/teams`, newTeam).pipe(
      map((realTeam) => {
        console.log('Team created:', realTeam);
        return this.transformTeam(realTeam);
      }),
      tap((realTeam: Team) => {
        const updatedTeams = this.stateSubject.value.teams.map((team: Team) =>
          team.id === tempId ? realTeam : team
        );
        this.stateSubject.next({
          ...this.stateSubject.value,
          teams: updatedTeams,
        });
      }),
      catchError((error) => {
        console.error('Create team error:', error);
        const rolledBackTeams = this.stateSubject.value.teams.filter(
          (team: Team) => team.id !== tempId
        );
        this.stateSubject.next({
          ...this.stateSubject.value,
          teams: rolledBackTeams,
          error: error.message || 'Failed to create team',
        });
        return throwError(() => error);
      })
    );
  }

  /**
 * Updates an existing team with optimistic UI updates
 * Handles pokemonIds and pokemonDetails correctly
 */
  updateTeam(id: string, updates: Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId'>>): Observable<Team> {
    const currentState = this.stateSubject.value;
    const originalTeam = currentState.teams.find((t: Team) => t.id === id);

    if (!originalTeam) {
      return throwError(() => new Error('Team not found'));
    }

    // Create optimistic team with updates
    const optimisticTeam = { ...originalTeam, ...updates };
    this.stateSubject.next({
      ...currentState,
      teams: currentState.teams.map((team: Team) =>
        team.id === id ? optimisticTeam : team
      ),
    });

    // Build payload with correct field names for json-server
    const updatePayload: any = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.competitiveMode !== undefined) updatePayload.competitive_mode = updates.competitiveMode;
    if (updates.tier !== undefined) updatePayload.tier = updates.tier;
    if (updates.pokemonIds !== undefined) updatePayload.pokemon_ids = updates.pokemonIds;
    if (updates.pokemonDetails !== undefined) updatePayload.pokemon_details = updates.pokemonDetails;

    console.log('Update payload being sent to server:', updatePayload);

    return this.http.patch(`${this.apiUrl}/teams/${id}`, updatePayload).pipe(
      map((updatedTeam: any) => {
        console.log('Team updated response:', updatedTeam);
        return this.transformTeam(updatedTeam);
      }),
      tap((realTeam: Team) => {
        const updatedTeams = this.stateSubject.value.teams.map((team: Team) =>
          team.id === id ? realTeam : team
        );
        this.stateSubject.next({
          ...this.stateSubject.value,
          teams: updatedTeams,
        });
      }),
      catchError((error) => {
        console.error('Update team error:', error);
        // Rollback optimistic update on error
        this.stateSubject.next({
          ...this.stateSubject.value,
          teams: this.stateSubject.value.teams.map((team: Team) =>
            team.id === id ? originalTeam : team
          ),
          error: error.message || 'Failed to update team',
        });
        return throwError(() => error);
      })
    );
  }

  deleteTeam(id: string): Observable<void> {
    const currentState = this.stateSubject.value;
    const deletedTeam = currentState.teams.find((t: Team) => t.id === id);

    if (!deletedTeam) {
      return throwError(() => new Error('Team not found'));
    }

    this.stateSubject.next({
      ...currentState,
      teams: currentState.teams.filter((team: Team) => team.id !== id),
    });

    return this.http.delete(`${this.apiUrl}/teams/${id}`).pipe(
      map(() => {
        console.log('Team deleted:', id);
        return void 0;
      }),
      catchError((error) => {
        console.error('Delete team error:', error);
        this.stateSubject.next({
          ...this.stateSubject.value,
          teams: [...this.stateSubject.value.teams, deletedTeam],
          error: error.message || 'Failed to delete team',
        });
        return throwError(() => error);
      })
    );
  }

  updateTrainer(id: string, updates: Partial<Omit<Trainer, 'id'>>): Observable<Trainer> {
    console.log('=== UPDATE TRAINER ===');
    console.log('Trainer ID:', id);
    console.log('Updates:', Object.keys(updates));

    if (updates.avatarUrl) {
      const sizeKB = updates.avatarUrl.length / 1024;
      const isBase64 = updates.avatarUrl.startsWith('data:image/');
      console.log(`Avatar - Base64: ${isBase64}, Size: ${sizeKB.toFixed(1)}KB`);
    }

    const currentState = this.stateSubject.value;
    const optimisticTrainer = currentState.trainer ? { ...currentState.trainer, ...updates } : null;

    if (optimisticTrainer) {
      this.stateSubject.next({
        ...currentState,
        trainer: optimisticTrainer as Trainer,
      });
    }

    const updatePayload: any = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.region !== undefined) updatePayload.region = updates.region;
    if (updates.rank !== undefined) updatePayload.rank = updates.rank;
    if (updates.badgeCount !== undefined) updatePayload.badge_count = updates.badgeCount;
    if (updates.avatarUrl !== undefined) updatePayload.avatar_url = updates.avatarUrl;

    const payloadStr = JSON.stringify(updatePayload);
    console.log(`Payload size: ${(payloadStr.length / 1024).toFixed(1)}KB`);

    return this.http.patch(`${this.apiUrl}/trainers/${id}`, updatePayload).pipe(
      map((updatedTrainer: any) => {
        console.log('Trainer updated successfully via PATCH');
        return this.transformTrainer(updatedTrainer);
      }),
      tap((realTrainer: Trainer) => {
        this.stateSubject.next({
          ...this.stateSubject.value,
          trainer: realTrainer,
          error: null,
        });
      }),
      catchError((error) => {
        console.error('Update trainer error:', error);
        let errorMessage = 'Failed to update profile';
        if (error.status === 500) {
          errorMessage = 'Server error: The avatar image may be too large. Please use a smaller image (max 200KB original).';
        } else if (error.status === 413) {
          errorMessage = 'Avatar image too large for the server. Please use a smaller image.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        this.stateSubject.next({
          ...this.stateSubject.value,
          trainer: currentState.trainer,
          error: errorMessage,
        });
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  setCurrentTrainer(trainerId: string): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      currentTrainerId: trainerId,
    });
    this.loadTrainer(trainerId).subscribe();
    this.loadTeams().subscribe();
    this.loadBattles().subscribe();
  }

  clearError(): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      error: null,
    });
  }

  getTeamCount(): number {
    return this.stateSubject.value.teams.length;
  }

  reset(): void {
    this.stateSubject.next(INITIAL_STATE);
  }

  private setLoading(loading: boolean): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      loading,
    });
  }

  private setError(error: string | null): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      error,
    });
  }

  private transformTrainer(raw: any): Trainer {
    console.log('Transforming raw trainer data:', raw);
    return {
      id: String(raw.id),
      name: raw.name || 'Unknown Trainer',
      badgeCount: raw.badge_count || 0,
      region: raw.region || 'Kanto',
      avatarUrl: raw.avatar_url || '',
      rank: raw.rank || 'Trainer',
    };
  }

  private transformTeam(raw: any): Team {
    return {
      id: String(raw.id),
      name: raw.name || 'Unnamed Team',
      trainerId: String(raw.trainer_id),
      pokemonIds: raw.pokemon_ids || [],
      pokemonDetails: raw.pokemon_details || [],
      createdAt: raw.created_at || new Date().toISOString(),
      competitiveMode: raw.competitive_mode || false,
      tier: raw.tier || null,
    };
  }

  private transformBattle(raw: any): Battle {
    return {
      id: String(raw.id),
      trainerId: String(raw.trainer_id),
      opponentName: raw.opponent_name || 'Unknown',
      teamId: String(raw.team_id),
      result: raw.result === 'win' ? 'win' : 'loss',
      date: raw.date || new Date().toISOString(),
      scoreTrainer: raw.score_trainer || 0,
      scoreOpponent: raw.score_opponent || 0,
    };
  }
}