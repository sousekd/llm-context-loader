/**
 * Defines the name-keyed registry shape shared by configured engine instances.
 *
 * Registries expose resolved wrappers rather than bare implementations so
 * inspection surfaces can list YAML names and descriptor types without asking
 * each provider or renderer to know its own configured identity.
 */

/** Resolves configured instances by name. */
export interface NamedRegistry<T> {
  /** Returns a configured instance or throws when it is unknown. */
  require(name: string): T;

  /** Returns a configured instance when it exists. */
  tryGet(name: string): T | undefined;
}
