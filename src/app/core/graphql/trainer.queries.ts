// src/app/core/graphql/trainer.queries.ts
import { gql } from 'apollo-angular';

// ============================================
// QUERIES
// ============================================

export const GET_TRAINER = gql`
  query GetTrainer($id: ID!) {
    trainer(id: $id) {
      id
      name
      badge_count
      region
      avatar_url
      rank
    }
  }
`;

export const GET_TRAINER_TEAMS = gql`
  query GetTrainerTeams($trainerId: ID!) {
    teams(where: {trainer_id: {_eq: $trainerId}}) {
      id
      name
      pokemon_ids
      created_at
      competitive_mode
      tier
    }
  }
`;

export const GET_ALL_BATTLES = gql`
  query GetAllBattles($trainerId: ID!) {
    battles(where: {trainer_id: {_eq: $trainerId}}, order_by: {date: desc}) {
      id
      opponent_name
      result
      date
      score_trainer
      score_opponent
    }
  }
`;

export const GET_RECENT_BATTLE_LOGS = gql`
  query GetRecentBattleLogs($since: DateTime!) {
    battle_log(where: {timestamp: {_gte: $since}}, order_by: {timestamp: asc}) {
      id
      battle_id
      timestamp
      message
      severity
    }
  }
`;

// ============================================
// MUTATIONS
// ============================================

export const CREATE_TEAM = gql`
  mutation CreateTeam($input: CreateTeamInput!) {
    createTeam(input: $input) {
      id
      name
      trainer_id
      pokemon_ids
      created_at
      competitive_mode
      tier
    }
  }
`;

export const UPDATE_TEAM = gql`
  mutation UpdateTeam($id: ID!, $input: UpdateTeamInput!) {
    updateTeam(id: $id, input: $input) {
      id
      name
      pokemon_ids
      competitive_mode
      tier
    }
  }
`;

export const DELETE_TEAM = gql`
  mutation DeleteTeam($id: ID!) {
    deleteTeam(id: $id) {
      id
    }
  }
`;

export const LOG_BATTLE = gql`
  mutation LogBattle($input: CreateBattleInput!) {
    createBattle(input: $input) {
      id
      trainer_id
      opponent_name
      result
      date
      score_trainer
      score_opponent
    }
  }
`;

export const UPDATE_TRAINER = gql`
  mutation UpdateTrainer($id: ID!, $input: UpdateTrainerInput!) {
    updateTrainer(id: $id, input: $input) {
      id
      name
      badge_count
      region
      avatar_url
      rank
    }
  }
`;