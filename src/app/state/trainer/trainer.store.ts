/**
 * Trainer Store - BehaviorSubject-based state management for trainer, teams, and battles
 * Handles optimistic updates, error handling, and local mock server integration
 */
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

/**
 * Represents a Pokémon trainer
 */
export interface Trainer {
  id: string;
  name: string;
  badgeCount: number;
  region: string;
  avatarUrl: string;
  rank: string;
}

/**
 * Represents a trainer's Pokémon team
 */
export interface Team {
  id: string;
  name: string;
  trainerId: string;
  pokemonIds: number[];
  createdAt: string;
  competitiveMode: boolean;
  tier: 'OU' | 'UU' | 'RU' | 'NU' | null;
}

/**
 * Represents a battle record
 */
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

/**
 * Input for creating a new team
 */
export interface CreateTeamInput {
  name: string;
  trainerId: string;
  pokemonIds: number[];
  competitiveMode: boolean;
  tier: 'OU' | 'UU' | 'RU' | 'NU' | null;
}

/**
 * State interface for trainer store
 */
export interface TrainerState {
  currentTrainerId: string;
  trainer: Trainer | null;
  teams: Team[];
  battles: Battle[];
  loading: boolean;
  error: string | null;
}

/**
 * Initial state for trainer store
 */
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

  /**
   * Observable stream of current trainer
   */
  public readonly trainer$ = this.state$.pipe(map(state => state.trainer));
  
  /**
   * Observable stream of trainer's teams
   */
  public readonly teams$ = this.state$.pipe(map(state => state.teams));
  
  /**
   * Observable stream of trainer's battles
   */
  public readonly battles$ = this.state$.pipe(map(state => state.battles));
  
  /**
   * Observable stream of loading state
   */
  public readonly loading$ = this.state$.pipe(map(state => state.loading));
  
  /**
   * Observable stream of error state
   */
  public readonly error$ = this.state$.pipe(map(state => state.error));

  constructor() {
    console.log('TrainerStore: Auto-loading trainer 1');
    this.setCurrentTrainer('1');
  }

  /**
   * Loads trainer profile by ID from local mock server
   *
   * @param trainerId - Trainer ID to load
   * @returns Observable<Trainer | null> - Stream of trainer data
   */
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
        this.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Loads teams for current trainer from local mock server
   *
   * @returns Observable<Team[]> - Stream of team data
   */
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
        return throwError(() => error);
      })
    );
  }

  /**
   * Loads battles for current trainer from local mock server
   *
   * @returns Observable<Battle[]> - Stream of battle data
   */
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
        return of([]);
      })
    );
  }

  /**
   * Creates a new team with optimistic UI updates
   * Shows team immediately in UI, rolls back on error
   *
   * @param teamData - Team creation data
   * @returns Observable<Team> - Stream of created team
   */
  createTeam(teamData: CreateTeamInput): Observable<Team> {
    const currentState = this.stateSubject.value;
    const tempId = `temp_${Date.now()}`;

    // Create optimistic team for immediate UI update
    const optimisticTeam: Team = {
      id: tempId,
      name: teamData.name,
      trainerId: teamData.trainerId,
      pokemonIds: teamData.pokemonIds,
      createdAt: new Date().toISOString(),
      competitiveMode: teamData.competitiveMode,
      tier: teamData.tier,
    };

    // Optimistic update - show team immediately
    this.stateSubject.next({
      ...currentState,
      teams: [...currentState.teams, optimisticTeam],
    });

    // Prepare payload for API
    const newTeam = {
      name: teamData.name,
      trainer_id: teamData.trainerId,
      pokemon_ids: teamData.pokemonIds,
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
        // Replace temporary team with real team from server
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

        // Rollback optimistic update on error
        const rolledBackTeams = this.stateSubject.value.teams.filter(
          (team: Team) => team.id !== tempId
        );

        this.stateSubject.next({
          ...this.stateSubject.value,
          teams: rolledBackTeams,
          error: null,
        });

        return throwError(() => error);
      })
    );
  }

  /**
   * Updates an existing team with optimistic UI updates
   *
   * @param id - Team ID to update
   * @param updates - Partial team data to update
   * @returns Observable<Team> - Stream of updated team
   */
  updateTeam(id: string, updates: Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId' | 'pokemonIds'>>): Observable<Team> {
    const currentState = this.stateSubject.value;
    const originalTeam = currentState.teams.find((t: Team) => t.id === id);

    if (!originalTeam) {
      return throwError(() => new Error('Team not found'));
    }

    // Create optimistic update
    const optimisticTeam = { ...originalTeam, ...updates };

    // Optimistic update - show changes immediately
    this.stateSubject.next({
      ...currentState,
      teams: currentState.teams.map((team: Team) =>
        team.id === id ? optimisticTeam : team
      ),
    });

    // Prepare payload for API
    const updatePayload: any = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.competitiveMode !== undefined) updatePayload.competitive_mode = updates.competitiveMode;
    if (updates.tier !== undefined) updatePayload.tier = updates.tier;

    return this.http.patch(`${this.apiUrl}/teams/${id}`, updatePayload).pipe(
      map((updatedTeam: any) => {
        console.log('Team updated:', updatedTeam);
        return this.transformTeam(updatedTeam);
      }),
      tap((realTeam: Team) => {
        // Update with server response
        const updatedTeams = this.stateSubject.value.teams.map((team: Team) =>
          team.id === id ? { ...realTeam, pokemonIds: originalTeam.pokemonIds } : team
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
          error: null,
        });

        return throwError(() => error);
      })
    );
  }

  /**
   * Deletes a team with optimistic UI updates
   *
   * @param id - Team ID to delete
   * @returns Observable<void> - Empty stream on success
   */
  deleteTeam(id: string): Observable<void> {
    const currentState = this.stateSubject.value;
    const deletedTeam = currentState.teams.find((t: Team) => t.id === id);

    if (!deletedTeam) {
      return throwError(() => new Error('Team not found'));
    }

    // Optimistic update - remove team immediately
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

        // Rollback optimistic update on error
        this.stateSubject.next({
          ...this.stateSubject.value,
          teams: [...this.stateSubject.value.teams, deletedTeam],
          error: null,
        });

        return throwError(() => error);
      })
    );
  }

  /**
   * Updates trainer profile with Base64 avatar support
   * Uses optimistic updates and handles avatar size validation
   *
   * @param id - Trainer ID to update
   * @param updates - Partial trainer data to update
   * @returns Observable<Trainer> - Stream of updated trainer
   */
  updateTrainer(id: string, updates: Partial<Omit<Trainer, 'id'>>): Observable<Trainer> {
    console.log('=== UPDATE TRAINER (Base64 Mode) ===');
    console.log('Trainer ID:', id);
    console.log('Updates:', Object.keys(updates));
    
    // Validate avatar size if present
    if (updates.avatarUrl) {
      const sizeKB = updates.avatarUrl.length / 1024;
      const isBase64 = updates.avatarUrl.startsWith('data:image/');
      console.log(`Avatar - Base64: ${isBase64}, Size: ${sizeKB.toFixed(1)}KB`);
      
      // Reject if too large (json-server limit ~1MB)
      // Base64 size limit: 700KB (allows ~525KB original images with 33% Base64 overhead)
      if (isBase64 && sizeKB > 700) {
        const errorMsg = `Avatar too large (${sizeKB.toFixed(1)}KB). Maximum allowed is 700KB (approx 525KB original). Please use a smaller image.`;
        console.error(errorMsg);
        return throwError(() => new Error(errorMsg));
      }
    }

    const currentState = this.stateSubject.value;
    const optimisticTrainer = currentState.trainer ? { ...currentState.trainer, ...updates } : null;

    // Optimistic update - show changes immediately
    if (optimisticTrainer) {
      this.stateSubject.next({
        ...currentState,
        trainer: optimisticTrainer as Trainer,
      });
    }

    // Build payload with correct field names for json-server
    const updatePayload: any = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.region !== undefined) updatePayload.region = updates.region;
    if (updates.rank !== undefined) updatePayload.rank = updates.rank;
    if (updates.badgeCount !== undefined) updatePayload.badge_count = updates.badgeCount;
    if (updates.avatarUrl !== undefined) updatePayload.avatar_url = updates.avatarUrl;

    // Log payload size for debugging
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
          errorMessage = 'Server error: The avatar image may be too large. Please use a smaller image (max 500KB original).';
        } else if (error.status === 413) {
          errorMessage = 'Avatar image too large for the server. Please use a smaller image.';
        } else if (error.status === 400) {
          errorMessage = 'Invalid data sent to server. Check avatar image size.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        // Restore previous trainer state on error
        this.stateSubject.next({
          ...this.stateSubject.value,
          trainer: currentState.trainer,
          error: null, // 전역 에러를 설정하지 않음
        });
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Sets current trainer and loads all related data
   *
   * @param trainerId - Trainer ID to set as current
   */
  setCurrentTrainer(trainerId: string): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      currentTrainerId: trainerId,
    });

    // Load all related data for the new trainer
    this.loadTrainer(trainerId).subscribe();
    this.loadTeams().subscribe();
    this.loadBattles().subscribe();
  }

  /**
   * Clears current error state
   */
  clearError(): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      error: null,
    });
  }

  /**
   * Gets count of teams for current trainer
   *
   * @returns Number of teams
   */
  getTeamCount(): number {
    return this.stateSubject.value.teams.length;
  }

  /**
   * Resets store to initial state
   */
  reset(): void {
    this.stateSubject.next(INITIAL_STATE);
  }

  /**
   * Sets loading state
   *
   * @param loading - Loading state to set
   */
  private setLoading(loading: boolean): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      loading,
    });
  }

  /**
   * Sets error state
   *
   * @param error - Error message or null
   */
  private setError(error: string | null): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      error,
    });
  }

  /**
   * Transforms raw trainer data from API to internal model
   *
   * @param raw - Raw trainer data from API
   * @returns Transformed Trainer object
   */
  private transformTrainer(raw: any): Trainer {
    console.log('Transforming raw trainer data:', raw);
    const transformed = {
      id: String(raw.id),
      name: raw.name || 'Unknown Trainer',
      badgeCount: raw.badge_count || 0,
      region: raw.region || 'Kanto',
      avatarUrl: raw.avatar_url || '',
      rank: raw.rank || 'Trainer',
    };
    console.log('Transformed trainer - Avatar length:', transformed.avatarUrl.length);
    return transformed;
  }

  /**
   * Transforms raw team data from API to internal model
   *
   * @param raw - Raw team data from API
   * @returns Transformed Team object
   */
  private transformTeam(raw: any): Team {
    return {
      id: String(raw.id),
      name: raw.name || 'Unnamed Team',
      trainerId: String(raw.trainer_id),
      pokemonIds: raw.pokemon_ids || [],
      createdAt: raw.created_at || new Date().toISOString(),
      competitiveMode: raw.competitive_mode || false,
      tier: raw.tier || null,
    };
  }

  /**
   * Transforms raw battle data from API to internal model
   *
   * @param raw - Raw battle data from API
   * @returns Transformed Battle object
   */
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