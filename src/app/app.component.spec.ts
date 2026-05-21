// src/app/app.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { TrainerStore } from './state/trainer/trainer.store';
import { of } from 'rxjs';

describe('AppComponent', () => {
  let mockTrainerStore: jasmine.SpyObj<TrainerStore>;

  beforeEach(async () => {
    // Create a complete spy object with all methods and properties
    mockTrainerStore = jasmine.createSpyObj('TrainerStore', 
      [
        'setCurrentTrainer', 
        'clearError', 
        'loadTeams', 
        'loadBattles', 
        'createTeam', 
        'updateTeam', 
        'deleteTeam', 
        'updateTrainer', 
        'getTeamCount', 
        'reset'
      ],
      {
        trainer$: of(null),
        teams$: of([]),
        battles$: of([]),
        loading$: of(false),
        error$: of(null),
        state$: of({
          currentTrainerId: '1',
          trainer: null,
          teams: [],
          battles: [],
          loading: false,
          error: null
        })
      }
    );
    
    // Set return values for methods
    mockTrainerStore.loadTeams.and.returnValue(of([]));
    mockTrainerStore.loadBattles.and.returnValue(of([]));
    mockTrainerStore.getTeamCount.and.returnValue(0);
    
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        RouterTestingModule
      ],
      providers: [
        { provide: TrainerStore, useValue: mockTrainerStore }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the app component', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});