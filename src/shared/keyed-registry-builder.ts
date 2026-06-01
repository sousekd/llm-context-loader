/**
 * Builds typed-key registries for host tools and extension services.
 *
 * Host and engine assembly need mutable registration while constructing the
 * runtime, but extension factories should receive a small immutable view. This
 * helper centralizes duplicate and missing key errors without making contracts
 * depend on a concrete registry implementation.
 */

import { ConfigurationError } from "./errors.js";

/** Describes the stable identity shared by host-tool and extension-service keys. */
interface KeyShape {
  readonly id: string;
  readonly description: string;
}

/** Minimal view contract satisfied by HostTools and ExtensionServices. */
interface KeyedRegistryView {
  require<TValue>(key: KeyShape): TValue;
  tryGet<TValue>(key: KeyShape): TValue | undefined;
}

/** Mutable keyed registry that produces an immutable typed view on build. */
export interface KeyedRegistryBuilder<TPublic extends KeyedRegistryView> extends KeyedRegistryView {
  register<TValue>(key: KeyShape, value: TValue): void;
  build(): TPublic;
}

/** Labels used in ConfigurationError messages and codes. */
interface KeyedRegistryLabels {
  readonly label: string;
  readonly missingCode: string;
  readonly duplicateCode: string;
}

/** Creates an empty keyed registry builder with the given error labels. */
export function createKeyedRegistryBuilder<TPublic extends KeyedRegistryView>(
  labels: KeyedRegistryLabels
): KeyedRegistryBuilder<TPublic> {
  const entries = new Map<string, unknown>();

  /** Creates a typed read-only view over either the live map or a frozen snapshot. */
  const makeView = (snapshot: ReadonlyMap<string, unknown>): KeyedRegistryView => ({
    require<TValue>(key: KeyShape): TValue {
      const value = snapshot.get(key.id);
      if (value === undefined)
        throw new ConfigurationError(`Missing ${labels.label}: ${key.description}`, labels.missingCode);
      return value as TValue;
    },
    tryGet<TValue>(key: KeyShape): TValue | undefined {
      return snapshot.get(key.id) as TValue | undefined;
    }
  });
  const live = makeView(entries);
  return {
    register<TValue>(key: KeyShape, value: TValue): void {
      if (entries.has(key.id))
        throw new ConfigurationError(`Duplicate ${labels.label}: ${key.description}`, labels.duplicateCode);
      entries.set(key.id, value);
    },
    require<TValue>(key: KeyShape): TValue {
      return live.require<TValue>(key);
    },
    tryGet<TValue>(key: KeyShape): TValue | undefined {
      return live.tryGet<TValue>(key);
    },
    build(): TPublic {
      return makeView(new Map(entries)) as unknown as TPublic;
    }
  };
}
