// src/app/features/team-builder/team-builder.validators.spec.ts
import { AbstractControl, ValidationErrors, FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';

// Team name validator
export function teamNameValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value?.trim();
  if (!value) {
    return { required: true };
  }
  if (value.length < 3) {
    return { minlength: { requiredLength: 3, actualLength: value.length } };
  }
  if (value.length > 30) {
    return { maxlength: { requiredLength: 30, actualLength: value.length } };
  }
  return null;
}

// Async unique validator
export function uniqueTeamNameValidator(existingNames: string[]) {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = control.value?.trim();
    if (!value) return of(null);
    
    const isDuplicate = existingNames.some(name => 
      name.toLowerCase() === value.toLowerCase()
    );
    
    return of(isDuplicate ? { unique: true } : null);
  };
}

describe('Team Builder Validators', () => {
  describe('teamNameValidator', () => {
    it('should return required error when name is empty', () => {
      const control = new FormControl('');
      const result = teamNameValidator(control);
      expect(result).toEqual({ required: true });
    });

    it('should return minlength error when name is too short', () => {
      const control = new FormControl('ab');
      const result = teamNameValidator(control);
      expect(result).toEqual({ minlength: { requiredLength: 3, actualLength: 2 } });
    });

    it('should return maxlength error when name is too long', () => {
      const control = new FormControl('a'.repeat(31));
      const result = teamNameValidator(control);
      expect(result).toEqual({ maxlength: { requiredLength: 30, actualLength: 31 } });
    });

    it('should return null when name is valid', () => {
      const control = new FormControl('Valid Team');
      const result = teamNameValidator(control);
      expect(result).toBeNull();
    });
  });

  describe('uniqueTeamNameValidator', () => {
    const existingNames = ['Kanto Starters', 'Johto Squad'];

    it('should return null when name is unique', (done) => {
      const control = new FormControl('New Team');
      const validator = uniqueTeamNameValidator(existingNames);
      
      validator(control).subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('should return unique error when name exists', (done) => {
      const control = new FormControl('Kanto Starters');
      const validator = uniqueTeamNameValidator(existingNames);
      
      validator(control).subscribe(result => {
        expect(result).toEqual({ unique: true });
        done();
      });
    });

    it('should handle case-insensitive duplicate check', (done) => {
      const control = new FormControl('kanto starters');
      const validator = uniqueTeamNameValidator(existingNames);
      
      validator(control).subscribe(result => {
        expect(result).toEqual({ unique: true });
        done();
      });
    });

    it('should return null for empty value', (done) => {
      const control = new FormControl('');
      const validator = uniqueTeamNameValidator(existingNames);
      
      validator(control).subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });
  });
});