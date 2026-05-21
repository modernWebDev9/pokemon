/**
 * Edit Team Dialog Component - Modal dialog for editing team details
 * Allows editing team name, competitive mode, battle tier, and Pokémon nicknames/held items
 * Also allows removing Pokémon from the team (minimum 1 Pokémon required)
 */
import { Component, input, output, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Team, PokemonDetail } from '../../../state/trainer/trainer.store';
import { Pokemon } from '../../../state/pokemon/pokemon.store';

interface PokemonWithDetails {
  id: number;
  pokemonId: number;
  nickname: string;
  heldItem: string;
  pokemon: Pokemon | undefined;
}

@Component({
  selector: 'app-edit-team-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-team-dialog.component.html',
  styleUrls: ['./edit-team-dialog.component.scss']
})
export class EditTeamDialogComponent implements OnInit {
  team = input.required<Team>();
  allPokemon = input<Pokemon[]>([]);
  heldItems = input<{ value: string; label: string }[]>([]);
  save = output<Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId'>>>();
  close = output<void>();
  
  editName = signal('');
  editCompetitiveMode = signal(false);
  editTier = signal<'OU' | 'UU' | 'RU' | 'NU' | null>(null);
  
  // Pokémon details editing - stores nickname and held item for each Pokémon
  pokemonDetails = signal<Map<number, { nickname: string; heldItem: string }>>(new Map());
  
  // Track current Pokémon IDs in the team (for display and removal)
  currentPokemonIds = signal<number[]>([]);
  
  // Track which Pokémon to remove (for confirmation)
  pokemonToRemove = signal<number | null>(null);
  showRemoveConfirm = signal(false);
  removeErrorMessage = signal<string | null>(null);
  
  ngOnInit(): void {
    const team = this.team();
    this.editName.set(team.name);
    this.editCompetitiveMode.set(team.competitiveMode);
    this.editTier.set(team.tier);
    
    // Store current Pokémon IDs
    this.currentPokemonIds.set([...team.pokemonIds]);
    
    // Load existing Pokémon details from team
    const detailsMap = new Map<number, { nickname: string; heldItem: string }>();
    if (team.pokemonDetails && team.pokemonDetails.length > 0) {
      team.pokemonDetails.forEach(detail => {
        detailsMap.set(detail.pokemonId, {
          nickname: detail.nickname || '',
          heldItem: detail.heldItem || ''
        });
      });
    } else {
      // Initialize empty details for each Pokémon in the team
      team.pokemonIds.forEach(pokemonId => {
        detailsMap.set(pokemonId, { nickname: '', heldItem: '' });
      });
    }
    this.pokemonDetails.set(detailsMap);
  }
  
  /**
   * Gets selected Pokémon with full data for display based on current IDs
   */
  selectedPokemonWithDetails = computed(() => {
    const pokemonIds = this.currentPokemonIds();
    const detailsMap = this.pokemonDetails();
    const allPokemonList = this.allPokemon();
    
    return pokemonIds.map(pokemonId => {
      const pokemon = allPokemonList.find(p => p.id === pokemonId);
      const details = detailsMap.get(pokemonId) || { nickname: '', heldItem: '' };
      return {
        id: pokemonId,
        pokemonId: pokemonId,
        nickname: details.nickname,
        heldItem: details.heldItem,
        pokemon: pokemon
      };
    }).filter(item => item.pokemon);
  });
  
  /**
   * Checks if team has minimum 1 Pokémon
   */
  hasMinimumPokemon = computed(() => {
    return this.currentPokemonIds().length >= 1;
  });
  
  /**
   * Gets nickname for a Pokémon
   */
  getPokemonNickname(pokemonId: number): string {
    return this.pokemonDetails().get(pokemonId)?.nickname || '';
  }
  
  /**
   * Gets held item for a Pokémon
   */
  getPokemonHeldItem(pokemonId: number): string {
    return this.pokemonDetails().get(pokemonId)?.heldItem || '';
  }
  
  /**
   * Updates nickname for a Pokémon
   */
  updateNickname(pokemonId: number, nickname: string): void {
    const newMap = new Map(this.pokemonDetails());
    const existing = newMap.get(pokemonId) || { nickname: '', heldItem: '' };
    newMap.set(pokemonId, { ...existing, nickname });
    this.pokemonDetails.set(newMap);
  }
  
  /**
   * Updates held item for a Pokémon
   */
  updateHeldItem(pokemonId: number, heldItem: string): void {
    const newMap = new Map(this.pokemonDetails());
    const existing = newMap.get(pokemonId) || { nickname: '', heldItem: '' };
    newMap.set(pokemonId, { ...existing, heldItem });
    this.pokemonDetails.set(newMap);
  }
  
  /**
   * Shows remove confirmation modal with validation
   */
  confirmRemovePokemon(pokemonId: number): void {
    // Clear any previous error message
    this.removeErrorMessage.set(null);
    
    // Check if removal would make team empty
    if (this.currentPokemonIds().length <= 1) {
      this.removeErrorMessage.set('❌ Cannot remove the last Pokémon. A team must have at least 1 Pokémon.');
      setTimeout(() => this.removeErrorMessage.set(null), 3000);
      return;
    }
    
    // Set the Pokémon to remove and show modal
    this.pokemonToRemove.set(pokemonId);
    this.showRemoveConfirm.set(true);
  }
  
  /**
   * Closes remove confirmation modal
   */
  closeRemoveConfirm(): void {
    this.showRemoveConfirm.set(false);
    this.pokemonToRemove.set(null);
  }
  
  /**
   * Removes a Pokémon from the team - UPDATES BOTH IDs AND DETAILS MAP
   */
  removePokemon(): void {
    const pokemonId = this.pokemonToRemove();
    if (pokemonId === null) return;
    
    // Double-check that removal would not make team empty
    if (this.currentPokemonIds().length <= 1) {
      this.removeErrorMessage.set('❌ Cannot remove the last Pokémon. A team must have at least 1 Pokémon.');
      this.closeRemoveConfirm();
      setTimeout(() => this.removeErrorMessage.set(null), 3000);
      return;
    }
    
    // Remove from current Pokémon IDs list
    const newPokemonIds = this.currentPokemonIds().filter(id => id !== pokemonId);
    this.currentPokemonIds.set(newPokemonIds);
    
    // Remove from details map
    const newDetailsMap = new Map(this.pokemonDetails());
    newDetailsMap.delete(pokemonId);
    this.pokemonDetails.set(newDetailsMap);
    
    // Close confirmation modal
    this.closeRemoveConfirm();
  }
  
  /**
   * Gets Pokémon sprite URL by ID
   */
  getPokemonSprite(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }
  
  /**
   * Gets held item label by value
   */
  getHeldItemLabel(value: string): string {
    const items = this.heldItems();
    const item = items.find(i => i.value === value);
    return item ? item.label : value;
  }
  
  /**
   * Validates form inputs
   * Team name: 3-30 characters
   * Team must have at least 1 Pokémon
   */
  isValid = computed(() => {
    const name = this.editName().trim();
    const nameValid = name.length >= 3 && name.length <= 30;
    const hasPokemon = this.currentPokemonIds().length >= 1;
    return nameValid && hasPokemon;
  });
  
  /**
   * Saves changes including Pokémon details and removed Pokémon
   */
  onSave(): void {
    if (!this.isValid()) return;
    
    // Get current Pokémon IDs (after removals)
    const currentPokemonIds = this.currentPokemonIds();
    const currentDetailsMap = this.pokemonDetails();
    
    // Convert Pokémon details map to array for DB storage
    const pokemonDetailsArray: PokemonDetail[] = Array.from(currentDetailsMap.entries()).map(([pokemonId, details]) => ({
      pokemonId,
      nickname: details.nickname,
      heldItem: details.heldItem
    }));
    
    // Create updates with BOTH fields
    const updates: Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId'>> = {
      name: this.editName().trim(),
      competitiveMode: this.editCompetitiveMode(),
      tier: this.editCompetitiveMode() ? this.editTier() : null,
      pokemonIds: currentPokemonIds,
      pokemonDetails: pokemonDetailsArray
    };
    
    this.save.emit(updates);
  }
  
  /**
   * Closes the dialog
   */
  onClose(): void {
    this.close.emit();
  }
}