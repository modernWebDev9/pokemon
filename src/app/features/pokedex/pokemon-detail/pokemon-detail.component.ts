import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Pokemon } from '../../../state/pokemon/pokemon.store';
import { StatsChartComponent } from '../../../shared/components/stats-chart/stats-chart.component';

type StatKey = 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';

interface StatItem {
  name: string;
  key: StatKey;
}

@Component({
  selector: 'app-pokemon-detail',
  standalone: true,
  imports: [CommonModule, StatsChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pokemon-detail.component.html',
  styleUrls: ['./pokemon-detail.component.scss']
})
export class PokemonDetailComponent {
  private sanitizer = inject(DomSanitizer);
  
  pokemon = input<Pokemon | null>(null);
  closed = output<void>();
  
  isPlaying = signal<boolean>(false);
  private audioElement: HTMLAudioElement | null = null;
  
  /**
   * Format decimal numbers to 2 decimal places
   * Handles infinite decimals and floating point precision issues
   */
  formatDecimal(value: number): string {
    if (value === undefined || value === null) return '0';
    // Round to 2 decimal places and ensure proper formatting
    return value.toFixed(2);
  }
  
  // Video mapping for Pokémon
  private readonly videoMap: Record<number, string> = {
    1: 'https://www.youtube.com/embed/6jzZ3CqN9Zs',
    4: 'https://www.youtube.com/embed/gxEPV4kolz0',
    7: 'https://www.youtube.com/embed/9P6i6RZsBSc',
    25: 'https://www.youtube.com/embed/1HRa4X07jdE',
    6: 'https://www.youtube.com/embed/gxEPV4kolz0',
    9: 'https://www.youtube.com/embed/9P6i6RZsBSc',
    3: 'https://www.youtube.com/embed/6jzZ3CqN9Zs',
    144: 'https://www.youtube.com/embed/3GJOVPjhXMY',
    145: 'https://www.youtube.com/embed/3GJOVPjhXMY',
    146: 'https://www.youtube.com/embed/3GJOVPjhXMY',
    150: 'https://www.youtube.com/embed/5Tk5L4rYk9A',
    151: 'https://www.youtube.com/embed/6lFjGvQVqA0',
    147: 'https://www.youtube.com/embed/4w9EksW5wz8',
    148: 'https://www.youtube.com/embed/4w9EksW5wz8',
    149: 'https://www.youtube.com/embed/4w9EksW5wz8',
    133: 'https://www.youtube.com/embed/kJ8ZmSjeGmQ',
    134: 'https://www.youtube.com/embed/kJ8ZmSjeGmQ',
    135: 'https://www.youtube.com/embed/kJ8ZmSjeGmQ',
    136: 'https://www.youtube.com/embed/kJ8ZmSjeGmQ',
  };
  
  videoUrl = computed<SafeResourceUrl | null>(() => {
    const pokemon = this.pokemon();
    if (!pokemon) return null;
    
    const url = this.videoMap[pokemon.id] || 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    console.log('Video URL for', pokemon.name, ':', url);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  
  audioUrl = computed(() => {
    const pokemon = this.pokemon();
    if (!pokemon) return null;
    return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemon.id}.ogg`;
  });
  
  totalStats = computed(() => {
    const pokemon = this.pokemon();
    if (!pokemon) return 0;
    const s = pokemon.stats;
    return s.hp + s.attack + s.defense + s.specialAttack + s.specialDefense + s.speed;
  });
  
  /**
   * Returns a list of stat name/key pairs for template iteration
   *
   * @returns Array of StatItem objects
   */
  getStatList(): StatItem[] {
    return [
      { name: 'HP', key: 'hp' },
      { name: 'Attack', key: 'attack' },
      { name: 'Defense', key: 'defense' },
      { name: 'Sp. Atk', key: 'specialAttack' },
      { name: 'Sp. Def', key: 'specialDefense' },
      { name: 'Speed', key: 'speed' }
    ];
  }
  
  /**
   * Retrieves a specific stat value from the stats object by key
   *
   * @param stats - The Pokémon stats object
   * @param key - The stat key to retrieve
   * @returns The numeric stat value
   */
  getStatValue(stats: Pokemon['stats'], key: StatKey): number {
    return stats[key];
  }
  
  /**
   * Converts a raw stat value to a percentage of the maximum possible stat
   *
   * @param stat - The raw stat value
   * @param max - The maximum possible stat value (default 255)
   * @returns Percentage value between 0 and 100
   */
  getStatPercentage(stat: number, max: number = 255): number {
    return (stat / max) * 100;
  }
  
  /**
   * Handles broken sprite images by substituting a fallback URL
   *
   * @param event - The image error event
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';
  }
  
  /**
   * Stops any playing audio and emits the closed output event
   */
  onClose(): void {
    this.stopAudio();
    this.closed.emit();
  }
  
  /**
   * Plays the Pokémon's cry audio from the PokéAPI cries endpoint
   */
  playAudio(): void {
    const url = this.audioUrl();
    if (!url) return;
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
    
    this.audioElement = new Audio(url);
    this.audioElement.play().catch(err => console.log('Audio play failed:', err));
    this.isPlaying.set(true);
    
    this.audioElement.onended = () => {
      this.isPlaying.set(false);
      this.audioElement = null;
    };
  }
  
  /**
   * Stops the currently playing cry audio and resets the playing state
   */
  stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
      this.isPlaying.set(false);
    }
  }
}