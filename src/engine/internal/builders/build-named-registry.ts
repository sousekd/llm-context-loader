/**
 * Builds configured name-keyed registries from descriptor records.
 *
 * Provider and renderer builders share the same lifecycle: find a descriptor by
 * YAML type, parse opaque config in the implementation-local schema, construct
 * the behavior-only runtime instance, then wrap it with configured identity.
 * Unclassified descriptor failures become contextual `ConfigurationError`s.
 */

import { ConfigurationError } from "../../../shared/errors.js";

import type { NamedRegistry } from "../../../contracts/extensions/named-registry.js";
import type { HostTools } from "../../../contracts/host/host-tools.js";
import type { Logger } from "../../../shared/logger.js";

/** Describes the raw config entry shape common to engine component declarations. */
interface RawDescriptorEntry {
  readonly type: string;
  readonly config?: unknown;
}

/** Minimal descriptor shape needed for registry construction. */
interface MinimalDescriptor<TInstance> {
  parseConfig(raw: unknown): unknown;
  create(args: {
    name: string;
    config: unknown;
    deps: { tools: HostTools; logger: Logger };
  }): TInstance | Promise<TInstance>;
}

/** Labels and log-field name for descriptor-driven registry construction. */
interface NamedRegistryLabels {
  readonly logField: string;
  readonly unknownTypeCode: string;
  readonly unknownTypeMessage: (type: string) => string;
  readonly invalidConfigCode: string;
  readonly invalidConfigMessage: (name: string, type: string) => string;
  readonly createFailedCode: string;
  readonly createFailedMessage: (name: string, type: string) => string;
  readonly missingCode: string;
  readonly missingMessage: (name: string) => string;
}

/** Inputs to a name-keyed registry build. */
interface BuildNamedRegistryOptions<TInstance, TResolved> {
  readonly rawEntries: Readonly<Record<string, RawDescriptorEntry>>;
  readonly descriptors: Readonly<Record<string, MinimalDescriptor<TInstance>>>;
  readonly tools: HostTools;
  readonly logger: Logger;
  readonly labels: NamedRegistryLabels;
  readonly resolve: (id: { readonly name: string; readonly type: string }, instance: TInstance) => TResolved;
}

/** Builds a name-keyed registry by instantiating each configured entry's descriptor. */
export async function buildNamedRegistry<TInstance, TResolved>(
  options: BuildNamedRegistryOptions<TInstance, TResolved>
): Promise<NamedRegistry<TResolved>> {
  const { rawEntries, descriptors, tools, logger, labels, resolve } = options;
  const resolved = new Map<string, TResolved>();
  for (const [name, raw] of Object.entries(rawEntries)) {
    const descriptor = descriptors[raw.type];
    if (!descriptor) throw new ConfigurationError(labels.unknownTypeMessage(raw.type), labels.unknownTypeCode);
    let parsed: unknown;
    try {
      parsed = descriptor.parseConfig(raw.config);
    } catch (cause) {
      if (cause instanceof ConfigurationError) throw cause;
      throw new ConfigurationError(labels.invalidConfigMessage(name, raw.type), labels.invalidConfigCode, {
        cause,
        name,
        type: raw.type
      });
    }
    let instance: TInstance;
    try {
      instance = await descriptor.create({
        name,
        config: parsed,
        deps: { tools, logger: logger.child({ [labels.logField]: name, type: raw.type }) }
      });
    } catch (cause) {
      if (cause instanceof ConfigurationError) throw cause;
      throw new ConfigurationError(labels.createFailedMessage(name, raw.type), labels.createFailedCode, {
        cause,
        name,
        type: raw.type
      });
    }
    resolved.set(name, resolve({ name, type: raw.type }, instance));
  }
  return Object.freeze({
    require(name: string): TResolved {
      const entry = resolved.get(name);
      if (!entry) throw new ConfigurationError(labels.missingMessage(name), labels.missingCode);
      return entry;
    },
    tryGet(name: string): TResolved | undefined {
      return resolved.get(name);
    }
  });
}
