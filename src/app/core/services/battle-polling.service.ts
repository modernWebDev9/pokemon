// src/app/core/services/battle-polling.service.ts
import { Injectable, DestroyRef, inject } from '@angular/core';
import { interval, Observable, Subject, from } from 'rxjs';
import { switchMap, map, distinctUntilChanged, tap, takeUntil } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

export interface BattleLogEntry {
  id: string;
  battle_id: string;
  timestamp: string;
  message: string;
  severity: 'info' | 'success' | 'danger' | 'warning';
}

/**
 * Battle Log Polling Service
 * 
 * NOTE: Polling is used instead of WebSocket subscriptions because:
 * 1. json-server does not support WebSocket protocol
 * 2. GraphQL Subscriptions would require Apollo Server with WebSocket
 * 3. 5-second polling is sufficient for battle log requirements
 * 4. In production, WebSocket would be recommended for real-time updates
 */
@Injectable({ providedIn: 'root' })
export class BattlePollingService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  
  private apiUrl = 'http://localhost:4000';
  private lastTimestamp = new Date(0);
  private newLogsSubject = new Subject<BattleLogEntry[]>();
  private destroy$ = new Subject<void>();
  
  public newLogs$ = this.newLogsSubject.asObservable();
  
  /**
   * Start polling for new battle logs every 5 seconds
   * Uses RxJS interval + switchMap pattern
   * 
   * @returns Observable of new battle log entries
   */
  startPolling(): Observable<BattleLogEntry[]> {
    return interval(5000).pipe(
      switchMap(() => this.fetchAllLogs()),
      map(logs => logs.filter(log => new Date(log.timestamp) > this.lastTimestamp)),
      tap(logs => {
        if (logs.length > 0) {
          const maxTimestamp = Math.max(...logs.map(l => new Date(l.timestamp).getTime()));
          this.lastTimestamp = new Date(maxTimestamp);
          this.newLogsSubject.next(logs);
        }
      }),
      takeUntil(this.destroy$)
    );
  }
  
  /**
   * Fetch all battle logs from API
   * Public method for manual refresh
   * 
   * @returns Observable of all battle log entries
   */
  fetchAllLogs(): Observable<BattleLogEntry[]> {
    return this.http.get<BattleLogEntry[]>(`${this.apiUrl}/battle_log`);
  }
  
  /**
   * Fetch logs that are newer than last timestamp
   * Public method for initial load
   * 
   * @returns Observable of new battle log entries
   */
  fetchNewLogs(): Observable<BattleLogEntry[]> {
    return this.fetchAllLogs().pipe(
      map(logs => logs.filter(log => new Date(log.timestamp) > this.lastTimestamp))
    );
  }
  
  /**
   * Stop polling and cleanup
   */
  stopPolling(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Reset last timestamp (for refresh)
   */
  resetLastTimestamp(): void {
    this.lastTimestamp = new Date(0);
  }
  
  /**
   * Subscribe to battle logs with automatic cleanup
   * 
   * @param onNewLogs - Callback for new logs
   * @returns Subscription (component should manage)
   */
  subscribeToBattleLogs(onNewLogs: (logs: BattleLogEntry[]) => void) {
    return this.startPolling().subscribe({
      next: onNewLogs,
      error: (error) => console.error('Battle log polling error:', error)
    });
  }
}