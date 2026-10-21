// Typed builders work before the first cloud deployment generates its helpers.
import { internalActionGeneric, internalMutationGeneric, mutationGeneric, internalQueryGeneric, queryGeneric, type ActionBuilder, type DataModelFromSchemaDefinition, type MutationBuilder, type QueryBuilder } from 'convex/server';
import type schema from './schema';
type Model = DataModelFromSchemaDefinition<typeof schema>;
export const internalMutation: MutationBuilder<Model,'internal'> = internalMutationGeneric;
export const internalQuery: QueryBuilder<Model,'internal'> = internalQueryGeneric;
export const internalAction: ActionBuilder<Model,'internal'> = internalActionGeneric;
export const query: QueryBuilder<Model,'public'> = queryGeneric;
export const mutation: MutationBuilder<Model,'public'> = mutationGeneric;
