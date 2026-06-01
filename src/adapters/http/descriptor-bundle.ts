/**
 * Aggregates the default HTTP adapter descriptors for hosted app assembly.
 *
 * This descriptor bundle is the only non-built-in HTTP file that imports
 * concrete HTTP adapter built-ins. The HTTP host and adapter builder stay
 * independent of concrete adapter implementations.
 */

import { createDescriptorRecord } from "../../shared/descriptors.js";
import { jinaAdapterDescriptor } from "./builtins/jina/jina-adapter-descriptor.js";
import { openWebUiAdapterDescriptor } from "./builtins/open-webui/open-webui-adapter-descriptor.js";

import type { HttpAdapterDescriptor } from "./adapter-contracts.js";

/** Bundles built-in HTTP adapter descriptors by YAML type. */
export const DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE: Readonly<Record<string, HttpAdapterDescriptor>> =
  createDescriptorRecord([openWebUiAdapterDescriptor, jinaAdapterDescriptor], descriptor => descriptor.type);
